import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";

export type IPhoneShowcaseMode = "preview" | "entering" | "live";

export type IPhoneScene = {
  setMode: (mode: IPhoneShowcaseMode) => void;
  resetView: () => void;
  setExploded: (exploded: boolean) => void;
  getDiagnostics: () => { meshes: number; triangles: number; parts: string[]; selectedPart: string | null };
  dispose: () => void;
};

type SceneOptions = {
  container: HTMLElement;
  screenElement: HTMLElement;
  posterUrl: string;
  onScreenTap: () => void;
  onLiveReady: () => void;
  onFatal?: () => void;
};

// Apple-published iPhone 17 Pro dimensions, scaled so 1 world unit = 10 mm.
export const IPHONE_17_PRO = {
  height: 15,
  width: 7.19,
  depth: 0.875,
  screenPixels: { width: 1206, height: 2622 },
} as const;

const BODY_H = IPHONE_17_PRO.height;
const BODY_W = IPHONE_17_PRO.width;
const BODY_D = IPHONE_17_PRO.depth;
const BODY_R = 0.92;
const FRONT_Z = BODY_D / 2;
const SCREEN_W = 6.56;
const SCREEN_H = SCREEN_W * (2622 / 1206);
const SCREEN_R = 0.78;
const SCREEN_CSS_W = 430;
const SCREEN_CSS_H = Math.round(SCREEN_CSS_W * (2622 / 1206));

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

function plate(width: number, height: number, depth: number, radius: number, fillet = 0.035) {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(width, height, radius), {
    depth: Math.max(0.01, depth - fillet * 2),
    bevelEnabled: true,
    bevelThickness: fillet,
    bevelSize: fillet,
    bevelSegments: 4,
    curveSegments: 22,
  });
  geometry.center();
  return geometry;
}

function roundedPlane(width: number, height: number, radius: number) {
  const geometry = new THREE.ShapeGeometry(roundedRect(width, height, radius), 48);
  geometry.center();
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(
      index,
      positions.getX(index) / width + 0.5,
      positions.getY(index) / height + 0.5,
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}

function makePosterTexture(url: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1206;
  canvas.height = 2622;
  const context = canvas.getContext("2d")!;
  const paintFallback = () => {
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#151b30");
    gradient.addColorStop(0.52, "#6f5cc7");
    gradient.addColorStop(1, "#101522");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,.9)";
    context.font = "600 70px -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText("JOI MOBILE", 80, 150);
    context.fillStyle = "rgba(255,255,255,.56)";
    context.font = "36px ui-monospace, SFMono-Regular, monospace";
    context.fillText("CHAT  /  MAP", 82, 214);
  };
  paintFallback();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    texture.needsUpdate = true;
  };
  image.src = url;
  return texture;
}

function createAppleMark(material: any) {
  const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`;
  const parsed = new SVGLoader().parse(svg);
  const artwork = new THREE.Group();
  artwork.name = "rear-product-mark-artwork";
  for (const [pathIndex, path] of parsed.paths.entries()) {
    for (const [shapeIndex, shape] of SVGLoader.createShapes(path).entries()) {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.38,
        bevelEnabled: true,
        bevelSize: 0.08,
        bevelThickness: 0.06,
        bevelSegments: 3,
        curveSegments: 28,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `rear-product-mark-shape-${pathIndex + 1}-${shapeIndex + 1}`;
      artwork.add(mesh);
    }
  }
  const scale = 0.05;
  artwork.scale.set(scale, -scale, scale);
  artwork.position.set(-12 * scale, 12 * scale, 0);
  return artwork;
}

function markShadows(object: any) {
  object.traverse((child: any) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export function createIPhone17ProScene(options: SceneOptions): IPhoneScene {
  const { container, screenElement } = options;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screenStyleSnapshot = screenElement.style.cssText;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:pan-y pinch-zoom;cursor:grab;";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;";
  container.appendChild(cssRenderer.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 31.5);

  const gradientCanvas = document.createElement("canvas");
  gradientCanvas.width = 32;
  gradientCanvas.height = 256;
  const gradientContext = gradientCanvas.getContext("2d")!;
  const environmentGradient = gradientContext.createLinearGradient(0, 0, 0, 256);
  environmentGradient.addColorStop(0, "#ffffff");
  environmentGradient.addColorStop(0.28, "#9ca8c7");
  environmentGradient.addColorStop(0.62, "#283451");
  environmentGradient.addColorStop(1, "#080b12");
  gradientContext.fillStyle = environmentGradient;
  gradientContext.fillRect(0, 0, 32, 256);
  const environmentTexture = new THREE.CanvasTexture(gradientCanvas);
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
  environmentTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(environmentTexture);
  scene.environment = environment.texture;
  environmentTexture.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xe6edff, 0x101625, 1.42));
  const key = new THREE.DirectionalLight(0xf1f5ff, 3.4);
  key.position.set(-7, 12, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 5;
  key.shadow.camera.far = 52;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.0008;
  key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9ceff, 1.65);
  fill.position.set(10, 2, 8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8298e5, 2.15);
  rim.position.set(2, 7, -11);
  scene.add(rim);
  const rearSoftbox = new THREE.RectAreaLight(0xdce5ff, 5.8, 8, 13);
  rearSoftbox.position.set(-8, 2.5, -9);
  rearSoftbox.lookAt(0, 1.5, 0);
  scene.add(rearSoftbox);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 52),
    new THREE.ShadowMaterial({ color: 0x12182a, opacity: 0.24 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -BODY_H / 2 - 0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const materials = {
    body: new THREE.MeshPhysicalMaterial({ color: 0x303a56, roughness: 0.36, metalness: 0.68, clearcoat: 0.16, clearcoatRoughness: 0.5, envMapIntensity: 1.25 }),
    edge: new THREE.MeshPhysicalMaterial({ color: 0x222c49, roughness: 0.3, metalness: 0.82, clearcoat: 0.2, clearcoatRoughness: 0.42, envMapIntensity: 1.38 }),
    plateau: new THREE.MeshPhysicalMaterial({ color: 0x2d3854, roughness: 0.34, metalness: 0.6, clearcoat: 0.18, clearcoatRoughness: 0.46, envMapIntensity: 1.3 }),
    frontGlass: new THREE.MeshPhysicalMaterial({ color: 0x03060d, roughness: 0.09, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.055, envMapIntensity: 1.55 }),
    rearGlass: new THREE.MeshPhysicalMaterial({ color: 0x3a4562, roughness: 0.43, metalness: 0.03, clearcoat: 0.48, clearcoatRoughness: 0.34, envMapIntensity: 1.15 }),
    ring: new THREE.MeshPhysicalMaterial({ color: 0x33415f, roughness: 0.24, metalness: 0.86, clearcoat: 0.3, clearcoatRoughness: 0.26, envMapIntensity: 1.55 }),
    innerRing: new THREE.MeshPhysicalMaterial({ color: 0x0a0e19, roughness: 0.2, metalness: 0.72, clearcoat: 0.28, envMapIntensity: 1.32 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x02040a, roughness: 0.055, metalness: 0.04, transmission: 0.06, thickness: 0.08, ior: 1.58, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.85 }),
    lensCoat: new THREE.MeshPhysicalMaterial({ color: 0x101d43, roughness: 0.045, metalness: 0.01, transparent: true, opacity: 0.28, transmission: 0.12, thickness: 0.05, ior: 1.62, iridescence: 0.5, iridescenceIOR: 1.32, iridescenceThicknessRange: [90, 210], clearcoat: 1, clearcoatRoughness: 0.018, envMapIntensity: 2.1 }),
    aperture: new THREE.MeshPhysicalMaterial({ color: 0x010204, roughness: 0.08, metalness: 0.1, clearcoat: 0.9 }),
    button: new THREE.MeshPhysicalMaterial({ color: 0x394665, roughness: 0.3, metalness: 0.78, clearcoat: 0.18, envMapIntensity: 1.4 }),
    black: new THREE.MeshPhysicalMaterial({ color: 0x010205, roughness: 0.16, metalness: 0.05, clearcoat: 0.75 }),
    flash: new THREE.MeshPhysicalMaterial({ color: 0xf2ebcf, roughness: 0.13, transmission: 0.22, thickness: 0.16, clearcoat: 0.72, emissive: 0x4b4531, emissiveIntensity: 0.24 }),
    mark: new THREE.MeshPhysicalMaterial({ color: 0x121a2d, roughness: 0.18, metalness: 0.78, clearcoat: 0.62, clearcoatRoughness: 0.16, envMapIntensity: 1.5 }),
    antenna: new THREE.MeshStandardMaterial({ color: 0x0b0e17, roughness: 0.8, metalness: 0 }),
  };

  const phone = new THREE.Group();
  phone.name = "iphone-17-pro-deep-blue";
  const cssPhone = new THREE.Group();
  scene.add(phone);
  cssScene.add(cssPhone);

  const explodeTargets: Array<{ object: any; base: any; offset: any }> = [];
  const registerExplode = (object: any, offset: [number, number, number]) => {
    explodeTargets.push({ object, base: object.position.clone(), offset: new THREE.Vector3(...offset) });
  };

  const shell = new THREE.Mesh(plate(BODY_W, BODY_H, BODY_D, BODY_R, 0.09), materials.body);
  shell.name = "body-shell";
  phone.add(shell);

  const edgeBand = new THREE.Mesh(plate(BODY_W - 0.035, BODY_H - 0.035, BODY_D + 0.035, BODY_R - 0.02, 0.055), materials.edge);
  edgeBand.name = "perimeter-edge-band";
  edgeBand.renderOrder = -1;
  phone.add(edgeBand);

  const frontGlass = new THREE.Mesh(plate(BODY_W - 0.19, BODY_H - 0.19, 0.085, BODY_R - 0.13, 0.028), materials.frontGlass);
  frontGlass.name = "front-ceramic-shield";
  frontGlass.position.z = FRONT_Z + 0.035;
  phone.add(frontGlass);
  registerExplode(frontGlass, [0, 0, 1.35]);

  const posterTexture = makePosterTexture(options.posterUrl);
  const posterMaterial = new THREE.MeshBasicMaterial({ map: posterTexture, toneMapped: false, side: THREE.FrontSide });
  const previewScreen = new THREE.Mesh(roundedPlane(SCREEN_W, SCREEN_H, SCREEN_R), posterMaterial);
  previewScreen.name = "preview-screen";
  previewScreen.position.z = FRONT_Z + 0.085;
  phone.add(previewScreen);

  const screenHit = new THREE.Mesh(
    roundedPlane(SCREEN_W, SCREEN_H, SCREEN_R),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide }),
  );
  screenHit.name = "screen-hit-plane";
  screenHit.position.z = FRONT_Z + 0.105;
  phone.add(screenHit);

  const rearGlass = new THREE.Mesh(plate(BODY_W - 0.42, 9.55, 0.08, 0.73, 0.025), materials.rearGlass);
  rearGlass.name = "rear-ceramic-shield";
  rearGlass.position.set(0, -2.15, -FRONT_Z - 0.045);
  rearGlass.rotation.y = Math.PI;
  phone.add(rearGlass);
  registerExplode(rearGlass, [0, 0, -1.35]);

  const plateau = new THREE.Mesh(plate(BODY_W - 0.16, 4.62, 0.22, 0.72, 0.055), materials.plateau);
  plateau.name = "full-width-camera-plateau";
  plateau.position.set(0, 4.98, -FRONT_Z - 0.11);
  plateau.rotation.y = Math.PI;
  phone.add(plateau);
  registerExplode(plateau, [0, 0.35, -1.55]);

  const logo = new THREE.Group();
  logo.name = "rear-product-mark";
  logo.add(createAppleMark(materials.mark));
  logo.rotation.y = Math.PI;
  logo.position.set(0, -1.08, -FRONT_Z - 0.105);
  phone.add(logo);
  registerExplode(logo, [0, 0, -1.6]);

  // World X is mirrored when the rear faces the camera. Positive local X
  // therefore produces Apple's left-weighted triangular rear array on screen.
  const lensPositions: Array<[number, number]> = [
    [1.58, 5.68],
    [1.54, 3.7],
    [-0.28, 4.58],
  ];
  const lensGroups: any[] = [];
  for (const [index, position] of lensPositions.entries()) {
    const group = new THREE.Group();
    group.name = `fusion-camera-${index + 1}`;
    group.position.set(position[0], position[1], -FRONT_Z - 0.22);

    const integratedWell = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.81, 0.12, 48, 2), materials.plateau);
    integratedWell.name = `camera-${index + 1}-well`;
    integratedWell.rotation.x = Math.PI / 2;
    integratedWell.position.z = -0.045;

    const machinedRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.095, 12, 52), materials.ring);
    machinedRing.name = `camera-${index + 1}-machined-ring`;
    machinedRing.position.z = -0.16;

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.61, 0.22, 48, 2), materials.innerRing);
    barrel.name = `camera-${index + 1}-barrel`;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.22;

    const innerBezel = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.035, 10, 48), materials.ring);
    innerBezel.name = `camera-${index + 1}-inner-bezel`;
    innerBezel.position.z = -0.34;

    const aperture = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.028, 36), materials.aperture);
    aperture.name = `camera-${index + 1}-aperture`;
    aperture.rotation.x = Math.PI / 2;
    aperture.position.z = -0.385;

    const opticalCenter = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 14), materials.lensCoat);
    opticalCenter.name = `camera-${index + 1}-optical-center`;
    opticalCenter.scale.z = 0.14;
    opticalCenter.position.z = -0.435;

    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.475, 36, 18), materials.lens);
    glass.name = `camera-${index + 1}-convex-glass`;
    glass.scale.z = 0.075;
    glass.position.z = -0.45;

    const coating = new THREE.Mesh(new THREE.SphereGeometry(0.445, 36, 18), materials.lensCoat);
    coating.name = `camera-${index + 1}-coating`;
    coating.scale.z = 0.055;
    coating.position.z = -0.475;

    const glint = new THREE.Mesh(
      new THREE.CircleGeometry(0.035, 20),
      new THREE.MeshBasicMaterial({ color: 0xdce5ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    glint.name = `camera-${index + 1}-glint`;
    glint.position.set(-0.16, 0.17, -0.51);

    group.add(integratedWell, machinedRing, barrel, innerBezel, aperture, opticalCenter, glass, coating, glint);
    phone.add(group);
    lensGroups.push(group);
    registerExplode(group, [(position[0] - 0.55) * 0.22, (position[1] - 4.5) * 0.25, -2.25]);
  }

  const flash = new THREE.Group();
  flash.name = "true-tone-flash";
  flash.position.set(-2.18, 5.58, -FRONT_Z - 0.28);
  const flashRim = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.49, 0.09, 56), materials.ring);
  flashRim.rotation.x = Math.PI / 2;
  const flashDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.4, 0.07, 56), materials.flash);
  flashDisc.rotation.x = Math.PI / 2;
  flashDisc.position.z = -0.075;
  const flashCap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 44, 20), materials.flash);
  flashCap.scale.z = 0.11;
  flashCap.position.z = -0.13;
  flash.add(flashRim, flashDisc, flashCap);
  phone.add(flash);
  registerExplode(flash, [-0.4, 0.25, -2]);

  const lidar = new THREE.Group();
  lidar.name = "lidar-window";
  lidar.position.set(-2.18, 3.43, -FRONT_Z - 0.285);
  const lidarRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.038, 14, 48), materials.ring);
  const lidarGlass = new THREE.Mesh(new THREE.SphereGeometry(0.305, 44, 20), materials.black);
  lidarGlass.scale.z = 0.12;
  lidarGlass.position.z = -0.07;
  lidar.add(lidarRim, lidarGlass);
  phone.add(lidar);
  registerExplode(lidar, [-0.4, -0.25, -2]);

  const rearMic = new THREE.Mesh(new THREE.SphereGeometry(0.082, 28, 16), materials.black);
  rearMic.name = "rear-microphone";
  rearMic.scale.z = 0.28;
  rearMic.position.set(-2.13, 4.49, -FRONT_Z - 0.335);
  phone.add(rearMic);
  registerExplode(rearMic, [-0.4, 0, -2]);

  const addSideButton = (name: string, y: number, height: number, depth: number, side: "left" | "right") => {
    const direction = side === "left" ? -1 : 1;
    const group = new THREE.Group();
    group.name = name;
    group.position.set(direction * BODY_W / 2, y, 0.01);

    const recess = new THREE.Mesh(
      new RoundedBoxGeometry(0.07, height + 0.12, depth + 0.08, 5, 0.032),
      materials.black,
    );
    recess.name = `${name}-recess`;
    const cap = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, height, depth, 6, 0.045),
      materials.button,
    );
    cap.name = `${name}-cap`;
    cap.position.x = direction * 0.065;
    group.add(recess, cap);
    phone.add(group);
    registerExplode(group, [direction * 1.45, 0, 0]);
  };
  addSideButton("action-button", 5.18, 0.62, 0.34, "left");
  addSideButton("volume-up", 3.93, 0.96, 0.34, "left");
  addSideButton("volume-down", 2.7, 0.96, 0.34, "left");
  addSideButton("side-button", 4.02, 1.52, 0.35, "right");
  addSideButton("camera-control", 0.94, 1.03, 0.27, "right");

  for (const [index, y] of [5.85, -5.85].entries()) {
    for (const x of [-1, 1]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.38, BODY_D + 0.025), materials.antenna);
      seam.name = `antenna-band-${index}-${x < 0 ? "left" : "right"}`;
      seam.position.set(x * (BODY_W / 2 + 0.012), y, 0);
      phone.add(seam);
    }
  }

  const port = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.095, 0.34, 4, 0.045), materials.black);
  port.name = "usb-c-opening";
  port.position.set(0, -BODY_H / 2 - 0.035, 0.015);
  phone.add(port);
  registerExplode(port, [0, -1.3, 0]);
  const perforationXs = [-2.35, -2.05, -1.75, -1.45, -1.15, 1.15, 1.45, 1.75, 2.05, 2.35];
  const perforationGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.12, 18);
  const perforations = new THREE.InstancedMesh(perforationGeometry, materials.black, perforationXs.length);
  perforations.name = "bottom-perforation-array";
  const instanceMatrix = new THREE.Matrix4();
  for (const [index, x] of perforationXs.entries()) {
    instanceMatrix.makeTranslation(x, -BODY_H / 2 - 0.055, 0.02);
    perforations.setMatrixAt(index, instanceMatrix);
  }
  perforations.instanceMatrix.needsUpdate = true;
  phone.add(perforations);

  const fastenerGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 20);
  const fasteners = new THREE.InstancedMesh(fastenerGeometry, materials.ring, 2);
  fasteners.name = "bottom-fastener-pair";
  for (const [index, x] of [-0.78, 0.78].entries()) {
    instanceMatrix.makeTranslation(x, -BODY_H / 2 - 0.055, 0.02);
    fasteners.setMatrixAt(index, instanceMatrix);
  }
  fasteners.instanceMatrix.needsUpdate = true;
  phone.add(fasteners);

  markShadows(phone);

  screenElement.style.width = `${SCREEN_CSS_W}px`;
  screenElement.style.height = `${SCREEN_CSS_H}px`;
  screenElement.style.opacity = "0";
  screenElement.style.pointerEvents = "none";
  screenElement.style.overflow = "hidden";
  screenElement.style.borderRadius = "52px";
  screenElement.style.clipPath = "inset(0 round 52px)";
  screenElement.style.contain = "paint";
  screenElement.style.background = "#060914";
  screenElement.style.transition = reducedMotion ? "none" : "opacity 180ms ease";
  const liveScreen = new CSS3DObject(screenElement);
  liveScreen.name = "live-joi-mobile-screen";
  liveScreen.scale.setScalar(SCREEN_W / SCREEN_CSS_W);
  liveScreen.position.z = FRONT_Z + 0.102;
  cssPhone.add(liveScreen);

  // CSS3DObject's constructor forces pointer-events back to auto. This DOM
  // surface is only a parked poster in preview mode, so restore the intended
  // non-interactive state after construction and let the WebGL canvas receive
  // drag/tap gestures.
  screenElement.style.pointerEvents = "none";

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let mode: IPhoneShowcaseMode = "preview";
  let yaw = -0.42;
  let pitch = 0.08;
  let targetYaw = yaw;
  let targetPitch = pitch;
  let yawVelocity = 0;
  let pitchVelocity = 0;
  let cameraDistance = 31.5;
  let targetDistance = 31.5;
  let liveReadySent = false;
  let explodedMix = 0;
  let explodedTarget = 0;
  let pointerId: number | null = null;
  let pointerType = "mouse";
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;
  let horizontalTouch = false;
  let suppressNextClick = false;
  let disposed = false;
  let frame = 0;
  let idleSince = performance.now();

  const namedParts: string[] = Array.from(new Set<string>(
    phone.children
      .map((child: any) => String(child.name || ""))
      .filter(Boolean),
  ));
  let selectedPart: string | null = null;
  const collectDiagnostics = () => {
    let meshes = 0;
    let triangles = 0;
    phone.traverse((child: any) => {
      if (!child.isMesh || !child.geometry) return;
      meshes += 1;
      const index = child.geometry.getIndex?.();
      const position = child.geometry.getAttribute?.("position");
      triangles += Math.round((index?.count ?? position?.count ?? 0) / 3);
    });
    return { meshes, triangles, parts: namedParts, selectedPart };
  };
  phone.userData.sculptRuntime = {
    parts: namedParts,
    explodeTargets: explodeTargets.map(({ object }) => object.name),
    selectedPart,
    getDiagnostics: collectDiagnostics,
  };
  const initialDiagnostics = collectDiagnostics();
  container.dataset.modelMeshes = String(initialDiagnostics.meshes);
  container.dataset.modelTriangles = String(initialDiagnostics.triangles);
  container.dataset.modelParts = String(initialDiagnostics.parts.length);

  const setLiveDom = (visible: boolean) => {
    screenElement.style.opacity = visible ? "1" : "0";
    screenElement.style.pointerEvents = visible ? "auto" : "none";
    previewScreen.visible = !visible;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (mode === "live" || event.button > 0) return;
    pointerId = event.pointerId;
    pointerType = event.pointerType;
    downX = lastX = event.clientX;
    downY = lastY = event.clientY;
    dragging = false;
    horizontalTouch = false;
    yawVelocity = 0;
    pitchVelocity = 0;
    idleSince = performance.now();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || mode === "live") return;
    const totalX = event.clientX - downX;
    const totalY = event.clientY - downY;
    if (!dragging && Math.hypot(totalX, totalY) >= 6) {
      if (pointerType === "touch" && Math.abs(totalY) > Math.abs(totalX) * 1.08) return;
      dragging = true;
      horizontalTouch = pointerType === "touch";
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    }
    if (!dragging) return;
    if (horizontalTouch) event.preventDefault();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const scale = pointerType === "touch" ? 0.011 : 0.008;
    targetYaw += dx * scale;
    targetPitch = THREE.MathUtils.clamp(targetPitch + dy * scale * 0.72, -0.49, 0.49);
    yawVelocity = dx * scale * 0.34;
    pitchVelocity = dy * scale * 0.18;
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const tapScreen = (event: MouseEvent | PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(screenHit, false)[0];
    if (hit) {
      options.onScreenTap();
      return true;
    }

    const partHit = raycaster.intersectObject(phone, true)[0];
    if (!partHit) return false;

    // The fully transparent screen hit plane can be skipped by some WebGL/browser
    // combinations. A stationary tap on the visible front of the phone should
    // still follow the native-demo link; pointer movement is already filtered by
    // onPointerUp, so this does not turn a drag into an accidental navigation.
    if (Math.cos(yaw) > 0.45) {
      options.onScreenTap();
      return true;
    }

    let part = partHit.object;
    while (part.parent && part.parent !== phone) part = part.parent;
    selectedPart = part.name || partHit.object.name || null;
    phone.userData.sculptRuntime.selectedPart = selectedPart;
    container.dispatchEvent(new CustomEvent("iphonepartselect", { detail: { name: selectedPart } }));
    return false;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    suppressNextClick = dragging || (!dragging && mode === "preview" && tapScreen(event));
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    pointerId = null;
    dragging = false;
    horizontalTouch = false;
    renderer.domElement.style.cursor = mode === "live" ? "default" : "grab";
    idleSince = performance.now();
  };

  const onClick = (event: MouseEvent) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    // Keep a conventional click fallback in addition to the WebGL raycast. It
    // makes the whole stationary 3D presentation a dependable external-link
    // target when a browser does not forward pointer events to transparent
    // WebGL geometry. Dragging is excluded by suppressNextClick above.
    if (mode === "preview") options.onScreenTap();
  };

  const onWheel = (event: WheelEvent) => {
    if (mode === "live") return;
    event.preventDefault();
    targetDistance = THREE.MathUtils.clamp(targetDistance + event.deltaY * 0.012, 25.5, 37.5);
    idleSince = performance.now();
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerUp);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  const onContextLost = (event: Event) => { event.preventDefault(); options.onFatal?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    cssRenderer.setSize(width, height);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const animate = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const returning = mode === "entering" || mode === "live";
    if (returning) {
      targetYaw = 0;
      targetPitch = 0;
      targetDistance = 31.5;
      yawVelocity = 0;
      pitchVelocity = 0;
    } else if (!reducedMotion && !dragging && now - idleSince > 2400) {
      targetYaw += 0.0017;
    } else if (!dragging) {
      targetYaw += yawVelocity;
      targetPitch = THREE.MathUtils.clamp(targetPitch + pitchVelocity, -0.49, 0.49);
      yawVelocity *= 0.92;
      pitchVelocity *= 0.9;
    }
    const smoothing = reducedMotion ? 1 : returning ? 0.12 : 0.16;
    yaw += (targetYaw - yaw) * smoothing;
    pitch += (targetPitch - pitch) * smoothing;
    cameraDistance += (targetDistance - cameraDistance) * 0.12;
    phone.rotation.set(pitch, yaw, 0);
    cssPhone.rotation.copy(phone.rotation);
    phone.position.y = reducedMotion ? 0 : Math.sin(now * 0.00075) * 0.055;
    cssPhone.position.y = phone.position.y;
    camera.position.z = cameraDistance;
    camera.lookAt(0, 0, 0);

    explodedMix += (explodedTarget - explodedMix) * (reducedMotion ? 1 : 0.12);
    for (const target of explodeTargets) {
      target.object.position.copy(target.base).addScaledVector(target.offset, explodedMix);
    }

    if (mode === "entering" && Math.abs(yaw) < 0.012 && Math.abs(pitch) < 0.012 && !liveReadySent) {
      liveReadySent = true;
      mode = "live";
      setLiveDom(true);
      options.onLiveReady();
    }

    renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);
  };
  frame = requestAnimationFrame(animate);

  const disposables = new Set<any>();
  scene.traverse((child: any) => {
    if (child.geometry) disposables.add(child.geometry);
    const list = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of list) disposables.add(material);
  });

  return {
    setMode(nextMode) {
      mode = nextMode;
      liveReadySent = false;
      if (nextMode === "preview") {
        setLiveDom(false);
        renderer.domElement.style.pointerEvents = "auto";
        renderer.domElement.style.cursor = "grab";
        idleSince = performance.now();
      } else {
        renderer.domElement.style.cursor = "default";
        if (nextMode === "live") setLiveDom(true);
      }
    },
    resetView() {
      targetYaw = -0.42;
      targetPitch = 0.08;
      targetDistance = 31.5;
      yawVelocity = 0;
      pitchVelocity = 0;
    },
    setExploded(exploded) {
      explodedTarget = exploded ? 1 : 0;
    },
    getDiagnostics() {
      return collectDiagnostics();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      posterTexture.dispose();
      environment.dispose();
      for (const disposable of disposables) disposable.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
      cssRenderer.domElement.remove();
      delete container.dataset.modelMeshes;
      delete container.dataset.modelTriangles;
      delete container.dataset.modelParts;
      screenElement.style.cssText = screenStyleSnapshot;
    },
  };
}
