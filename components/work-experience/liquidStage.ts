import * as THREE from "three";

/*
 * Living Aperture material.
 *
 * The rounded-box union, swept-box bridge, negative-radius dissolution and
 * capillary wake are adapted from Viscose Carousel.
 * MIT License, Copyright (c) 2026 Yousuf Soomro.
 *
 * This is a PROJECT composition: the source ring is intentionally replaced by
 * four DOM-aligned portfolio states. Source evidence and hashes live in
 * docs/shader-research/viscose-carousel-2026-08/.web-shader-extractor/.
 */

const MAX_SHAPES = 4;
const MAX_LINKS = 3;

const vertexShader = /* glsl */ `
  // The field only ever covers the cards and the threads between them, but the
  // quad used to cover the viewport, so every pixel of dead background still
  // paid for four rounded boxes and three swept bridges. uBounds is the active
  // region in clip space (centre.xy, half-extent.zw); vUv is derived from the
  // clip position so screen mapping downstream is unchanged.
  uniform vec4 uBounds;
  varying vec2 vUv;
  void main() {
    vec2 ndc = uBounds.xy + position.xy * uBounds.zw;
    vUv = ndc * 0.5 + 0.5;
    gl_Position = vec4(ndc, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  #define MAX_SHAPES ${MAX_SHAPES}
  #define MAX_LINKS ${MAX_LINKS}

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec4 uShapes[MAX_SHAPES];
  uniform vec4 uShapeMeta[MAX_SHAPES];
  uniform vec2 uLinkA[MAX_LINKS];
  uniform vec2 uLinkB[MAX_LINKS];
  uniform vec4 uLinkPar[MAX_LINKS];
  uniform vec4 uMouse;
  uniform vec4 uMelt;
  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform vec3 uPaper;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  float smin(float a, float b, float k) {
    if (k <= 0.0001) return min(a, b);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Source geometry: a swept box, not a capsule. Square ends stay buried in
  // the cards and the centre can pinch and sag without bulging their flat sides.
  float sdBridge(vec2 p, vec2 a, vec2 b, float rEnd, float rMid, float sag) {
    vec2 ba = b - a;
    float len = length(ba);
    if (len < 0.001) return 1e6;
    vec2 dir = ba / len;
    vec2 nrm = vec2(-dir.y, dir.x);
    vec2 q = p - (a + b) * 0.5;
    float along = dot(q, dir);
    float across = dot(q, nrm);
    float h = clamp(along / len + 0.5, 0.0, 1.0);
    float bell = sin(3.14159265 * h);
    across += sag * bell * nrm.y;
    float taper = pow(1.0 - bell, 1.7);
    float radius = mix(rMid, rEnd, taper);
    return max(abs(along) - len * 0.5, abs(across) - radius);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uResolution;
    float toMouse = length(p - uMouse.xy);
    float blend = 23.0;
    if (uMouse.z > 0.001) {
      float influence = 1.0 - smoothstep(0.0, max(uMelt.x, 1.0), toMouse);
      blend += uMouse.w * uMouse.z * influence * influence;
    }

    float d = 1e6;
    for (int i = 0; i < MAX_SHAPES; i++) {
      vec4 shape = uShapes[i];
      vec4 meta = uShapeMeta[i];
      if (meta.y <= 0.001) continue;
      float di = sdRoundBox(p - shape.xy, max(shape.zw, vec2(0.001)), meta.x);
      // Weight is represented by moving the field out of range, not scaling
      // the box through zero, so corners do not flip while a state is born.
      di += (1.0 - meta.y) * 180.0;
      d = smin(d, di, blend);
    }

    for (int i = 0; i < MAX_LINKS; i++) {
      vec4 par = uLinkPar[i];
      // Radius passes below zero and beyond the AA range: the thread breaks
      // cleanly instead of surviving as a flickering one-pixel hairline.
      if (par.x <= -3.0) continue;
      float bridge = sdBridge(p, uLinkA[i], uLinkB[i], par.x, par.y, par.z);
      d = smin(d, bridge, par.w);
    }

    if (uMelt.y > 0.001) {
      d += sin(toMouse * uMelt.z - uTime * uMelt.w)
        * uMelt.y * exp(-toMouse / max(uMelt.x, 1.0));
    }

    float aa = clamp(fwidth(d), 0.6, 2.0);
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    // Writing a transparent pixel rather than discarding it. A discard disables
    // the early-depth/tile fast path for the whole tile on TBDR GPUs, and this
    // material already draws with blending on and depth off.
    if (alpha <= 0.001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Smoked Nordic glass. The canvas cannot sample the DOM behind it without
    // an expensive backdrop pass, so the material suggests refraction through
    // transmissive density, an asymmetric inner edge and a restrained sheet
    // of reflected paper light. All movement remains progress/pointer-driven;
    // a settled field has no decorative animation cost.
    float depth = smoothstep(0.0, 74.0, -d);
    float outerRim = 1.0 - smoothstep(0.0, 8.0, abs(d));
    float innerRim = 1.0 - smoothstep(0.0, 24.0, abs(d + 12.0));
    vec2 gradient = vec2(dFdx(d), dFdy(d));
    vec2 normal = gradient / max(length(gradient), 0.0001);
    float facing = pow(clamp(dot(normal, normalize(vec2(-0.64, 0.77))) * 0.5 + 0.5, 0.0, 1.0), 3.0);
    float signal = 0.5 + 0.5 * sin((p.x + p.y * 0.28) * 0.0022 + uProgress * 1.8);
    float reflection = pow(max(0.0, 0.5 + 0.5 * sin(
      (p.x * 0.72 + p.y) * 0.006 + uProgress * 1.35
    )), 12.0);
    float pointerGlint = uMouse.z * exp(-toMouse / 210.0);

    vec3 body = mix(uInk, uAccent, 0.075 + signal * 0.055);
    body = mix(body, uPaper, (1.0 - depth) * 0.035);
    body += uPaper * outerRim * (0.16 + facing * 0.18);
    body += mix(uAccent, uPaper, 0.56) * innerRim * (0.045 + facing * 0.055);
    body = mix(body, uPaper, reflection * (0.022 + pointerGlint * 0.035));

    float glassAlpha = 0.86 + depth * 0.075 + outerRim * 0.045;
    gl_FragColor = vec4(body, alpha * glassAlpha);
  }
`;

export type LiquidFrame = {
  progress: number;
  time: number;
  pointerX: number;
  pointerY: number;
  pointerPresence: number;
  pointerWake: number;
  shapeWeights: [number, number, number, number];
  linkWeights: [number, number, number];
};

export type LiquidStage = {
  measure: () => void;
  render: (frame: LiquidFrame) => void;
  dispose: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Frame-rate independent versions of the original 60 Hz motion constants. */
export const dampFrame = (
  current: number,
  target: number,
  responseAt60Hz: number,
  deltaSeconds: number,
) => current + (target - current) * (
  1 - Math.pow(1 - responseAt60Hz, clamp(deltaSeconds, 1 / 240, 1 / 20) * 60)
);

export const decayFrame = (
  value: number,
  retentionAt60Hz: number,
  deltaSeconds: number,
) => value * Math.pow(retentionAt60Hz, clamp(deltaSeconds, 1 / 240, 1 / 20) * 60);

export function createLiquidStage(
  host: HTMLElement,
  shapeElements: HTMLElement[],
  palette: { ink: string; accent: string; paper?: string; dprCap?: number },
  onUnavailable?: () => void,
): LiquidStage {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  // A soft SDF field antialiased by fwidth() carries almost no detail that a
  // third device pixel per CSS pixel can resolve, and fragment cost is the
  // square of this number. Read on every resize rather than frozen at
  // construction, which is how a stage built while the window was narrow kept
  // rendering at the phone tier on a desktop.
  const pixelRatio = () => Math.min(
    window.devicePixelRatio || 1,
    palette.dprCap ?? (window.innerWidth < 700 ? 1 : 1.15),
  );
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  const onContextLost = (event: Event) => {
    event.preventDefault();
    onUnavailable?.();
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const shapeUniforms = Array.from({ length: MAX_SHAPES }, () => new THREE.Vector4());
  const shapeMeta = Array.from({ length: MAX_SHAPES }, () => new THREE.Vector4(18, 0, 0, 0));
  const linkA = Array.from({ length: MAX_LINKS }, () => new THREE.Vector2());
  const linkB = Array.from({ length: MAX_LINKS }, () => new THREE.Vector2());
  const linkPar = Array.from({ length: MAX_LINKS }, () => new THREE.Vector4(-4, -4, 0, 0));
  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uShapes: { value: shapeUniforms },
    uShapeMeta: { value: shapeMeta },
    uLinkA: { value: linkA },
    uLinkB: { value: linkB },
    uLinkPar: { value: linkPar },
    uMouse: { value: new THREE.Vector4() },
    uMelt: { value: new THREE.Vector4(230, 0, 0.05, 7) },
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uInk: { value: new THREE.Color(palette.ink) },
    uAccent: { value: new THREE.Color(palette.accent) },
    uPaper: { value: new THREE.Color(palette.paper ?? "#e8e9e5") },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let width = 1;
  let height = 1;
  let measured = false;
  let hostRect = host.getBoundingClientRect();
  const shapeRects = Array.from({ length: MAX_SHAPES }, () => ({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  }));
  const measure = () => {
    hostRect = host.getBoundingClientRect();
    for (let i = 0; i < MAX_SHAPES; i += 1) {
      const rect = shapeElements[i]?.getBoundingClientRect();
      if (!rect) continue;
      shapeRects[i].left = rect.left;
      shapeRects[i].top = rect.top;
      shapeRects[i].width = rect.width;
      shapeRects[i].height = rect.height;
    }
    measured = true;
  };
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width, height);
    measured = false;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  measure();

  const pairs = [[0, 1], [1, 2], [1, 3]] as const;
  const render = (frame: LiquidFrame) => {
    if (!measured) measure();
    for (let i = 0; i < MAX_SHAPES; i += 1) {
      const rect = shapeRects[i];
      shapeUniforms[i].set(
        rect.left - hostRect.left + rect.width * 0.5 - width * 0.5,
        height * 0.5 - (rect.top - hostRect.top + rect.height * 0.5),
        Math.max(1, rect.width * 0.5),
        Math.max(1, rect.height * 0.5),
      );
      const radius = Math.min(rect.width, rect.height) * (i === 1 ? 0.045 : 0.09);
      shapeMeta[i].set(clamp(radius, 14, 36), frame.shapeWeights[i], 0, 0);
    }

    for (let i = 0; i < MAX_LINKS; i += 1) {
      const [from, to] = pairs[i];
      linkA[i].copy(shapeUniforms[from]);
      linkB[i].copy(shapeUniforms[to]);
      const amount = clamp(frame.linkWeights[i], 0, 1);
      const distance = linkA[i].distanceTo(linkB[i]);
      const separation = clamp(distance / Math.max(width, height), 0, 1);
      const radiusEnd = 48 * Math.pow(amount, 0.4) - 3.2;
      const radiusMid = radiusEnd * (0.34 + 0.42 * amount);
      const sag = 12 * Math.pow(separation, 1.5) * amount;
      const fillet = Math.min(18 * amount, Math.max(0, radiusMid) * 1.5);
      linkPar[i].set(radiusEnd, radiusMid, sag, fillet);
    }

    const mouseX = frame.pointerX - hostRect.left - width * 0.5;
    const mouseY = height * 0.5 - (frame.pointerY - hostRect.top);
    uniforms.uMouse.value.set(mouseX, mouseY, frame.pointerPresence, 32);
    uniforms.uMelt.value.set(230, 4.2 * frame.pointerWake, 0.05, 7);
    uniforms.uTime.value = frame.time;
    uniforms.uProgress.value = frame.progress;

    // Union of everything that can put ink on screen this frame, in the same
    // centred pixel space the fragment shader works in.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const cover = (cx: number, cy: number, halfW: number, halfH: number) => {
      if (cx - halfW < minX) minX = cx - halfW;
      if (cy - halfH < minY) minY = cy - halfH;
      if (cx + halfW > maxX) maxX = cx + halfW;
      if (cy + halfH > maxY) maxY = cy + halfH;
    };
    for (let i = 0; i < MAX_SHAPES; i += 1) {
      // Matches the shader's own cutoff: below this the state has been pushed
      // 180px out of range and cannot reach the isosurface.
      if (shapeMeta[i].y <= 0.001) continue;
      const shape = shapeUniforms[i];
      cover(shape.x, shape.y, shape.z, shape.w);
    }
    for (let i = 0; i < MAX_LINKS; i += 1) {
      const par = linkPar[i];
      if (par.x <= -3.0) continue;
      const reach = Math.max(par.x, par.y) + Math.abs(par.z);
      cover(
        (linkA[i].x + linkB[i].x) * 0.5,
        (linkA[i].y + linkB[i].y) * 0.5,
        Math.abs(linkA[i].x - linkB[i].x) * 0.5 + reach,
        Math.abs(linkA[i].y - linkB[i].y) * 0.5 + reach,
      );
    }
    if (minX > maxX) {
      // Nothing active: draw a degenerate quad rather than a full screen of
      // fragments that would all resolve to alpha 0.
      uniforms.uBounds.value.set(0, 0, 0, 0);
    } else {
      // Headroom for what the shader adds outside the raw geometry: the smin
      // blend radius, the pointer's extra melt blend, the ripple amplitude and
      // the antialiasing band.
      const slack = 23 + (frame.pointerPresence > 0.001 ? 32 : 0)
        + 4.2 * frame.pointerWake + 3;
      minX -= slack; minY -= slack; maxX += slack; maxY += slack;
      const halfW = width * 0.5;
      const halfH = height * 0.5;
      minX = Math.max(minX, -halfW); maxX = Math.min(maxX, halfW);
      minY = Math.max(minY, -halfH); maxY = Math.min(maxY, halfH);
      uniforms.uBounds.value.set(
        (minX + maxX) * 0.5 / halfW,
        (minY + maxY) * 0.5 / halfH,
        Math.max(0, (maxX - minX) * 0.5 / halfW),
        Math.max(0, (maxY - minY) * 0.5 / halfH),
      );
    }
    renderer.render(scene, camera);
  };

  return {
    measure,
    render,
    dispose() {
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}
