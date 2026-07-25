"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { Joi9000Hero } from "./Joi9000Hero";
import styles from "./joi-signal-lab.module.css";

type JoiSignalLabProps = { className?: string };

const projects = [
  { index: "01", title: "Joi Presence", subtitle: "Multimodal AI Companion", href: "/joi", palette: ["#07121d", "#f2eee7", "#ea6448"] },
  { index: "02", title: "Joi Map", subtitle: "World-facing AI Guide", href: "/joi-map", palette: ["#b8c8cf", "#07121d", "#ea6448"] },
  { index: "03", title: "Quiet Memory", subtitle: "Local Context System", href: "/joi", palette: ["#d8c69f", "#12100c", "#6c8fad"] },
  { index: "04", title: "Action Ledger", subtitle: "Human-readable Autonomy", href: "/joi", palette: ["#0b2236", "#dce9ef", "#7caed0"] },
  { index: "05", title: "Voice Field", subtitle: "Character & Expression", href: "/joi", palette: ["#43283f", "#f1dfda", "#ee795c"] },
  { index: "06", title: "Gallo / Joi", subtitle: "One Identity, Many Surfaces", href: "/", palette: ["#e9e3d8", "#111214", "#e55f43"] },
] as const;

type ProjectSignal = (typeof projects)[number];

const FRAME_WIDTH = (4 / 3) * 7.36 + 0.06;
const BORDER_X = 0.03;
const BORDER_Y = 0.07;
const particleForms = [
  "FORM 00 / NEBULA",
  "FORM 01 / JOI",
  "FORM 02 / GALLO",
  "FORM 03 / JOI.PXL",
];

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function smoothStep(value: number) {
  const amount = Math.max(0, Math.min(1, value));
  return amount * amount * (3 - 2 * amount);
}

function ProjectTitleContent({ project }: { project: ProjectSignal }) {
  return (
    <>
      <span>{project.index} / {String(projects.length).padStart(2, "0")}</span>
      <h2>{project.title}</h2>
      <p>{project.subtitle} <i>·</i> <a href={project.href}>View project <b>→</b></a></p>
    </>
  );
}

function RollingProjectTitle({ step }: { step: number }) {
  const active = projects[modulo(step, projects.length)];
  const previousStepRef = useRef(step);
  const currentProjectRef = useRef<ProjectSignal>(active);
  const transitionIdRef = useRef(0);
  const [transition, setTransition] = useState<{
    current: ProjectSignal;
    outgoing: ProjectSignal | null;
    direction: 1 | -1;
    id: number;
  }>({ current: active, outgoing: null, direction: 1, id: 0 });

  useEffect(() => {
    if (previousStepRef.current === step) return;
    const direction = step > previousStepRef.current ? 1 : -1;
    const outgoing = currentProjectRef.current;
    transitionIdRef.current += 1;
    const id = transitionIdRef.current;
    setTransition({ current: active, outgoing, direction, id });
    currentProjectRef.current = active;
    previousStepRef.current = step;
    const timer = window.setTimeout(() => {
      setTransition((value) => value.id === id ? { ...value, outgoing: null } : value);
    }, 570);
    return () => window.clearTimeout(timer);
  }, [active, step]);

  const enterClass = transition.direction > 0 ? styles.titleEnterForward : styles.titleEnterBackward;
  const exitClass = transition.direction > 0 ? styles.titleExitForward : styles.titleExitBackward;

  return (
    <section className={styles.projectTitle} aria-live="polite">
      <span className={styles.srOnly}>{transition.current.title} — {transition.current.subtitle}</span>
      {transition.outgoing && (
        <div key={`out-${transition.id}`} className={`${styles.titleLayer} ${styles.titleOutgoing} ${exitClass}`} aria-hidden="true">
          <ProjectTitleContent project={transition.outgoing} />
        </div>
      )}
      <div key={`in-${transition.id}`} className={`${styles.titleLayer} ${transition.id > 0 ? enterClass : ""}`}>
        <ProjectTitleContent project={transition.current} />
      </div>
    </section>
  );
}

function buildCurve() {
  return new THREE.CatmullRomCurve3(
    [
      [-150, -40, -150],
      [-90, -20, -35],
      [0, 0, 10],
      [90, 20, -35],
      [-49, 70, -211],
      [100, 180, -300],
      [-60, 200, -200],
    ].map(([x, y, z]) => new THREE.Vector3(x * 0.2, y * 0.2, z * 0.16)),
    false,
    "chordal",
    1,
  );
}

function buildFilmGeometry(curve: any) {
  const segments = 160;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = curve.getPointAt(t);
    positions.push(point.x, point.y - 3.75, point.z);
    positions.push(point.x, point.y + 3.75, point.z);
    uvs.push(t, 0, t, 1);
    if (index < segments) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function drawGrid(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.strokeStyle = color;
  context.lineWidth = 1;
  for (let line = 0; line <= 12; line += 1) {
    const px = x + (width / 12) * line;
    context.beginPath();
    context.moveTo(px, y);
    context.lineTo(px, y + height);
    context.stroke();
  }
  for (let line = 0; line <= 8; line += 1) {
    const py = y + (height / 8) * line;
    context.beginPath();
    context.moveTo(x, py);
    context.lineTo(x + width, py);
    context.stroke();
  }
}

function drawProjectArt(context: CanvasRenderingContext2D, projectIndex: number, x: number, y: number, width: number, height: number) {
  const project = projects[projectIndex];
  const [background, ink, accent] = project.palette;
  context.fillStyle = background;
  context.fillRect(x, y, width, height);
  drawGrid(context, x, y, width, height, `${ink}18`);

  context.fillStyle = ink;
  context.font = "600 13px ui-monospace, SFMono-Regular, monospace";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(`JOI SYSTEM / ${project.index}`, x + 28, y + 24);
  context.textAlign = "right";
  context.fillText("GALLO  ·  2026", x + width - 28, y + 24);

  if (projectIndex === 0) {
    const cx = x + width * 0.59;
    const cy = y + height * 0.51;
    context.strokeStyle = accent;
    context.lineWidth = 2;
    for (let ring = 1; ring <= 5; ring += 1) {
      context.beginPath();
      context.ellipse(cx, cy, ring * 35, ring * 23, -0.25, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = ink;
    context.font = "400 180px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("J", cx, cy + 4);
    context.fillStyle = accent;
    context.beginPath();
    context.arc(cx + 128, cy - 88, 7, 0, Math.PI * 2);
    context.fill();
  } else if (projectIndex === 1) {
    context.strokeStyle = ink;
    context.lineWidth = 2;
    for (let route = 0; route < 5; route += 1) {
      context.beginPath();
      for (let point = 0; point < 7; point += 1) {
        const px = x + width * (0.12 + point * 0.13);
        const py = y + height * (0.27 + ((point * 37 + route * 19) % 45) / 100);
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.globalAlpha = 0.18 + route * 0.08;
      context.stroke();
    }
    context.globalAlpha = 1;
    const pinX = x + width * 0.58;
    const pinY = y + height * 0.42;
    context.fillStyle = accent;
    context.beginPath();
    context.arc(pinX, pinY, 34, Math.PI, 0);
    context.lineTo(pinX, pinY + 72);
    context.closePath();
    context.fill();
    context.fillStyle = background;
    context.font = "400 34px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("J", pinX, pinY + 2);
  } else if (projectIndex === 2) {
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const px = x + width * 0.17 + column * 58;
        const py = y + height * 0.24 + row * 58;
        context.fillStyle = (row + column) % 4 === 0 ? accent : `${ink}${40 + ((row * 8 + column) % 4) * 20}`;
        context.beginPath();
        context.arc(px, py, 8 + ((row + column) % 3) * 3, 0, Math.PI * 2);
        context.fill();
        if (column < 7) {
          context.strokeStyle = `${ink}42`;
          context.beginPath();
          context.moveTo(px + 12, py);
          context.lineTo(px + 46, py + ((column % 2) * 18 - 9));
          context.stroke();
        }
      }
    }
  } else if (projectIndex === 3) {
    context.fillStyle = `${ink}12`;
    context.fillRect(x + 48, y + 82, width - 96, height - 142);
    context.font = "500 20px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "top";
    for (let line = 0; line < 9; line += 1) {
      context.fillStyle = line === 4 ? accent : `${ink}${line % 3 === 0 ? "c8" : "72"}`;
      context.fillText(`${String(line + 1).padStart(2, "0")}  ${line === 4 ? "APPROVAL RECEIVED  →  ACT" : "OBSERVE / PROPOSE / VERIFY"}`, x + 76, y + 108 + line * 35);
    }
  } else if (projectIndex === 4) {
    const cx = x + width / 2;
    const cy = y + height / 2 + 18;
    context.strokeStyle = accent;
    context.lineWidth = 3;
    for (let wave = 0; wave < 9; wave += 1) {
      context.beginPath();
      for (let point = 0; point <= 120; point += 1) {
        const px = x + 50 + ((width - 100) / 120) * point;
        const py = cy + Math.sin(point * 0.16 + wave * 0.8) * (18 + wave * 3) * Math.exp(-Math.abs(point - 60) / 95);
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.globalAlpha = 0.18 + wave * 0.07;
      context.stroke();
    }
    context.globalAlpha = 1;
    context.fillStyle = ink;
    context.font = "400 112px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("say it softly", cx, cy - 4);
  } else {
    context.fillStyle = ink;
    context.font = "700 180px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("JOI", x + width / 2, y + height / 2);
    context.fillStyle = accent;
    context.fillRect(x + width * 0.18, y + height * 0.72, width * 0.64, 8);
  }

  context.globalAlpha = 1;
  context.fillStyle = ink;
  context.font = "500 12px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.fillText(project.title.toUpperCase(), x + 28, y + height - 25);
  context.textAlign = "right";
  context.fillText(project.subtitle.toUpperCase(), x + width - 28, y + height - 25);
}

function buildAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const frameWidth = canvas.width / projects.length;
  projects.forEach((_, index) => drawProjectArt(context, index, index * frameWidth, 0, frameWidth, canvas.height));
  return canvas;
}

function FilmCanvas({
  step,
  reveal,
  onStepChange,
  onReady,
}: {
  step: number;
  reveal: number;
  onStepChange: (step: number) => void;
  onReady: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepRef = useRef(step);
  const revealRef = useRef(reveal);
  const onStepChangeRef = useRef(onStepChange);
  const onReadyRef = useRef(onReady);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { revealRef.current = reveal; }, [reveal]);
  useEffect(() => { onStepChangeRef.current = onStepChange; }, [onStepChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 305);
    camera.position.set(0, 0, 5);
    const curve = buildCurve();
    const curveLength = curve.getLength();
    const geometry = buildFilmGeometry(curve);
    const atlas = buildAtlas();
    const texture = new THREE.CanvasTexture(atlas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    let frontT = 0;
    let frontScore = -Infinity;
    for (let index = 0; index <= 500; index += 1) {
      const t = index / 500;
      const point = curve.getPointAt(t);
      const score = point.z * 2 - Math.abs(point.x) * 0.22 - Math.abs(point.y) * 0.05;
      if (score > frontScore) { frontScore = score; frontT = t; }
    }

    const uniforms = {
      uMap: { value: texture },
      uCurveLength: { value: curveLength },
      uFrameWidth: { value: FRAME_WIDTH },
      uTextureCount: { value: projects.length },
      uInitialOffset: { value: curveLength * 0.5 },
      uReelOffset: { value: stepRef.current * FRAME_WIDTH },
      uPhase: { value: (curveLength - 8.1) - frontT * curveLength + FRAME_WIDTH * 0.5 },
      uBorderX: { value: BORDER_X },
      uBorderY: { value: BORDER_Y },
      uFlex: { value: 0 },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      vertexShader: `
        uniform vec2 uPointer;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vec3 displaced = position;
          displaced.x += uPointer.x * (0.035 + max(0.0, -position.z) * 0.0012);
          displaced.y += uPointer.y * 0.035;
          vec4 world = modelMatrix * vec4(displaced, 1.0);
          vWorldPosition = world.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uCurveLength;
        uniform float uFrameWidth;
        uniform float uTextureCount;
        uniform float uInitialOffset;
        uniform float uReelOffset;
        uniform float uPhase;
        uniform float uBorderX;
        uniform float uBorderY;
        uniform float uFlex;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;

        float hash(vec2 value) {
          return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 filmUv = vUv;
          filmUv.x -= uFlex * pow(filmUv.y - 0.5, 2.0) * 0.0001;
          float pathDistance = filmUv.x * uCurveLength;
          if (pathDistance > uInitialOffset) discard;

          float filmDistance = pathDistance - uInitialOffset + uReelOffset + uPhase;
          float frame = floor(filmDistance / uFrameWidth);
          float localX = fract(filmDistance / uFrameWidth);
          float frameIndex = mod(mod(frame, uTextureCount) + uTextureCount, uTextureCount);
          vec2 contentUv = vec2(
            clamp((localX - uBorderX) / (1.0 - uBorderX * 2.0), 0.0, 1.0),
            clamp((filmUv.y - uBorderY) / (1.0 - uBorderY * 2.0), 0.0, 1.0)
          );
          vec2 atlasUv = vec2((frameIndex + contentUv.x) / uTextureCount, contentUv.y);
          float chromaOffset = 0.0017 / uTextureCount;
          vec3 image = vec3(
            texture2D(uMap, atlasUv + vec2(chromaOffset, 0.0)).r,
            texture2D(uMap, atlasUv).g,
            texture2D(uMap, atlasUv - vec2(chromaOffset, 0.0)).b
          );
          float luminance = dot(image, vec3(0.299, 0.587, 0.114));
          float monochrome = filmUv.x < 0.35 ? 0.82 : 0.34;
          image = mix(image, vec3(luminance), monochrome);
          image = (image - 0.5) * 1.075 + 0.5;

          bool sideBorder = localX < uBorderX || localX > 1.0 - uBorderX;
          bool topBottom = filmUv.y < uBorderY || filmUv.y > 1.0 - uBorderY;
          vec3 color = (sideBorder || topBottom) ? vec3(0.007, 0.009, 0.014) : image;

          float holePhase = fract(filmDistance * 1.92);
          bool hole = (filmUv.y < 0.047 || filmUv.y > 0.953) && holePhase > 0.22 && holePhase < 0.78;
          if (hole) discard;

          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float facing = abs(dot(normalize(vWorldNormal), viewDirection));
          float diffuse = 0.25 + 0.86 * pow(facing, 0.72);
          vec3 lightDirection = normalize(vec3(14.0, 7.0, 0.0) - vWorldPosition);
          float sideLight = pow(max(dot(lightDirection, normalize(vWorldNormal)), 0.0), 28.0) * 0.38;
          color = color * diffuse + vec3(0.42, 0.61, 0.78) * sideLight;

          float viewDistance = distance(cameraPosition, vWorldPosition);
          float farFade = smoothstep(12.0, 29.0, viewDistance);
          color = mix(color, vec3(0.008, 0.026, 0.052), farFade * 0.88);
          float filmGrain = hash(gl_FragCoord.xy + floor(uTime * 0.4)) - 0.5;
          float scratch = smoothstep(0.996, 1.0, hash(vec2(floor(gl_FragCoord.x * 0.24), 17.0)));
          color += filmGrain * 0.032 + scratch * 0.035;

          float depthVisibility = 1.0 - smoothstep(18.0, 30.0, viewDistance);
          float endVisibility = 1.0 - smoothstep(0.86, 1.0, filmUv.x);
          float alpha = depthVisibility * endVisibility;
          if (alpha < 0.025) discard;
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    const ribbon = new THREE.Mesh(geometry, material);
    scene.add(ribbon);

    let frame = 0;
    let readySent = false;
    let width = 1;
    let height = 1;
    let entryOffset = curveLength * 0.5;
    let entryVelocity = 0;
    let reelOffset = stepRef.current * FRAME_WIDTH;
    let reelVelocity = 0;
    let targetReelOffset = reelOffset;
    let observedStep = stepRef.current;
    let flex = 0;
    const pointer = new THREE.Vector2();
    const targetPointer = new THREE.Vector2();
    const drag = { active: false, startX: 0, offset: 0 };
    const wheel = { accumulated: 0, lastStepAt: 0, resetTimer: 0 };
    const clock = new THREE.Clock();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const aspect = width / height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 720 ? 1.25 : 1.7));
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const reelY = aspect <= 1 ? -1.6 : -1.6 - 0.3 * aspect + 0.2;
      const widthScale = THREE.MathUtils.clamp((width - 500) / (2560 - 500), 0, 1);
      const sourceScale = THREE.MathUtils.lerp(0.7, 0.9, widthScale) + 0.1 * aspect;
      const scale = sourceScale * 0.4;
      ribbon.position.y = 0.2 + reelY * 0.4;
      ribbon.scale.setScalar(scale);
    };

    const pointerPosition = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      targetPointer.set(
        (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5,
        -((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5),
      );
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerPosition(event);
      drag.active = true;
      drag.startX = event.clientX;
      drag.offset = 0;
      targetReelOffset = stepRef.current * FRAME_WIDTH;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add(styles.filmCanvasDragging);
    };
    const handlePointerMove = (event: PointerEvent) => {
      pointerPosition(event);
      if (!drag.active) return;
      const limit = width * 0.2;
      drag.offset = THREE.MathUtils.clamp(event.clientX - drag.startX, -limit, limit);
      targetReelOffset = stepRef.current * FRAME_WIDTH - drag.offset / (0.05 * width);
    };
    const finishDrag = (event: PointerEvent) => {
      if (!drag.active) return;
      drag.active = false;
      const crossedThreshold = Math.abs(drag.offset) > width * 0.1;
      const currentStep = stepRef.current;
      const nextStep = crossedThreshold ? currentStep - Math.sign(drag.offset) : currentStep;
      targetReelOffset = nextStep * FRAME_WIDTH;
      stepRef.current = nextStep;
      observedStep = nextStep;
      if (nextStep !== currentStep) onStepChangeRef.current(nextStep);
      drag.offset = 0;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.classList.remove(styles.filmCanvasDragging);
    };
    const handleLeave = () => { if (!drag.active) targetPointer.set(0, 0); };
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      wheel.accumulated += event.deltaX;
      window.clearTimeout(wheel.resetTimer);
      wheel.resetTimer = window.setTimeout(() => { wheel.accumulated = 0; }, 170);
      if (now - wheel.lastStepAt < 680 || Math.abs(wheel.accumulated) < width * 0.1) return;
      const nextStep = stepRef.current + Math.sign(wheel.accumulated);
      wheel.accumulated = 0;
      wheel.lastStepAt = now;
      stepRef.current = nextStep;
      onStepChangeRef.current(nextStep);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishDrag);
    canvas.addEventListener("pointercancel", finishDrag);
    canvas.addEventListener("pointerleave", handleLeave);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      if (!drag.active && observedStep !== stepRef.current) {
        observedStep = stepRef.current;
        targetReelOffset = observedStep * FRAME_WIDTH;
      }

      const revealAmount = revealRef.current * revealRef.current * (3 - 2 * revealRef.current);
      const entryTarget = THREE.MathUtils.lerp(curveLength * 0.5, curveLength - 8.1, revealAmount);
      if (reducedMotion) entryOffset = entryTarget;
      else {
        entryVelocity += (entryTarget - entryOffset) * 36 * delta;
        entryVelocity *= Math.exp(-14 * delta);
        entryOffset += entryVelocity * delta;
      }

      if (reducedMotion) reelOffset = targetReelOffset;
      else {
        reelVelocity += (targetReelOffset - reelOffset) * 42 * delta;
        reelVelocity *= Math.exp(-15.5 * delta);
        reelOffset += reelVelocity * delta;
      }
      flex = THREE.MathUtils.lerp(flex, THREE.MathUtils.clamp(reelVelocity * -9, -85, 85), 0.08);
      pointer.lerp(targetPointer, reducedMotion ? 1 : 0.08);

      uniforms.uInitialOffset.value = entryOffset;
      uniforms.uReelOffset.value = reelOffset;
      uniforms.uFlex.value = flex;
      uniforms.uTime.value += delta * 60;
      uniforms.uPointer.value.copy(pointer);
      renderer.render(scene, camera);
      if (!readySent) { readySent = true; onReadyRef.current(); }
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishDrag);
      canvas.removeEventListener("pointercancel", finishDrag);
      canvas.removeEventListener("pointerleave", handleLeave);
      canvas.removeEventListener("wheel", handleWheel);
      window.clearTimeout(wheel.resetTimer);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.filmCanvas} aria-label="Drag horizontally to browse Joi projects" />;
}

export function JoiSignalLab({ className = "" }: JoiSignalLabProps) {
  const experienceRef = useRef<HTMLElement>(null);
  const filmActiveRef = useRef(false);
  const [step, setStep] = useState(0);
  const [filmReady, setFilmReady] = useState(false);
  const [computerReady, setComputerReady] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [particleForm, setParticleForm] = useState(0);
  const activeIndex = modulo(step, projects.length);
  const filmReveal = smoothStep((scrollProgress - 0.66) / 0.22);
  const filmActive = filmReveal > 0.55;
  const ready = filmReady && computerReady;
  const heroOpacity = 1 - smoothStep(scrollProgress / 0.28);
  const terminalOpacity = 1 - smoothStep(scrollProgress / 0.56);
  const computerOpacity = Math.max(0, 1 - filmReveal * 1.35);
  filmActiveRef.current = filmActive;

  useEffect(() => {
    document.body.classList.add("joi-signal-lab-active");
    const handleKey = (event: KeyboardEvent) => {
      if (!filmActiveRef.current) return;
      if (event.key === "ArrowLeft") setStep((value) => value - 1);
      if (event.key === "ArrowRight") setStep((value) => value + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("joi-signal-lab-active");
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const experience = experienceRef.current;
      if (!experience) return;
      const bounds = experience.getBoundingClientRect();
      const travel = Math.max(1, experience.offsetHeight - window.innerHeight);
      const next = Math.max(0, Math.min(1, -bounds.top / travel));
      setScrollProgress((current) => Math.abs(current - next) > 0.0005 ? next : current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <main
      ref={experienceRef}
      className={`${styles.experience} ${className}`}
      style={{
        "--journey": scrollProgress,
        "--film-reveal": filmReveal,
        "--computer-opacity": computerOpacity,
        "--computer-scale": 1,
        "--film-shift": `${(1 - filmReveal) * 7}svh`,
        "--film-scale": 0.955 + filmReveal * 0.045,
        "--film-clip": `${(1 - filmReveal) * 4.5}%`,
        "--film-radius": `${(1 - filmReveal) * 34}px`,
        "--hero-opacity": heroOpacity,
        "--hero-shift": `${scrollProgress * -28}px`,
        "--terminal-opacity": terminalOpacity,
        "--terminal-shift": `${scrollProgress * 18}px`,
      } as CSSProperties}
    >
      <div className={styles.stage}>
        <div className={styles.heroField} aria-hidden="true" />
        <div className={styles.computerLayer}>
          <Joi9000Hero
            progress={scrollProgress}
            onFormChange={setParticleForm}
            onReady={() => setComputerReady(true)}
          />
        </div>

        <section className={styles.heroCopy} aria-labelledby="joi9000-title">
          <p>PERSONAL AI SYSTEM · GUANGZHOU / 2026</p>
          <h1 id="joi9000-title">
            <span>A MACHINE</span>
            <span>LEARNING HOW TO</span>
            <span>LIVE WITH YOU.</span>
          </h1>
          <div className={styles.heroScrollPrompt}>
            <span>SCROLL TO ENTER SELECTED WORK</span>
            <i aria-hidden="true" />
          </div>
        </section>

        <aside className={styles.terminalHud} aria-label="JOI9000 screen controls">
          <div>
            <span>JOI9000 / OPTICAL CORE</span>
            <strong>{particleForms[particleForm]}</strong>
          </div>
          <p><span>MOVE</span> DISTURB · <span>CLICK</span> REFORM</p>
          <em>{String(particleForm + 1).padStart(2, "0")} / 04</em>
        </aside>

        <section
          className={`${styles.filmLayer} ${filmActive ? styles.filmLayerActive : ""}`}
          aria-label="Selected Joi work"
        >
          <div className={styles.blueField} aria-hidden="true" />
          <FilmCanvas
            step={step}
            reveal={filmReveal}
            onStepChange={setStep}
            onReady={() => setFilmReady(true)}
          />
          <RollingProjectTitle step={step} />

          <div className={styles.controls}>
            <button type="button" onClick={() => setStep((value) => value - 1)} aria-label="Previous project"><span>←</span></button>
            <div className={styles.dots} aria-label={`Project ${activeIndex + 1} of ${projects.length}`}>
              {projects.map((project, index) => (
                <button
                  key={project.index}
                  type="button"
                  className={index === activeIndex ? styles.dotActive : ""}
                  onClick={() => setStep((value) => value + (index - modulo(value, projects.length)))}
                  aria-label={`Show ${project.title}`}
                />
              ))}
            </div>
            <button type="button" onClick={() => setStep((value) => value + 1)} aria-label="Next project"><span>→</span></button>
          </div>

          <p className={styles.hint}>DRAG THE FILM <span>·</span> USE ARROW KEYS</p>
        </section>

        <header className={styles.header}>
          <a className={styles.brand} href="/" aria-label="Back to Gallo home">
            <i aria-hidden="true" />
            <span>GALLO</span>
          </a>
          <div className={styles.headerProgress} aria-hidden="true">
            <span>JOI9000</span>
            <i style={{ transform: `scaleX(${Math.max(0.02, scrollProgress)})` }} />
          </div>
          <button className={styles.menu} type="button" aria-label="JOI9000 and selected work experience">
            <i /><i /><i />
          </button>
        </header>

        <div className={styles.scanlines} aria-hidden="true" />
        <div className={styles.vignette} aria-hidden="true" />
        <div className={styles.grain} aria-hidden="true" />

        <div className={`${styles.loader} ${ready ? styles.loaderReady : ""}`} role="status" aria-live="polite">
          <span>GALLO / JOI</span>
          <i />
          <strong>BOOTING JOI9000</strong>
        </div>
      </div>
    </main>
  );
}
