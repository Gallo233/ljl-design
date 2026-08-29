import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

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

// Apple iPhone 17 Pro dimensions. The downloaded product-viewer model already
// uses this scale, so its geometry is never stretched or rebuilt here.
export const IPHONE_17_PRO = {
  height: 15,
  width: 7.19,
  depth: 0.875,
  screenPixels: { width: 1206, height: 2622 },
} as const;

const APPLE_MODEL_URL = "/models/apple/iphone-17-pro/iphone-17-pro.gltf";
const SCREEN_W = 6.78;
const SCREEN_H = SCREEN_W * (2622 / 1206);
const SCREEN_R = 0.8;
// Apple's product asset faces toward local -Z after applying its scene orientation.
const SCREEN_Z = -0.465;

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

function roundedPlane(width: number, height: number, radius: number) {
  const geometry = new THREE.ShapeGeometry(roundedRect(width, height, radius), 48);
  geometry.center();
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, positions.getX(index) / width + 0.5, positions.getY(index) / height + 0.5);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function disposeObject(root: any) {
  const textures = new Set<any>();
  const materials = new Set<any>();
  root.traverse((child: any) => {
    child.geometry?.dispose?.();
    const list = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of list) {
      if (materials.has(material)) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if ((value as any)?.isTexture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.dispose?.();
  for (const material of materials) material.dispose?.();
}

function applyCosmicOrangeFinish(root: any) {
  // Linear RGB values sampled from Apple's own `Orange` material state. The
  // product-viewer stores the large exterior surfaces as white tintable maps;
  // Three.js needs the state colour applied explicitly to reproduce that finish.
  const orange = new THREE.Color().setRGB(0.848088026, 0.178384006, 0.067579001);
  const tintableExterior = new Set([
    "nSmEHnzXDmvmgTy", // rear glass panel
    "YmlPswXiJMnOhti", // rear panel overlay
    "vXbOrtDfSZOxrnw", // enclosure
    "nMamqgjONGIzYTV", // camera enclosure
    "ZKNefuAUcItylcT", // camera plateau
  ]);
  const officialOverrides = new Map<string, { color: [number, number, number]; metalness?: number; roughness?: number }>([
    ["NtNSwEIIFmIbXaY", { color: [0.54, 0.11, 0.03], metalness: 0.7, roughness: 0.5 }],
    ["rDxDuNUnYMxIFFC", { color: [0.477, 0.111424, 0.046873] }],
    ["opLCHWKegPYqnYR", { color: [0.477, 0.111424, 0.046873], metalness: 0.9, roughness: 1.5 }],
    ["TsCoKngnEdcjZrd", { color: [0.807345986, 0.200716004, 0.060574699] }],
    ["PVNXZIVJlvoNsqb", { color: [0.575, 0.122, 0.027], metalness: 0.5 }],
    ["bITIVwEieGnzTxC", { color: [0.575, 0.122, 0.027] }],
    ["stlMkdXkRsspsoE", { color: [0.848088026, 0.178384006, 0.067579001] }],
    ["fLpLdljdfBpqXkO", { color: [0.848088026, 0.178384006, 0.067579001] }],
    ["VNJQamgZCBwIlKo", { color: [1, 0.26, 0.09] }],
    ["kZkIRyfgTGLpwyO", { color: [0.9, 0.3, 0.05], roughness: 0.4 }],
  ]);

  root.traverse((child: any) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material?.color) continue;
      if (tintableExterior.has(material.name)) material.color.copy(orange);
      const override = officialOverrides.get(material.name);
      if (override) {
        material.color.setRGB(...override.color);
        if (override.metalness != null) material.metalness = override.metalness;
        if (override.roughness != null) material.roughness = override.roughness;
      }
      material.needsUpdate = true;
    }
  });
}

export function createIPhone17ProScene(options: SceneOptions): IPhoneScene {
  const { container, screenElement } = options;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reviewView = new URLSearchParams(window.location.search).get("modelReview");
  const fixedReviewView = reviewView === "front" || reviewView === "rear" || reviewView === "left" || reviewView === "right";
  const screenStyleSnapshot = screenElement.style.cssText;

  container.dataset.modelSource = "apple-official";
  container.dataset.modelReady = "loading";
  if (fixedReviewView) {
    container.dataset.reviewView = reviewView;
    document.documentElement.dataset.modelReview = reviewView;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:pan-y pinch-zoom;cursor:grab;";
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 33);

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

  scene.add(new THREE.HemisphereLight(0xe6edff, 0x101625, 1.1));
  const key = new THREE.DirectionalLight(0xf5f7ff, 2.8);
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
  const fill = new THREE.DirectionalLight(0xb9ceff, 1.0);
  fill.position.set(10, 2, 8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8298e5, 1.5);
  rim.position.set(2, 7, -11);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 52),
    new THREE.ShadowMaterial({ color: 0x12182a, opacity: 0.22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -IPHONE_17_PRO.height / 2 - 0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const phone = new THREE.Group();
  phone.name = "apple-iphone-17-pro";
  const officialFrame = new THREE.Group();
  officialFrame.name = "apple-product-viewer-orientation";
  // Exact orientation used by Apple's iPhone17Pro_US_L product-viewer scene.
  officialFrame.rotation.set(-Math.PI / 2, Math.PI, 0, "XYZ");
  phone.add(officialFrame);
  scene.add(phone);

  const screenHit = new THREE.Mesh(
    roundedPlane(SCREEN_W, SCREEN_H, SCREEN_R),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  screenHit.name = "joi-mobile-screen-hit-area";
  screenHit.position.z = SCREEN_Z - 0.015;
  screenHit.rotation.y = Math.PI;
  screenHit.material.side = THREE.DoubleSide;
  phone.add(screenHit);

  screenElement.style.opacity = "0";
  screenElement.style.pointerEvents = "none";

  type ExplodeTarget = { object: any; base: any; offset: any };
  const explodeTargets: ExplodeTarget[] = [];
  let officialModel: any = null;
  let disposed = false;
  const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);
  const gltfLoader = new GLTFLoader().setKTX2Loader(ktx2Loader);

  let selectedPart: string | null = null;
  let namedParts: string[] = [];
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
  const publishDiagnostics = () => {
    const diagnostics = collectDiagnostics();
    container.dataset.modelMeshes = String(diagnostics.meshes);
    container.dataset.modelTriangles = String(diagnostics.triangles);
    container.dataset.modelParts = String(diagnostics.parts.length);
  };
  publishDiagnostics();

  gltfLoader.load(
    APPLE_MODEL_URL,
    (gltf: any) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      officialModel = gltf.scene;
      officialModel.name = "apple-official-iphone-17-pro-model";
      applyCosmicOrangeFinish(officialModel);
      officialModel.traverse((child: any) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
      });
      officialFrame.add(officialModel);

      const bounds = new THREE.Box3().setFromObject(phone);
      const center = bounds.getCenter(new THREE.Vector3());
      // Apple's asset is centered to engineering coordinates. Remove only any
      // residual export offset; the model's dimensions and proportions are untouched.
      officialModel.position.x -= center.x;
      officialModel.position.y -= center.y;

      namedParts = [];
      officialModel.traverse((child: any) => {
        if (!child.isMesh) return;
        const name = String(child.name || child.parent?.name || `mesh-${namedParts.length + 1}`);
        namedParts.push(name);
        const worldCenter = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
        const offset = worldCenter.clone().sub(new THREE.Vector3(0, 0, 0));
        if (offset.lengthSq() < 0.001) offset.set(0, 0, child.position.z >= 0 ? 1 : -1);
        offset.normalize().multiplyScalar(1.25);
        explodeTargets.push({ object: child, base: child.position.clone(), offset });
      });
      namedParts = Array.from(new Set(namedParts));
      phone.userData.sculptRuntime = { source: "apple-official", parts: namedParts, getDiagnostics: collectDiagnostics };
      container.dataset.modelReady = "true";
      publishDiagnostics();
    },
    undefined,
    (error: unknown) => {
      if (disposed) return;
      container.dataset.modelReady = "false";
      console.error("Unable to load Apple iPhone 17 Pro product-viewer model", error);
      options.onFatal?.();
    },
  );

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let mode: IPhoneShowcaseMode = "preview";
  const reviewYaw = reviewView === "front"
    ? Math.PI
    : reviewView === "left"
      ? Math.PI / 2
      : reviewView === "right"
        ? -Math.PI / 2
        : 0;
  let yaw = fixedReviewView ? reviewYaw : Math.PI - 0.42;
  let pitch = fixedReviewView ? 0 : 0.08;
  let targetYaw = yaw;
  let targetPitch = pitch;
  let yawVelocity = 0;
  let pitchVelocity = 0;
  let cameraDistance = 33;
  let targetDistance = 33;
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
  let frame = 0;
  let idleSince = performance.now();

  const setLiveDom = () => {
    // Deliberately show Apple's native display material with no simulator art.
    screenElement.style.opacity = "0";
    screenElement.style.pointerEvents = "none";
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
    if (raycaster.intersectObject(screenHit, false)[0]) {
      options.onScreenTap();
      return true;
    }
    const partHit = officialModel ? raycaster.intersectObject(officialModel, true)[0] : null;
    if (!partHit) return false;
    selectedPart = partHit.object.name || partHit.object.parent?.name || null;
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

  const onClick = () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (mode === "preview") options.onScreenTap();
  };

  const onWheel = (event: WheelEvent) => {
    if (mode === "live") return;
    event.preventDefault();
    targetDistance = THREE.MathUtils.clamp(targetDistance + event.deltaY * 0.012, 27, 39.5);
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
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const animate = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const returning = mode === "entering" || mode === "live";
    if (fixedReviewView) {
      targetYaw = reviewYaw;
      targetPitch = 0;
      targetDistance = 33;
      yawVelocity = 0;
      pitchVelocity = 0;
    } else if (returning) {
      targetYaw = 0;
      targetPitch = 0;
      targetDistance = 33;
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
    phone.position.y = reducedMotion || fixedReviewView ? 0 : Math.sin(now * 0.00075) * 0.055;
    camera.position.z = cameraDistance;
    camera.lookAt(0, 0, 0);

    explodedMix += (explodedTarget - explodedMix) * (reducedMotion ? 1 : 0.12);
    for (const target of explodeTargets) {
      target.object.position.copy(target.base).addScaledVector(target.offset, explodedMix);
    }

    if (mode === "entering" && Math.abs(yaw) < 0.012 && Math.abs(pitch) < 0.012 && !liveReadySent) {
      liveReadySent = true;
      mode = "live";
      setLiveDom();
      options.onLiveReady();
    }
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(animate);

  return {
    setMode(nextMode) {
      mode = nextMode;
      liveReadySent = false;
      if (nextMode === "preview") {
        setLiveDom();
        renderer.domElement.style.pointerEvents = "auto";
        renderer.domElement.style.cursor = "grab";
        idleSince = performance.now();
      } else {
        renderer.domElement.style.cursor = "default";
        if (nextMode === "live") setLiveDom();
      }
    },
    resetView() {
      targetYaw = Math.PI - 0.42;
      targetPitch = 0.08;
      targetDistance = 33;
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
      ktx2Loader.dispose();
      environment.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      delete container.dataset.modelMeshes;
      delete container.dataset.modelTriangles;
      delete container.dataset.modelParts;
      delete container.dataset.modelSource;
      delete container.dataset.modelReady;
      delete container.dataset.reviewView;
      if (fixedReviewView) delete document.documentElement.dataset.modelReview;
      screenElement.style.cssText = screenStyleSnapshot;
    },
  };
}
