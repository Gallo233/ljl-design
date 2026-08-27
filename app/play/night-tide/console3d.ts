import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { SCREEN_WIDTH, type GameButton } from "./games";

/**
 * The handheld, as an actual object, modelled against the supplied design render.
 *
 * ### Why two renderers
 *
 * The screen has to stay real DOM. Night Tide is a Godot build in an `<iframe>`, and no
 * browser will let an iframe become a WebGL texture — a fully-textured 3D screen would cost
 * us the one game that was already here. `CSS3DRenderer` places the screen element *in the
 * same 3D space* as the mesh, transformed by the same camera, so it sits on the console's
 * screen plane in perspective while staying a live, interactive DOM node.
 *
 * The trade is depth: DOM cannot be occluded by WebGL geometry, so a cartridge dragged
 * across the screen would slide *behind* it. Rather than fight that, the screen dims while a
 * cartridge is in hand — which is also what a machine waiting for a cartridge should look
 * like.
 *
 * ### Why the camera never orbits
 *
 * Same reason. Free orbit is easy here, but every frame of it is a frame where the DOM screen
 * has to track a moving quad, and drift shows immediately as the screen peeling off the
 * bezel. The camera holds the design's head-on attitude and only breathes with the pointer.
 *
 * The screen is an exact 16:9 live surface. Canvas cartridges share that internal aspect,
 * while the Godot iframe keeps its native wide presentation without CSS letterboxing.
 */

export type CartridgeSpec = {
  id: string;
  label: string;
  sublabel: string;
  accent: string;
};

export type ConsoleSceneOptions = {
  container: HTMLElement;
  screenElement: HTMLElement;
  cartridges: CartridgeSpec[];
  onButtonDown: (id: GameButton) => void;
  onButtonUp: (id: GameButton) => void;
  /** Fires the moment the card is released over the slot — show a loading state. */
  onInsertBegin: (id: string) => void;
  /** Fires when it has finished seating — mount the game here. */
  onInsert: (id: string) => void;
  onHover: (id: string | null) => void;
  onDragState: (dragging: boolean) => void;
  /** The shell's phase gate: while it returns false (booting), the pointer is refused. */
  isInteractive?: () => boolean;
  /** The WebGL context died and is not coming back — the shell should fall back to flat DOM. */
  onFatal?: () => void;
};

export type ConsoleScene = {
  setPressed: (id: GameButton, down: boolean) => void;
  setInserted: (id: string | null) => void;
  dispose: () => void;
};

/* ── proportions, measured from the approved optimisation image ──────────────
 * The active display is 20.2% larger in area than the former 6.2 × 4.65 opening,
 * with a thinner moulded bezel and enough side deck for every control to remain seated.
 */
const SCREEN_W = 7.85;
const SCREEN_H = SCREEN_W * (9 / 16);
const BEZEL = 0.28;
const DECK_W = 2.75;
const BODY_W = SCREEN_W + BEZEL * 2 + DECK_W * 2;
const BODY_H = BODY_W / 1.82;
const BODY_D = 1.25;
const BODY_R = BODY_H * 0.19; // the render's corners are very generous
const FACE_Z = BODY_D / 2;

const CART_W = 2.05;
const CART_H = 2.95;
const CART_D = 0.34;

const SHELL = "#f3f5f8";
const SHELL_EDGE = "#e4e8ef";
const BEZEL_COLOUR = "#c9d3e0";
const KEY_GREY = "#e6eaf1";

/**
 * The console's plastic accent palette. Face buttons and cartridge shells draw from these
 * same four colours so the rack reads as belonging to the machine. This is deliberately a
 * different palette from the games' in-canvas `PALETTE`, which colours what happens *on*
 * the screen, not the plastic around it.
 */
export const CONSOLE_ACCENTS = {
  periwinkle: "#9ba4cf",
  sage: "#a9c9b6",
  salmon: "#e0968a",
  wheat: "#e8c68d",
} as const;

/**
 * A rounded rectangle as a `Shape`.
 *
 * `RoundedBoxGeometry` cannot make this body: its single radius is clamped by the *smallest*
 * dimension, so a 13 × 7 × 1.25 slab can only ever have a 0.6 corner — which is why the first
 * pass came out boxy against a reference whose corners are enormous. Extruding a shape lets
 * the face corners and the edge fillet be set independently, which is what a moulded shell
 * actually has.
 */
function roundedRect(width: number, height: number, radius: number) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

/** An extruded rounded plate with a soft fillet on both faces. */
function plate(width: number, height: number, depth: number, radius: number, fillet: number) {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(width, height, radius), {
    depth: Math.max(0.02, depth - fillet * 2),
    bevelEnabled: true,
    bevelThickness: fillet,
    bevelSize: fillet,
    bevelSegments: 5,
    curveSegments: 26,
  });
  geometry.center();
  return geometry;
}

export function createConsoleScene(options: ConsoleSceneOptions): ConsoleScene {
  const { container, screenElement, cartridges } = options;
  const interactive = options.isInteractive ?? (() => true);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // CSS3DObject rewrites the screen element's inline style (position, pointer-events, a
  // per-frame matrix3d). Snapshot it now so dispose can hand the element back unchanged.
  const screenStyleSnapshot = screenElement.style.cssText;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;";
  // The canvas is decoration to assistive tech — the live screen (boot status, game canvas,
  // Godot iframe) lives in the CSS3D layer, which must stay visible to the accessibility tree.
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    options.onFatal?.();
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  const css = new CSS3DRenderer();
  css.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  container.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);

  // ── environment ───────────────────────────────────────────────────────────
  // A vertical studio gradient. This, not the lights, is what makes the plastic read as
  // plastic: it gives every curved edge a soft falloff highlight instead of a flat tint.
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 16;
  envCanvas.height = 128;
  {
    const c = envCanvas.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, "#f0f3f9");
    g.addColorStop(0.72, "#ccd4e2");
    g.addColorStop(1, "#a6b0c2");
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 128);
  }
  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(envTexture);
  scene.environment = envTarget.texture;
  envTexture.dispose();
  pmrem.dispose();

  // ── lighting ──────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d2e0, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-6, 13, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 52;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.0011;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6ecf7, 0.4);
  fill.position.set(10, 3, 7);
  scene.add(fill);

  // A close shadow catcher gives the lower shell a real contact point on the page.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.ShadowMaterial({ opacity: 0.13 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -BODY_H / 2 - 0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── materials ─────────────────────────────────────────────────────────────
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: SHELL, roughness: 0.42, metalness: 0,
    clearcoat: 0.18, clearcoatRoughness: 0.5, envMapIntensity: 0.68,
  });
  const shellEdgeMat = new THREE.MeshPhysicalMaterial({
    color: SHELL_EDGE, roughness: 0.5, metalness: 0,
    clearcoat: 0.35, envMapIntensity: 0.7,
  });
  const bezelMat = new THREE.MeshPhysicalMaterial({
    color: BEZEL_COLOUR, roughness: 0.58, metalness: 0, envMapIntensity: 0.5,
  });
  const keyMat = new THREE.MeshPhysicalMaterial({
    color: KEY_GREY, roughness: 0.4, metalness: 0,
    clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
  });

  const consoleGroup = new THREE.Group();
  consoleGroup.name = "game-center-handheld";
  scene.add(consoleGroup);

  type Pressable = { mesh: any; id: GameButton; restZ: number; axis: "z" | "y" };
  const pressables: Pressable[] = [];
  const addKey = (
    mesh: any,
    id: GameButton,
    axis: "z" | "y" = "z",
    parent: any = consoleGroup,
  ) => {
    mesh.castShadow = true;
    mesh.name = `control-${id}`;
    mesh.userData.button = id;
    pressables.push({ mesh, id, restZ: mesh.position[axis], axis });
    parent.add(mesh);
  };

  // ── body ──────────────────────────────────────────────────────────────────
  const bodyGeometry = plate(BODY_W, BODY_H, BODY_D, BODY_R, 0.26);
  const body = new THREE.Mesh(bodyGeometry, shellMat);
  body.name = "shell-front";
  body.castShadow = true;
  body.receiveShadow = true;
  consoleGroup.add(body);

  // The render has a parting seam near the bottom edge — a thin darker band that reads as
  // two moulded halves. Cheap to add, and it is most of what stops the body looking printed.
  const seamGeometry = plate(BODY_W * 0.986, BODY_H * 0.986, 0.1, BODY_R * 0.97, 0.04);
  const seam = new THREE.Mesh(seamGeometry, shellEdgeMat);
  seam.name = "shell-seam";
  seam.position.set(0, 0, -BODY_D / 2 + 0.16);
  consoleGroup.add(seam);

  // ── screen ────────────────────────────────────────────────────────────────
  // A raised frame standing proud of the face, with the screen recessed inside it.
  const displayAssembly = new THREE.Group();
  displayAssembly.name = "display-module";
  consoleGroup.add(displayAssembly);
  const bezelGeometry = plate(SCREEN_W + BEZEL * 2, SCREEN_H + BEZEL * 2, 0.34, 0.28, 0.08);
  const bezelFrame = new THREE.Mesh(bezelGeometry, bezelMat);
  bezelFrame.name = "screen-bezel";
  bezelFrame.position.set(0, 0.3, FACE_Z - 0.02);
  bezelFrame.castShadow = true;
  bezelFrame.receiveShadow = true;
  displayAssembly.add(bezelFrame);

  const screenWell = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
    new THREE.MeshBasicMaterial({ color: 0xf6f8fb }),
  );
  screenWell.name = "screen-aperture";
  screenWell.position.set(0, 0.3, FACE_Z + 0.115);
  displayAssembly.add(screenWell);

  const screenObject = new CSS3DObject(screenElement);
  screenObject.scale.setScalar(SCREEN_W / SCREEN_WIDTH);
  screenObject.position.set(0, 0.3, FACE_Z + 0.13);
  cssScene.add(screenObject);

  // ── D-pad: a plus inside a shallow round dish, as in the render ───────────
  const deckX = SCREEN_W / 2 + BEZEL + DECK_W / 2;
  const dpadY = 0.52;
  const dishMat = new THREE.MeshPhysicalMaterial({
    color: "#dbe1ea", roughness: 0.62, metalness: 0, envMapIntensity: 0.55,
  });
  const dpadAssembly = new THREE.Group();
  dpadAssembly.name = "dpad";
  consoleGroup.add(dpadAssembly);
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(1.06, 1.12, 0.2, 56),
    dishMat,
  );
  dish.name = "dpad-well";
  dish.rotation.x = Math.PI / 2;
  dish.position.set(-deckX, dpadY, FACE_Z - 0.01);
  dish.receiveShadow = true;
  dpadAssembly.add(dish);

  // The pad is one plus-shaped piece; the four keys are separate meshes on top of it so
  // each can depress on its own, which a single moulded cross could not do.
  const ARM = 0.74;
  const WAIST = 0.54;
  const dpadLayout: Array<[GameButton, number, number, number, number]> = [
    ["up", 0, 1, WAIST, ARM],
    ["down", 0, -1, WAIST, ARM],
    ["left", -1, 0, ARM, WAIST],
    ["right", 1, 0, ARM, WAIST],
  ];
  dpadLayout.forEach(([id, dx, dy, w, h]) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, 0.3, 4, 0.09),
      keyMat,
    );
    mesh.position.set(
      -deckX + dx * (ARM / 2 + 0.02),
      dpadY + dy * (ARM / 2 + 0.02),
      FACE_Z + 0.16,
    );
    mesh.userData.explodeWithParent = "dpad";
    addKey(mesh, id, "z", dpadAssembly);
  });
  const dpadHub = new THREE.Mesh(
    new THREE.BoxGeometry(WAIST, WAIST, 0.28),
    keyMat,
  );
  dpadHub.name = "dpad-hub";
  dpadHub.userData.explodeWithParent = "dpad";
  dpadHub.position.set(-deckX, dpadY, FACE_Z + 0.15);
  dpadAssembly.add(dpadHub);

  // ── face buttons ──────────────────────────────────────────────────────────
  // Exact target order: X top, Y left, A right, B bottom.
  const faceColours: Record<string, string> = {
    x: CONSOLE_ACCENTS.sage,
    y: CONSOLE_ACCENTS.periwinkle,
    a: CONSOLE_ACCENTS.salmon,
    b: CONSOLE_ACCENTS.wheat,
  };
  // Pulled in from the shell edge, and offset the way the render staggers them.
  const faceLayout: Array<[GameButton, number, number]> = [
    ["x", -0.12, 0.64],
    ["y", -0.78, 0.04],
    ["a", 0.54, -0.08],
    ["b", -0.16, -0.66],
  ];
  const faceButtonAssembly = new THREE.Group();
  faceButtonAssembly.name = "face-buttons";
  consoleGroup.add(faceButtonAssembly);
  const buttonLabelTexture = (label: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, 128, 128);
    context.fillStyle = "#596173";
    context.font = "700 58px ui-monospace, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 64, 68);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  faceLayout.forEach(([id, x, y]) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.46, 0.3, 40),
      new THREE.MeshPhysicalMaterial({
        color: faceColours[id], roughness: 0.36, metalness: 0,
        clearcoat: 0.65, clearcoatRoughness: 0.28, envMapIntensity: 1,
      }),
    );
    mesh.rotation.x = Math.PI / 2;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.48),
      new THREE.MeshBasicMaterial({
        map: buttonLabelTexture(id.toUpperCase()),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.157;
    label.raycast = () => {};
    label.userData.explodeWithParent = "face-buttons";
    mesh.add(label);
    mesh.position.set(deckX + x, dpadY + y, FACE_Z + 0.13);
    mesh.userData.explodeWithParent = "face-buttons";
    addKey(mesh, id, "z", faceButtonAssembly);
  });

  // ── shoulders ─────────────────────────────────────────────────────────────
  // Flat pads sitting on the top edge, two per side, just breaking the silhouette.
  const shoulderLayout: Array<[GameButton, number]> = [
    ["l2", -(BODY_W / 2 - 1.35)],
    ["l1", -(BODY_W / 2 - 2.65)],
    ["r1", BODY_W / 2 - 2.65],
    ["r2", BODY_W / 2 - 1.35],
  ];
  const shoulderAssembly = new THREE.Group();
  shoulderAssembly.name = "shoulder-buttons";
  consoleGroup.add(shoulderAssembly);
  shoulderLayout.forEach(([id, x]) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(1.55, 0.54, 0.86, 5, 0.2),
      shellEdgeMat,
    );
    mesh.position.set(x, BODY_H / 2 + 0.2, -0.02);
    mesh.userData.explodeWithParent = "shoulder-buttons";
    addKey(mesh, id, "y", shoulderAssembly);
  });

  // ── select / start ────────────────────────────────────────────────────────
  const utilityAssembly = new THREE.Group();
  utilityAssembly.name = "utility-buttons";
  consoleGroup.add(utilityAssembly);
  ([["select", -0.72], ["start", 0.72]] as Array<[GameButton, number]>).forEach(([id, x]) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 0.26, 0.22, 4, 0.11),
      new THREE.MeshPhysicalMaterial({
        color: "#dde2ea", roughness: 0.45, clearcoat: 0.4, envMapIntensity: 0.8,
      }),
    );
    mesh.position.set(x, -SCREEN_H / 2 - 0.36, FACE_Z + 0.08);
    mesh.userData.explodeWithParent = "utility-buttons";
    addKey(mesh, id, "z", utilityAssembly);
  });

  /* ── identity ──────────────────────────────────────────────────────────────
   * The details that make it *this* machine rather than "a" machine: brand plate,
   * top-line, speaker grille, status LEDs and stick caps. All drawn, not loaded —
   * same canvas-texture pipeline as the cartridge labels.
   */
  const decalTexture = (width: number, height: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d")!);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const markingAssembly = new THREE.Group();
  markingAssembly.name = "technical-markings";
  consoleGroup.add(markingAssembly);
  const decal = (texture: any, width: number, height: number, x: number, y: number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
    mesh.position.set(x, y, FACE_Z + 0.02);
    mesh.userData.explodeWithParent = "technical-markings";
    markingAssembly.add(mesh);
    return mesh;
  };

  decal(
    decalTexture(680, 84, (c) => {
      c.fillStyle = "#a7b0c4";
      c.font = "600 30px ui-monospace, Menlo, monospace";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("N I G H T   T I D E   / / /   J O I   L A B", 340, 44);
    }),
    3.4, 0.42, 0, -3.04,
  );
  decal(
    decalTexture(480, 64, (c) => {
      c.fillStyle = "#9aa4b8";
      c.font = "500 26px ui-monospace, Menlo, monospace";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("J O I  /  P O C K E T - N T", 240, 34);
    }),
    2.2, 0.3, -deckX, 2.58,
  );
  const speakerGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.045, 16);
  const speakerMaterial = new THREE.MeshStandardMaterial({
    color: "#b7c0ce", roughness: 0.78, metalness: 0,
  });
  const speakerGrid = new THREE.InstancedMesh(speakerGeometry, speakerMaterial, 20);
  speakerGrid.name = "speaker-array";
  const speakerDot = new THREE.Object3D();
  let speakerIndex = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      speakerDot.position.set(deckX - 0.04 + col * 0.21, -2.52 + row * 0.2, FACE_Z + 0.03);
      speakerDot.rotation.set(Math.PI / 2, 0, 0);
      speakerDot.updateMatrix();
      speakerGrid.setMatrixAt(speakerIndex, speakerDot.matrix);
      speakerIndex += 1;
    }
  }
  speakerGrid.instanceMatrix.needsUpdate = true;
  consoleGroup.add(speakerGrid);

  // Two status LEDs on the top-right of the face: power is always lit, the cartridge one
  // comes up as a card seats. Driven from the loop by reading the cartridge states — the
  // scene already knows, so the shell does not need an API for it.
  const ledGeometry = new THREE.CylinderGeometry(0.07, 0.08, 0.08, 20);
  const powerLedMat = new THREE.MeshStandardMaterial({
    color: CONSOLE_ACCENTS.sage, emissive: CONSOLE_ACCENTS.sage, emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const cartLedMat = new THREE.MeshStandardMaterial({
    color: CONSOLE_ACCENTS.periwinkle, emissive: CONSOLE_ACCENTS.periwinkle, emissiveIntensity: 0.12,
    roughness: 0.4,
  });
  const statusLensAssembly = new THREE.Group();
  statusLensAssembly.name = "status-lenses";
  consoleGroup.add(statusLensAssembly);
  [powerLedMat, cartLedMat].forEach((material, index) => {
    const led = new THREE.Mesh(ledGeometry, material);
    led.rotation.x = Math.PI / 2;
    led.position.set(BODY_W / 2 - 1.05 + index * 0.34, 2.58, FACE_Z + 0.04);
    led.userData.explodeWithParent = "status-lenses";
    statusLensAssembly.add(led);
  });

  // Non-functional stick caps below the controls, matching the render's silhouette.
  const buildStick = (x: number) => {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.14, 40), dishMat);
    base.rotation.x = Math.PI / 2;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 24), shellEdgeMat);
    stalk.rotation.x = Math.PI / 2;
    stalk.position.z = 0.2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 20), keyMat);
    cap.scale.z = 0.55;
    cap.position.z = 0.38;
    cap.castShadow = true;
    group.add(base, stalk, cap);
    group.position.set(x, -1.72, FACE_Z + 0.02);
    consoleGroup.add(group);
    return group;
  };
  const leftStick = buildStick(-deckX + 0.85);
  leftStick.name = "analog-left";
  const rightStick = buildStick(deckX - 0.85);
  rightStick.name = "analog-right";
  const leftControlAssembly = new THREE.Group();
  leftControlAssembly.name = "left-control-cluster";
  consoleGroup.add(leftControlAssembly);
  leftControlAssembly.add(dpadAssembly, leftStick);
  const rightControlAssembly = new THREE.Group();
  rightControlAssembly.name = "right-control-cluster";
  consoleGroup.add(rightControlAssembly);
  rightControlAssembly.add(faceButtonAssembly, rightStick, statusLensAssembly, speakerGrid);

  // ── cartridges ────────────────────────────────────────────────────────────
  /** Switch-style: a thick card with a clipped **top-right** corner, as in the render. */
  const cartShape = (() => {
    const w = CART_W, h = CART_H, notch = 0.42, r = 0.1;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - notch);
    s.lineTo(w / 2 - notch, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  })();

  const cartGeometry = new THREE.ExtrudeGeometry(cartShape, {
    depth: CART_D, bevelEnabled: true,
    bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 10,
  });
  cartGeometry.center();

  /** The pale label panel on the front face, drawn rather than loaded. */
  const buildLabel = (spec: CartridgeSpec) => {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 320;
    const c = canvas.getContext("2d")!;
    c.clearRect(0, 0, 220, 320);
    c.fillStyle = "#f4f6fa";
    c.beginPath();
    c.roundRect(24, 52, 172, 216, 9);
    c.fill();
    c.strokeStyle = "rgba(90,102,130,.16)";
    c.lineWidth = 2;
    c.stroke();

    c.fillStyle = spec.accent;
    c.fillRect(24, 52, 172, 7);

    c.fillStyle = "#2b3040";
    c.font = "600 25px ui-sans-serif, system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText(spec.label, 110, 152);

    c.fillStyle = "#8d95a8";
    c.font = "500 12px ui-monospace, Menlo, monospace";
    c.fillText(spec.sublabel, 110, 180);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };

  /**
   * A cartridge is always in exactly one of these, and the loop only ever reads the state.
   * Insertion used to be a single lerp toward a seated position, which arrives diagonally
   * and lands *through* the lip — it read as the card melting into the case. A card goes in
   * the way a hand puts it in: square up above the mouth, then straight down, then settle.
   */
  type CartridgeState = "racked" | "held" | "aligning" | "sinking" | "seated" | "rising";

  type Cartridge = {
    spec: CartridgeSpec;
    group: any;
    homePosition: any;
    homeRotation: any;
    state: CartridgeState;
    /** 0..1 through the current scripted stage. */
    progress: number;
    /** Where `aligning` and `rising` started, so their tween has an origin. */
    from: any;
    fromQuaternion: any;
    label: any;
  };

  // A row of cards leaning in a rack, receding to the right — the render's arrangement.
  const RACK_X = BODY_W / 2 + 2.15;
  const RACK_STEP = 0.78;
  const RACK_LEAN = -0.58;

  const cartridgeList: Cartridge[] = cartridges.map((spec, index) => {
    const shell = new THREE.MeshPhysicalMaterial({
      color: spec.accent, roughness: 0.42, metalness: 0,
      clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
    });
    const mesh = new THREE.Mesh(cartGeometry, shell);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const labelTexture = buildLabel(spec);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(CART_W, CART_H),
      new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true }),
    );
    label.position.z = CART_D / 2 + 0.04;

    const group = new THREE.Group();
    group.name = `cartridge-${spec.id}`;
    group.add(mesh, label);
    group.position.set(RACK_X + index * RACK_STEP, -BODY_H / 2 + CART_H / 2 + 0.3, index * -0.34);
    group.rotation.set(0, RACK_LEAN, 0.02);
    scene.add(group);

    return {
      spec,
      group,
      homePosition: group.position.clone(),
      homeRotation: group.rotation.clone(),
      state: "racked" as CartridgeState,
      progress: 0,
      from: group.position.clone(),
      fromQuaternion: group.quaternion.clone(),
      label: labelTexture,
    };
  });

  /* ── the cartridge slot ────────────────────────────────────────────────────
   * Three pieces, because a single dark rectangle reads as a sticker rather than an
   * opening: a raised lip moulded into the top edge, a recessed well sunk below it, and
   * a rim light that comes up as a cartridge approaches so the drop target announces
   * itself before the reader has to guess.
   */
  const SLOT_Z = -0.12;
  const cartridgeAssembly = new THREE.Group();
  cartridgeAssembly.name = "cartridge-assembly";
  consoleGroup.add(cartridgeAssembly);
  const slotGroup = new THREE.Group();
  slotGroup.name = "cartridge-slot";
  slotGroup.position.set(0, BODY_H / 2, SLOT_Z);
  cartridgeAssembly.add(slotGroup);

  const slotLip = new THREE.Mesh(
    new RoundedBoxGeometry(CART_W + 0.46, 0.3, CART_D + 0.42, 4, 0.1),
    shellEdgeMat,
  );
  slotLip.position.y = -0.08;
  slotLip.castShadow = true;
  slotLip.receiveShadow = true;
  slotGroup.add(slotLip);

  // The opening itself: a well sunk into the lip, dark because it is a hole.
  const slotWell = new THREE.Mesh(
    new THREE.BoxGeometry(CART_W + 0.1, 0.62, CART_D + 0.08),
    new THREE.MeshStandardMaterial({ color: "#8b95a8", roughness: 0.95, metalness: 0 }),
  );
  slotWell.position.y = -0.38;
  slotGroup.add(slotWell);

  const slotMouth = new THREE.Mesh(
    new THREE.PlaneGeometry(CART_W + 0.1, CART_D + 0.08),
    new THREE.MeshBasicMaterial({ color: "#5f6879" }),
  );
  slotMouth.rotation.x = -Math.PI / 2;
  slotMouth.position.y = -0.07;
  slotGroup.add(slotMouth);

  // Rim light around the mouth, faded in while a cartridge is close enough to drop.
  const slotGlowMaterial = new THREE.MeshBasicMaterial({
    color: "#8fa0e8", transparent: true, opacity: 0, depthWrite: false,
  });
  const slotGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(CART_W + 0.52, CART_D + 0.5),
    slotGlowMaterial,
  );
  slotGlow.rotation.x = -Math.PI / 2;
  slotGlow.position.y = 0.09;
  slotGroup.add(slotGlow);

  /** Where a released cartridge is caught, and the line it travels down into the machine. */
  const slotHoverPoint = new THREE.Vector3(0, BODY_H / 2 + CART_H * 0.62, SLOT_Z);
  // Seated means *in* the machine: only the grip end stays proud, the rest is swallowed
  // by the shell. The first pass left three quarters of the card sticking out, which read
  // as jammed rather than loaded.
  const slotSeatedPoint = new THREE.Vector3(0, BODY_H / 2 - CART_H * 0.16, SLOT_Z);
  const SNAP_RANGE = 3.2;

  // `img2threejs` assembly contract: the same semantic part table powers picking,
  // action metadata and a reversible exploded view for structural inspection.
  const runtimeNodes: Record<string, any> = {
    root: consoleGroup,
    "shell-front": body,
    "shell-seam": seam,
    "display-module": displayAssembly,
    "screen-bezel": bezelFrame,
    "screen-aperture": screenWell,
    "left-control-cluster": leftControlAssembly,
    "dpad-well": dish,
    dpad: dpadAssembly,
    "analog-left": leftStick,
    "right-control-cluster": rightControlAssembly,
    "face-buttons": faceButtonAssembly,
    "status-lenses": statusLensAssembly,
    "analog-right": rightStick,
    "speaker-array": speakerGrid,
    "utility-buttons": utilityAssembly,
    "cartridge-assembly": cartridgeAssembly,
    "cartridge-slot": slotGroup,
    "cartridge-night-tide": cartridgeList.find((item) => item.spec.id === "night-tide")?.group,
    "shoulder-left-outer": pressables.find((item) => item.id === "l2")?.mesh,
    "shoulder-left-inner": pressables.find((item) => item.id === "l1")?.mesh,
    "shoulder-right-inner": pressables.find((item) => item.id === "r1")?.mesh,
    "shoulder-right-outer": pressables.find((item) => item.id === "r2")?.mesh,
    "technical-markings": markingAssembly,
  };
  const explodable = Object.entries(runtimeNodes)
    .filter(([id, node], index, entries) =>
      id !== "root" && node && entries.findIndex(([, candidate]) => candidate === node) === index)
    .map(([id, node], index) => ({ id, node, index, base: node.position.clone() }));
  consoleGroup.userData.sculptRuntime = {
    nodes: runtimeNodes,
    sockets: {
      cartridgeSeat: {
        position: slotSeatedPoint.clone(),
        axis: new THREE.Vector3(0, 1, 0),
        gapTolerance: 0.01,
      },
    },
    colliders: {
      body: { type: "box", size: [BODY_W, BODY_H, BODY_D] },
      screen: { type: "box", size: [SCREEN_W, SCREEN_H, 0.12] },
      cartridge: { type: "box", size: [CART_W, CART_H, CART_D] },
    },
    destructionGroups: {
      shell: ["shell-front", "shell-seam"],
      controls: ["dpad", "analog-left", "face-buttons", "analog-right", "utility-buttons"],
      cartridge: ["cartridge-slot", "cartridge-night-tide"],
    },
    resolvePart(object: any) {
      let current = object;
      while (current && current !== consoleGroup) {
        if (current.userData?.explodeWithParent) return current.userData.explodeWithParent;
        if (current.name) return current.name;
        current = current.parent;
      }
      return "root";
    },
    setExploded(amount = 0) {
      const distance = THREE.MathUtils.clamp(amount, 0, 1) * 1.35;
      explodable.forEach(({ node, index, base }) => {
        const direction = new THREE.Vector3(base.x, base.y, base.z * 0.5);
        if (direction.lengthSq() < 0.04) {
          const angle = (index / Math.max(1, explodable.length)) * Math.PI * 2;
          direction.set(Math.cos(angle), Math.sin(angle), index % 2 ? 0.35 : -0.35);
        }
        direction.normalize().multiplyScalar(distance * (1 + index * 0.018));
        node.position.copy(base).add(direction);
      });
    },
  };

  // ── camera framing ────────────────────────────────────────────────────────
  const leftEdge = -BODY_W / 2 - 0.5;
  const rightEdge = RACK_X + (cartridges.length - 1) * RACK_STEP + CART_W * 0.7 + 0.5;
  const contentWidth = rightEdge - leftEdge;
  const contentHeight = BODY_H + 2.2;
  const centreX = (leftEdge + rightEdge) / 2;

  const resize = () => {
    const bounds = container.getBoundingClientRect();
    const w = Math.max(1, bounds.width);
    const h = Math.max(1, bounds.height);
    const aspect = w / h;
    camera.aspect = aspect;

    const fov = (camera.fov * Math.PI) / 180;
    const forHeight = contentHeight / 2 / Math.tan(fov / 2);
    const forWidth = contentWidth / 2 / Math.tan(fov / 2) / aspect;
    const distance = Math.max(forHeight, forWidth) * 1.0;

    camera.position.set(centreX * 0.72, 1.1, distance);
    camera.lookAt(centreX * 0.72, -0.15, 0);
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, aspect < 1 ? 1.6 : 2));
    renderer.setSize(w, h, false);
    css.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // ── interaction ───────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.9);
  const dragPoint = new THREE.Vector3();
  const dragOffset = new THREE.Vector3();

  let dragging: Cartridge | null = null;
  let held: { mesh: any; id: GameButton } | null = null;
  let hovered: string | null = null;
  const parallax = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();

  const setPointer = (event: PointerEvent) => {
    const b = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - b.left) / b.width) * 2 - 1;
    pointer.y = -((event.clientY - b.top) / b.height) * 2 + 1;
    parallaxTarget.set(pointer.x, pointer.y);
  };

  const hit = (objects: any[]) => {
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(objects, true)[0] ?? null;
  };

  const cartridgeOf = (object: any): Cartridge | null => {
    let node = object;
    while (node) {
      const match = cartridgeList.find((item) => item.group === node);
      if (match) return match;
      node = node.parent;
    }
    return null;
  };

    /** Cartridges a pointer may pick up: anything not already committed to the machine. */
  const loose = () => cartridgeList
    .filter((item) => item.state === "racked" || item.state === "held")
    .map((item) => item.group);

  const onPointerDown = (event: PointerEvent) => {
    setPointer(event);
    // The machine is booting: it accepts no input yet, the same as its screen says.
    if (!interactive()) return;

    const buttonHit = hit(pressables.map((item) => item.mesh));
    const cartHit = hit(loose());
    // Whichever is actually nearer the camera wins, so a cartridge held in front of the
    // machine does not fall through onto a button behind it.
    if (buttonHit && (!cartHit || buttonHit.distance <= cartHit.distance)) {
      held = { mesh: buttonHit.object, id: buttonHit.object.userData.button };
      options.onButtonDown(held.id);
      renderer.domElement.setPointerCapture(event.pointerId);
      return;
    }

    const cartridge = cartHit ? cartridgeOf(cartHit.object) : null;
    if (cartridge) {
      dragging = cartridge;
      cartridge.state = "held";
      raycaster.ray.intersectPlane(dragPlane, dragPoint);
      dragOffset.copy(cartridge.group.position).sub(dragPoint);
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
      // The CSS3D screen normally eats pointer events over its rectangle. While a card is
      // in hand the screen is dimmed anyway, so hand its pixels back to the raycaster.
      screenElement.style.pointerEvents = "none";
      options.onDragState(true);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    setPointer(event);

    if (dragging) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
        dragging.group.position.copy(dragPoint).add(dragOffset);
      }
      return;
    }
    if (held) return;
    if (!interactive()) {
      if (hovered) {
        hovered = null;
        options.onHover(null);
        renderer.domElement.style.cursor = "default";
      }
      return;
    }

    const cartHit = hit(loose());
    const id = cartHit ? cartridgeOf(cartHit.object)?.spec.id ?? null : null;
    if (id !== hovered) {
      hovered = id;
      options.onHover(id);
      renderer.domElement.style.cursor = id ? "grab" : "default";
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (held) {
      options.onButtonUp(held.id);
      held = null;
    }
    if (dragging) {
      // Generous: the target is "near the top of the machine", not a pixel-perfect slot.
      const near = dragging.group.position.distanceTo(slotHoverPoint) < SNAP_RANGE;
      if (near) {
        // Whatever was in the machine comes back out as this one goes in.
        cartridgeList.forEach((item) => {
          if (item !== dragging && (item.state === "seated" || item.state === "sinking")) {
            item.from = item.group.position.clone();
            item.fromQuaternion = item.group.quaternion.clone();
            item.state = "rising";
            item.progress = 0;
          }
        });
        dragging.from = dragging.group.position.clone();
        dragging.fromQuaternion = dragging.group.quaternion.clone();
        dragging.state = "aligning";
        dragging.progress = 0;
        options.onInsertBegin(dragging.spec.id);
      } else {
        dragging.state = "racked";
      }
      dragging = null;
      renderer.domElement.style.cursor = "default";
      screenElement.style.pointerEvents = "auto";
      options.onDragState(false);
    }
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerUp);

  // ── loop ──────────────────────────────────────────────────────────────────
  const pressedState = new Map<GameButton, boolean>();
  const clock = new THREE.Clock();
  let frame = 0;

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  /** Overshoots slightly and comes back — the settle at the bottom of the slot. */
  const easeOutBack = (t: number) => {
    const c = 1.24;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  /** Seated orientation: dead upright, facing the reader. */
  const UPRIGHT = new THREE.Quaternion();
  // Under reduced motion the insert/eject choreography still happens — it is state, not
  // decoration — but collapsed to near-cuts.
  const T_ALIGN = reducedMotion ? 0.1 : 0.26;
  const T_SINK = reducedMotion ? 0.14 : 0.42;
  const T_RISE = reducedMotion ? 0.14 : 0.5;
  /** Each card's resting attitude in the rack, precomputed so the loop only slerps. */
  const RACKED_QUATERNIONS: Record<string, any> = {};
  cartridgeList.forEach((item) => {
    RACKED_QUATERNIONS[item.spec.id] = new THREE.Quaternion().setFromEuler(item.homeRotation);
  });
  const target = new THREE.Vector3();

  const render = () => {
    const delta = Math.min(clock.getDelta(), 0.05);

    if (!reducedMotion) {
      parallax.lerp(parallaxTarget, 1 - Math.exp(-5 * delta));
      consoleGroup.rotation.y = parallax.x * 0.055;
      consoleGroup.rotation.x = -parallax.y * 0.035;
    }

    pressables.forEach((item) => {
      const down = pressedState.get(item.id) === true || held?.mesh === item.mesh;
      const pressTarget = item.restZ - (down ? 0.1 : 0);
      const current = item.mesh.position[item.axis];
      item.mesh.position[item.axis] = current + (pressTarget - current) * (1 - Math.exp(-24 * delta));
    });

    // The cartridge LED answers the slot: up while a card is in the machine.
    const cartridgeIn = cartridgeList.some((item) => item.state === "seated" || item.state === "sinking");
    cartLedMat.emissiveIntensity +=
      ((cartridgeIn ? 1 : 0.12) - cartLedMat.emissiveIntensity) * (1 - Math.exp(-8 * delta));

    // The slot announces itself once a cartridge is close enough to actually drop.
    const carriedDistance = dragging
      ? dragging.group.position.distanceTo(slotHoverPoint)
      : Infinity;
    const slotHot = carriedDistance < SNAP_RANGE ? 1 : 0;
    slotGlowMaterial.opacity += (slotHot * 0.55 - slotGlowMaterial.opacity) * (1 - Math.exp(-9 * delta));

    cartridgeList.forEach((item) => {
      const group = item.group;

      switch (item.state) {
        case "held": {
          // Square up to the viewer so the label stays readable in hand, and — once the
          // slot is in range — pull the last of the rotation out so it is already aligned
          // when the reader lets go. That pre-alignment is most of what makes the drop
          // feel like it clicked rather than snapped.
          const align = carriedDistance < SNAP_RANGE ? 1 - Math.exp(-14 * delta) : 1 - Math.exp(-8 * delta);
          group.rotation.y += (0 - group.rotation.y) * align;
          group.rotation.z += (0 - group.rotation.z) * align;
          group.rotation.x += (0 - group.rotation.x) * align;
          if (slotHot) {
            // A gentle magnet on the horizontal axis only: vertical stays under the
            // pointer, so the reader never feels the card fighting them.
            group.position.x += (slotHoverPoint.x - group.position.x) * (1 - Math.exp(-7 * delta));
            group.position.z += (slotHoverPoint.z - group.position.z) * (1 - Math.exp(-7 * delta));
          }
          break;
        }

        case "aligning": {
          // Stage one: travel to dead centre above the mouth, squaring up on the way.
          item.progress = Math.min(1, item.progress + delta / T_ALIGN);
          const t = easeOutCubic(item.progress);
          group.position.lerpVectors(item.from, slotHoverPoint, t);
          group.quaternion.slerpQuaternions(item.fromQuaternion, UPRIGHT, t);
          if (item.progress >= 1) {
            item.state = "sinking";
            item.progress = 0;
          }
          break;
        }

        case "sinking": {
          // Stage two: straight down the slot, decelerating, with a small overshoot at the
          // end so it settles against the seat instead of stopping dead.
          item.progress = Math.min(1, item.progress + delta / T_SINK);
          const t = easeOutBack(item.progress);
          group.position.set(
            slotHoverPoint.x,
            THREE.MathUtils.lerp(slotHoverPoint.y, slotSeatedPoint.y, t),
            slotHoverPoint.z,
          );
          group.quaternion.copy(UPRIGHT);
          if (item.progress >= 1) {
            item.state = "seated";
            options.onInsert(item.spec.id);
          }
          break;
        }

        case "seated": {
          group.position.copy(slotSeatedPoint);
          group.quaternion.copy(UPRIGHT);
          break;
        }

        case "rising": {
          // Ejecting: up and out first, then back to the rack — the reverse of going in,
          // so the two motions read as one mechanism.
          item.progress = Math.min(1, item.progress + delta / T_RISE);
          const t = easeInOutCubic(item.progress);
          const lift = Math.sin(Math.min(1, item.progress * 1.6) * Math.PI * 0.5);
          group.position.lerpVectors(item.from, item.homePosition, t);
          group.position.y += lift * (1 - t) * CART_H * 0.5;
          group.quaternion.slerpQuaternions(item.fromQuaternion, RACKED_QUATERNIONS[item.spec.id], t);
          if (item.progress >= 1) item.state = "racked";
          break;
        }

        case "racked":
        default: {
          const ease = 1 - Math.exp(-11 * delta);
          const lifted = hovered === item.spec.id;
          target.copy(item.homePosition);
          if (lifted) {
            // Hovering lifts a card part-way out of the rack, the way a finger would.
            target.y += 0.3;
            target.z += 0.6;
          }
          group.position.lerp(target, ease);
          group.quaternion.slerp(RACKED_QUATERNIONS[item.spec.id], ease);
          break;
        }
      }
    });

    renderer.render(scene, camera);
    css.render(cssScene, camera);
    frame = window.requestAnimationFrame(render);
  };
  render();

  return {
    setPressed: (id, down) => { pressedState.set(id, down); },
    setInserted: (id) => {
      cartridgeList.forEach((item) => {
        const shouldHold = item.spec.id === id;
        if (shouldHold && item.state !== "seated" && item.state !== "sinking") {
          item.from = item.group.position.clone();
          item.fromQuaternion = item.group.quaternion.clone();
          item.state = "aligning";
          item.progress = 0;
        } else if (!shouldHold && (item.state === "seated" || item.state === "sinking")) {
          item.from = item.group.position.clone();
          item.fromQuaternion = item.group.quaternion.clone();
          item.state = "rising";
          item.progress = 0;
        }
      });
    },
    dispose: () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      // Everything built here dies here — plates, keys, cartridges, decals and their
      // canvas textures in one sweep. Shared geometry is disposed more than once, which
      // three treats as a no-op.
      scene.traverse((object: any) => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material: any) => {
          material?.map?.dispose?.();
          material?.dispose?.();
        });
      });
      envTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      css.domElement.remove();
      // Hand the screen element back the way it arrived.
      screenElement.style.cssText = screenStyleSnapshot;
    },
  };
}
