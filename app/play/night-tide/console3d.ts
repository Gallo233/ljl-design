import * as THREE from "three";
import { HANDHELD, loadHandheldAsset } from "./handheldAsset";
import { createScreenProjection } from "./screenProjection";
import { SCREEN_WIDTH, type GameButton } from "./games";
import { detectQuality } from "../../joi-signal-lab/quality";

/**
 * Blender-authored POCKET-NT, with live DOM display and articulated GLB controls.
 * Editable source: assets/3d/pocket-nt.blend; recipe: scripts/blender/build_handheld.py.
 *
 * ### Why the screen stays DOM
 *
 * The screen has to stay real DOM. Night Tide is a Godot build in an `<iframe>`, and no
 * browser will let an iframe become a WebGL texture — a fully-textured 3D screen would cost
 * us the one game that was already here. A CSS homography from the WebGL camera projects
 * screen pixels directly onto the model's display plane. There is no second CSS camera
 * whose perspective/origin can drift from the canvas under browser zoom.
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

const SCREEN_W = HANDHELD.screenWidth;
const SCREEN_H = HANDHELD.screenHeight;
const BODY_W = HANDHELD.width;
const BODY_H = HANDHELD.height;
const BODY_D = HANDHELD.depth;
const CART_W = 2.05;
const CART_H = 2.95;
const CART_D = 0.34;

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
  amethyst: "#b6a2cf",
} as const;

export function createConsoleScene(options: ConsoleSceneOptions): ConsoleScene {
  const { container, screenElement, cartridges } = options;
  const interactive = options.isInteractive ?? (() => true);
  /*
   * The same device tiers the stage renderer uses.
   *
   * This scene was built asking for everything unconditionally — full MSAA, soft
   * shadows, a 1024² shadow map, its own pixel-ratio ladder — while `quality.ts`
   * sat next door deciding exactly these questions for the rest of the site. A
   * phone that gets a downgraded hero was still being handed the most expensive
   * version of the handheld.
   */
  const tier = detectQuality();
  const reducedMotion = tier.reducedMotion;

  // The projected display rewrites the screen element's inline style (position, pointer-events, a
  // per-frame matrix3d). Snapshot it now so dispose can hand the element back unchanged.
  const screenStyleSnapshot = screenElement.style.cssText;

  const renderer = new THREE.WebGLRenderer({ antialias: tier.antialias, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;";
  // The canvas is decoration to assistive tech — the live screen (boot status, game canvas,
  // Godot iframe) lives in the projected DOM layer, which must stay visible to the accessibility tree.
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const onContextLost = (event: Event) => {
    // Deliberately *not* calling preventDefault(). That call is a promise to the
    // browser that this renderer will rebuild itself on `webglcontextrestored`,
    // and nothing here listens for that event — the shell folds to the flat DOM
    // fallback and stays there. Making the promise and not keeping it only costs
    // the reader the restore the browser would otherwise have driven itself.
    options.onFatal?.();
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  const displayLayer = document.createElement("div");
  displayLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
  container.appendChild(displayLayer);

  const scene = new THREE.Scene();
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
  key.castShadow = tier.shadows;
  // Half-resolution where memory is tight; the map is only ever cast by one small object.
  key.shadow.mapSize.setScalar(tier.reducedMemory ? 512 : 1024);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 52;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.0011;
  // No `shadow.radius` here: it is read only under SHADOWMAP_TYPE_PCF (see
  // three/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js), and this
  // renderer asks for PCF_SOFT. Setting it looked like a softness control and was not one.
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

  // The shell and every control come from Blender. Only moving cartridges and
  // the slot's interaction highlight are generated at runtime.
  const consoleGroup = new THREE.Group();
  consoleGroup.name = "game-center-handheld";
  scene.add(consoleGroup);
  type Pressable = { mesh: any; id: GameButton; restZ: number; axis: "z" | "y" };
  const pressables: Pressable[] = [];
  let cartLedMat: any = null;
  let modelLoaded = false;
  let modelDisposed = false;
  const handheld = loadHandheldAsset({
    onReady(asset) {
      modelLoaded = true;
      pressables.push(...asset.controls);
      cartLedMat = asset.cartridgeLight;
      consoleGroup.userData.sculptRuntime.nodes = { root: consoleGroup, ...asset.nodes };
      container.dataset.handheldModel = "blender";
      container.dataset.handheldTriangles = String(asset.triangles);
      container.dataset.handheldMeshes = String(asset.meshes);
    },
    onError() {
      if (!modelDisposed) options.onFatal?.();
    },
  });
  consoleGroup.add(handheld.group);
  screenElement.style.position = "absolute";
  screenElement.style.left = "0";
  screenElement.style.top = "0";
  screenElement.style.transformOrigin = "0 0";
  screenElement.style.pointerEvents = "auto";
  screenElement.style.userSelect = "none";
  screenElement.style.borderRadius = `${0.045 * SCREEN_WIDTH / SCREEN_W}px`;
  displayLayer.appendChild(screenElement);
  const projectScreen = createScreenProjection(SCREEN_W, SCREEN_H, HANDHELD.screenY, HANDHELD.screenZ, SCREEN_WIDTH);
  let viewportWidth = 1;
  let viewportHeight = 1;
  const screenCorners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  const screenProbes: HTMLElement[] = [];
  // Development-only corner probes catch DOM/canvas drift numerically, including
  // during pointer tilt. No layout reads or probe elements are shipped in production.
  if (process.env.NODE_ENV !== "production") {
    screenCorners.forEach(([x, y]) => {
      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = `position:absolute;left:${x < 0 ? 0 : 100}%;top:${y > 0 ? 0 : 100}%;width:0;height:0;pointer-events:none;`;
      screenElement.appendChild(probe);
      screenProbes.push(probe);
    });
  }
  let screenProbeTime = 0;

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

  // The actual lip/well are authored in the GLB. This group owns only the
  // transient drop-target light and uses the same top-edge socket coordinates.
  const SLOT_Z = -0.12;
  const slotGroup = new THREE.Group();
  slotGroup.position.set(0, BODY_H / 2, SLOT_Z);
  consoleGroup.add(slotGroup);

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

  // Preserve the structural inspection contract with imported semantic nodes.
  const explodeBases = new Map<any, any>();
  consoleGroup.userData.sculptRuntime = {
    nodes: { root: consoleGroup },
    sockets: {
      cartridgeSeat: { position: slotSeatedPoint.clone(), axis: new THREE.Vector3(0, 1, 0), gapTolerance: 0.01 },
    },
    colliders: {
      body: { type: "box", size: [BODY_W, BODY_H, BODY_D] },
      screen: { type: "box", size: [SCREEN_W, SCREEN_H, 0.12] },
      cartridge: { type: "box", size: [CART_W, CART_H, CART_D] },
    },
    resolvePart(object: any) {
      let node = object;
      while (node && node !== consoleGroup) {
        if (node.userData?.assembly) return node.userData.assembly;
        node = node.parent;
      }
      return object.name || "root";
    },
    setExploded(amount = 0) {
      const distance = THREE.MathUtils.clamp(amount, 0, 1);
      handheld.group.children[0]?.children.forEach((node: any, index: number) => {
        if (!explodeBases.has(node)) explodeBases.set(node, node.position.clone());
        node.position.copy(explodeBases.get(node));
        node.position.z += distance * (0.3 + index * 0.07);
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

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, tier.dprCap, 1.4),
    );
    renderer.setSize(w, h, false);
    viewportWidth = w;
    viewportHeight = h;
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
    if (!interactive() || !modelLoaded) return;

    const buttonHit = hit(pressables.map((item) => item.mesh));
    const cartHit = hit(loose());
    // Whichever is actually nearer the camera wins, so a cartridge held in front of the
    // machine does not fall through onto a button behind it.
    if (buttonHit && (!cartHit || buttonHit.distance <= cartHit.distance)) {
      const id = buttonHit.object.userData.button as GameButton;
      held = { mesh: pressables.find((item) => item.id === id)!.mesh, id };
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
      // The live screen normally eats pointer events over its rectangle. While a card is
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
    if (cartLedMat) cartLedMat.emissiveIntensity +=
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
    if (process.env.NODE_ENV !== "production") {
      container.dataset.handheldDrawCalls = String(renderer.info.render.calls);
      container.dataset.handheldRenderTriangles = String(renderer.info.render.triangles);
    }
    // renderer.render has updated the camera and model's matrices for this frame.
    screenElement.style.transform = projectScreen(camera, consoleGroup.matrixWorld, viewportWidth, viewportHeight);
    if (screenProbes.length && performance.now() - screenProbeTime > 250) {
      screenProbeTime = performance.now();
      const bounds = container.getBoundingClientRect();
      container.dataset.screenFit = JSON.stringify(screenCorners.map(([x, y], index) => {
        const projected = new THREE.Vector3(x * SCREEN_W / 2, HANDHELD.screenY + y * SCREEN_H / 2, HANDHELD.screenZ)
          .applyMatrix4(consoleGroup.matrixWorld).project(camera);
        const expected = [bounds.left + (projected.x + 1) * bounds.width / 2, bounds.top + (1 - projected.y) * bounds.height / 2];
        const actual = screenProbes[index].getBoundingClientRect();
        return { expected, actual: [actual.x, actual.y], error: Math.hypot(actual.x - expected[0], actual.y - expected[1]) };
      }));
    }
    frame = window.requestAnimationFrame(render);
  };

  /*
   * The machine stops drawing when it is not on screen.
   *
   * The loop ran from mount to unmount regardless: scrolling past the game centre left
   * a full-rate WebGL render, a screen projection and the whole cartridge simulation running
   * behind the reader for the rest of the visit. On a phone that is the page's entire
   * frame budget going to something nobody is looking at.
   *
   * `clock.getDelta()` is drained on resume so the paused time is not delivered as one
   * enormous step — the loop clamps it anyway, but draining says why.
   */
  let onScreen = true;
  const startLoop = () => {
    if (frame) return;
    clock.getDelta();
    frame = window.requestAnimationFrame(render);
  };
  const stopLoop = () => {
    if (!frame) return;
    window.cancelAnimationFrame(frame);
    frame = 0;
  };
  const visibility = new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen) startLoop();
      else stopLoop();
    },
    { threshold: 0 },
  );
  visibility.observe(container);
  startLoop();

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
      if (modelDisposed) return;
      modelDisposed = true;
      handheld.dispose();
      screenProbes.forEach((probe) => probe.remove());
      delete container.dataset.screenFit;
      delete container.dataset.handheldModel;
      delete container.dataset.handheldTriangles;
      delete container.dataset.handheldMeshes;
      delete container.dataset.handheldDrawCalls;
      delete container.dataset.handheldRenderTriangles;
      window.cancelAnimationFrame(frame);
      visibility.disconnect();
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
      displayLayer.remove();
      // Hand the screen element back the way it arrived.
      screenElement.style.cssText = screenStyleSnapshot;
    },
  };
}
