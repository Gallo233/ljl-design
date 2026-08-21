"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Joi9000Hero } from "./Joi9000Hero";
import {
  REEL_ANCHOR,
  SECTIONS,
  TOTAL_SCREENS,
  clamp01,
  getSection,
  progressWithin,
  smoothStep,
  type SectionId,
} from "./sections";
import { useScrollDriver } from "./useScrollDriver";
import styles from "./joi-signal-lab.module.css";

type JoiSignalLabProps = {
  className?: string;
  /** Which section to land on. Each section has its own route but shares one scroll. */
  initialSection?: SectionId;
};

const projects = [
  { index: "01", title: "Joi Presence", subtitle: "Multimodal AI Companion", href: "/work/joi", palette: ["#07121d", "#f2eee7", "#ea6448"] },
  { index: "02", title: "Joi Map", subtitle: "World-facing AI Guide", href: "/work/joi-map", palette: ["#b8c8cf", "#07121d", "#ea6448"] },
  { index: "03", title: "Zero Hour: Night Tide", subtitle: "Playable Godot Demo", href: "/play/night-tide", palette: ["#071a2b", "#d9edf2", "#2f9ed0"] },
  { index: "04", title: "Action Ledger", subtitle: "Human-readable Autonomy", href: "/work/joi", palette: ["#0b2236", "#dce9ef", "#7caed0"] },
  { index: "05", title: "Voice Field", subtitle: "Character & Expression", href: "/work/joi", palette: ["#43283f", "#f1dfda", "#ee795c"] },
  { index: "06", title: "Gallo / Joi", subtitle: "One Identity, Many Surfaces", href: "/", palette: ["#e9e3d8", "#111214", "#e55f43"] },
] as const;

type ProjectSignal = (typeof projects)[number];

const FRAME_WIDTH = (4 / 3) * 7.36 + 0.06;
const BORDER_X = 0.03;
const BORDER_Y = 0.07;
const ATLAS_FRAME_WIDTH = 1024;
const ATLAS_FRAME_HEIGHT = 768;
const reelVideoSources = [
  { projectIndex: 0, src: "/reel/01-joi/showcase.mp4" },
  { projectIndex: 1, src: "/reel/02-joi-map/showcase.mp4" },
] as const;
const particleForms = [
  "FORM 00 / NEBULA",
  "FORM 01 / JOI",
  "FORM 02 / GALLO",
  "FORM 03 / JOI.PXL",
];

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

type ReelVideoAsset = {
  projectIndex: number;
  video: HTMLVideoElement;
  texture: any;
};

function createReelVideo(source: (typeof reelVideoSources)[number]): ReelVideoAsset {
  const video = document.createElement("video");
  video.src = source.src;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");
  video.load();

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { projectIndex: source.projectIndex, video, texture };
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
  canvas.width = ATLAS_FRAME_WIDTH * projects.length;
  canvas.height = ATLAS_FRAME_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  projects.forEach((_, index) => {
    drawProjectArt(
      context,
      index,
      index * ATLAS_FRAME_WIDTH,
      0,
      ATLAS_FRAME_WIDTH,
      ATLAS_FRAME_HEIGHT,
    );
  });
  return canvas;
}

function buildHandheldModel() {
  const group = new THREE.Group();
  const geometries: any[] = [];
  const materials: any[] = [];
  const pressables: Record<string, any> = {};

  const mesh = (geometry: any, material: any, name: string, position: [number, number, number]) => {
    geometries.push(geometry);
    materials.push(material);
    const item = new THREE.Mesh(geometry, material);
    item.name = name;
    item.position.set(...position);
    group.add(item);
    return item;
  };

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2a3b, roughness: 0.52, metalness: 0.28 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x263b50, roughness: 0.44, metalness: 0.2 });
  const bezelMaterial = new THREE.MeshStandardMaterial({ color: 0x050c14, roughness: 0.82, metalness: 0.08 });
  const dpadMaterial = new THREE.MeshStandardMaterial({ color: 0x0e1825, roughness: 0.64, metalness: 0.24 });
  const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0x2f9ed0, emissive: 0x0b354e, emissiveIntensity: 0.62, roughness: 0.35, metalness: 0.26 });
  const buttonAltMaterial = new THREE.MeshStandardMaterial({ color: 0xea6448, emissive: 0x4a160e, emissiveIntensity: 0.38, roughness: 0.38, metalness: 0.24 });

  mesh(new THREE.BoxGeometry(5.9, 2.8, 0.56), bodyMaterial, "body", [0, 0, 0]);
  mesh(new THREE.BoxGeometry(5.56, 2.46, 0.15), faceMaterial, "face-plate", [0, 0.02, 0.36]);
  mesh(new THREE.BoxGeometry(3.72, 1.54, 0.14), bezelMaterial, "screen-bezel", [-0.38, 0.46, 0.48]);

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 640;
  screenCanvas.height = 360;
  const screenContext = screenCanvas.getContext("2d");
  if (screenContext) {
    const gradient = screenContext.createLinearGradient(0, 0, 0, screenCanvas.height);
    gradient.addColorStop(0, "#071c2e");
    gradient.addColorStop(1, "#020810");
    screenContext.fillStyle = gradient;
    screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
    screenContext.fillStyle = "#2f9ed0";
    for (let index = 0; index < 32; index += 1) {
      screenContext.fillRect((index * 83) % 620, 38 + ((index * 47) % 280), 2, 2);
    }
    screenContext.strokeStyle = "rgba(47, 158, 208, 0.35)";
    screenContext.lineWidth = 3;
    screenContext.strokeRect(22, 22, 596, 316);
    screenContext.fillStyle = "#d9edf2";
    screenContext.font = "600 32px ui-monospace, monospace";
    screenContext.fillText("ZERO HOUR", 38, 68);
    screenContext.fillStyle = "#2f9ed0";
    screenContext.font = "500 17px ui-monospace, monospace";
    screenContext.fillText("NIGHT TIDE  /  READY", 40, 96);
    screenContext.strokeStyle = "#ea6448";
    screenContext.lineWidth = 7;
    screenContext.beginPath();
    screenContext.moveTo(82, 264);
    screenContext.lineTo(210, 192);
    screenContext.lineTo(330, 248);
    screenContext.lineTo(502, 140);
    screenContext.stroke();
    screenContext.fillStyle = "#d9edf2";
    screenContext.font = "500 15px ui-monospace, monospace";
    screenContext.fillText("PRESS START", 40, 316);
  }
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.generateMipmaps = false;
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;
  materials.push(screenTexture);
  mesh(new THREE.PlaneGeometry(3.24, 1.12), new THREE.MeshBasicMaterial({ map: screenTexture }), "screen", [-0.38, 0.46, 0.57]);

  const dpadHorizontal = mesh(new THREE.BoxGeometry(1.05, 0.31, 0.2), dpadMaterial, "dpad-horizontal", [-2.0, 0.23, 0.57]);
  const dpadVertical = mesh(new THREE.BoxGeometry(0.31, 1.05, 0.2), dpadMaterial, "dpad-vertical", [-2.0, 0.23, 0.58]);
  pressables.up = dpadVertical;
  pressables.down = dpadVertical;
  pressables.left = dpadHorizontal;
  pressables.right = dpadHorizontal;

  const faceButtons = [
    ["a", 1.66, 0.42, buttonMaterial],
    ["b", 2.13, 0.04, buttonAltMaterial],
    ["x", 1.2, 0.04, buttonAltMaterial],
    ["y", 1.66, -0.34, buttonMaterial],
  ] as const;
  faceButtons.forEach(([name, x, y, material]) => {
    const button = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 24), material, `button-${name}`, [x, y, 0.63]);
    button.rotation.x = Math.PI / 2;
    pressables[name] = button;
  });
  pressables.start = mesh(new THREE.BoxGeometry(0.34, 0.15, 0.12), dpadMaterial, "start", [-0.13, -0.65, 0.59]);
  pressables.select = mesh(new THREE.BoxGeometry(0.34, 0.15, 0.12), dpadMaterial, "select", [0.37, -0.65, 0.59]);

  group.rotation.order = "YXZ";
  return {
    group,
    screenTexture,
    pressables,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose?.());
      screenTexture.dispose();
    },
  };
}

function FilmCanvas({
  step,
  revealRef,
  onStepChange,
  onProjectOpen,
  onReady,
  onDragStateChange,
}: {
  step: number;
  /** Live reel reveal, 0 before it arrives to 1 once it has. */
  revealRef: { current: number };
  onStepChange: (step: number) => void;
  onProjectOpen: (href: string) => void;
  onReady: () => void;
  /** Lets the scroll driver suspend snapping while the reader is dragging the reel. */
  onDragStateChange: (active: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepRef = useRef(step);
  const onStepChangeRef = useRef(onStepChange);
  const onProjectOpenRef = useRef(onProjectOpen);
  const onReadyRef = useRef(onReady);
  const onDragStateChangeRef = useRef(onDragStateChange);
  useEffect(() => { onDragStateChangeRef.current = onDragStateChange; }, [onDragStateChange]);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { onStepChangeRef.current = onStepChange; }, [onStepChange]);
  useEffect(() => { onProjectOpenRef.current = onProjectOpen; }, [onProjectOpen]);
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
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const reelVideoAssets = reelVideoSources.map(createReelVideo);
    let activeVideoProject = -1;
    const playVideo = (asset: ReelVideoAsset) => {
      void asset.video.play().catch(() => {
        // Autoplay can be blocked until the visitor interacts; the first frame remains a valid fallback.
      });
    };

    const nightTideTarget = new THREE.WebGLRenderTarget(768, 576, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    nightTideTarget.texture.colorSpace = THREE.SRGBColorSpace;
    nightTideTarget.texture.generateMipmaps = false;
    const nightTideScene = new THREE.Scene();
    nightTideScene.background = new THREE.Color(0x020810);
    const nightTideCamera = new THREE.PerspectiveCamera(34, 768 / 576, 0.1, 100);
    nightTideCamera.position.set(0, 0.25, 8.4);
    nightTideCamera.lookAt(0, 0.05, 0);
    nightTideScene.add(new THREE.AmbientLight(0x9ccce0, 1.35));
    const tideKeyLight = new THREE.DirectionalLight(0x7fd9ff, 2.6);
    tideKeyLight.position.set(-3, 5, 6);
    nightTideScene.add(tideKeyLight);
    const tideRimLight = new THREE.PointLight(0xea6448, 8, 18, 2);
    tideRimLight.position.set(3.6, -1.1, 3.5);
    nightTideScene.add(tideRimLight);
    const nightTideModel = buildHandheldModel();
    nightTideModel.group.rotation.set(-0.12, 0.22, -0.06);
    nightTideModel.group.position.y = -0.02;
    nightTideScene.add(nightTideModel.group);

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
      uJoiVideo: { value: reelVideoAssets[0]?.texture ?? texture },
      uJoiMapVideo: { value: reelVideoAssets[1]?.texture ?? texture },
      uNightTideMap: { value: nightTideTarget.texture },
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
        uniform sampler2D uJoiVideo;
        uniform sampler2D uJoiMapVideo;
        uniform sampler2D uNightTideMap;
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
          vec3 image;
          if (abs(frameIndex - 0.0) < 0.5) {
            image = texture2D(uJoiVideo, vec2(contentUv.x, 1.0 - contentUv.y)).rgb;
          } else if (abs(frameIndex - 1.0) < 0.5) {
            image = texture2D(uJoiMapVideo, vec2(contentUv.x, 1.0 - contentUv.y)).rgb;
          } else if (abs(frameIndex - 2.0) < 0.5) {
            image = texture2D(uNightTideMap, vec2(contentUv.x, 1.0 - contentUv.y)).rgb;
          } else {
            image = vec3(
              texture2D(uMap, atlasUv + vec2(chromaOffset, 0.0)).r,
              texture2D(uMap, atlasUv).g,
              texture2D(uMap, atlasUv - vec2(chromaOffset, 0.0)).b
            );
          }
          float luminance = dot(image, vec3(0.299, 0.587, 0.114));
          float placeholderMonochrome = (abs(frameIndex - 0.0) < 0.5 || abs(frameIndex - 1.0) < 0.5 || abs(frameIndex - 2.0) < 0.5)
            ? 0.08
            : (filmUv.x < 0.35 ? 0.82 : 0.34);
          image = mix(image, vec3(luminance), placeholderMonochrome);
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
      onDragStateChangeRef.current(true);
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
    const finishDrag = (event: PointerEvent, openOnTap: boolean) => {
      if (!drag.active) return;
      drag.active = false;
      onDragStateChangeRef.current(false);
      const wasTap = Math.abs(drag.offset) < 8;
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
      const project = projects[modulo(currentStep, projects.length)];
      if (openOnTap && wasTap && project && Number(project.index) <= 3) {
        onProjectOpenRef.current(project.href);
      }
    };
    const handlePointerUp = (event: PointerEvent) => finishDrag(event, true);
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, false);
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
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
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

      const activeProject = modulo(stepRef.current, projects.length);
      if (activeProject !== activeVideoProject) {
        const previousVideo = reelVideoAssets.find((asset) => asset.projectIndex === activeVideoProject);
        previousVideo?.video.pause();
        const nextVideo = reelVideoAssets.find((asset) => asset.projectIndex === activeProject);
        if (nextVideo) {
          nextVideo.video.currentTime = 0;
          if (revealRef.current > 0.4 && !reducedMotion) playVideo(nextVideo);
        }
        activeVideoProject = activeProject;
      }
      const activeVideo = reelVideoAssets.find((asset) => asset.projectIndex === activeVideoProject);
      if (activeVideo) {
        if (revealRef.current > 0.4 && !reducedMotion) playVideo(activeVideo);
        else activeVideo.video.pause();
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
      nightTideModel.group.rotation.y = 0.22 + Math.sin(uniforms.uTime.value * 0.005) * 0.28;
      nightTideModel.group.rotation.z = -0.06 + Math.sin(uniforms.uTime.value * 0.003) * 0.045;
      nightTideModel.group.position.y = Math.sin(uniforms.uTime.value * 0.006) * 0.16;
      nightTideCamera.lookAt(0, nightTideModel.group.position.y, 0);
      renderer.setRenderTarget(nightTideTarget);
      renderer.clear();
      renderer.render(nightTideScene, nightTideCamera);
      renderer.setRenderTarget(null);
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
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("pointerleave", handleLeave);
      canvas.removeEventListener("wheel", handleWheel);
      window.clearTimeout(wheel.resetTimer);
      geometry.dispose();
      material.dispose();
      reelVideoAssets.forEach(({ video, texture }) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
        texture.dispose();
      });
      texture.dispose();
      nightTideModel.dispose();
      nightTideTarget.dispose();
      renderer.dispose();
    };
  }, []);

  const activeProject = projects[modulo(step, projects.length)];
  const canOpen = Number(activeProject.index) <= 3;
  const openActiveProject = () => {
    if (canOpen) onProjectOpen(activeProject.href);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.filmCanvas} ${canOpen ? styles.filmCanvasOpenable : ""}`}
      role={canOpen ? "link" : undefined}
      tabIndex={canOpen ? 0 : -1}
      aria-label={
        canOpen
          ? `Open ${activeProject.title} case study. Drag horizontally to browse projects.`
          : "Drag horizontally to browse Joi projects"
      }
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openActiveProject();
      }}
    />
  );
}

export function JoiSignalLab({ className = "", initialSection = "hero" }: JoiSignalLabProps) {
  const router = useRouter();
  const experienceRef = useRef<HTMLElement>(null);
  const filmActiveRef = useRef(false);
  const [step, setStep] = useState(0);
  const [filmReady, setFilmReady] = useState(false);
  const [computerReady, setComputerReady] = useState(false);
  const [particleForm, setParticleForm] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);
  const activeIndex = modulo(step, projects.length);
  const ready = filmReady && computerReady;

  // Scroll-derived values live in refs and go straight to CSS variables. Nothing here re-renders
  // per frame — the reference keeps these in motion values for the same reason.
  const entryRef = useRef(0);
  const filmRevealRef = useRef(0);
  const dragActiveRef = useRef(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!filmActiveRef.current) return;
      if (event.key === "ArrowLeft") setStep((value) => value - 1);
      if (event.key === "ArrowRight") setStep((value) => value + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Land on the section this route names, before the first paint. One scroll, four addresses.
  useLayoutEffect(() => {
    if (initialSection === "hero") return;
    window.scrollTo({
      top: getSection(initialSection).position * window.innerHeight,
      behavior: "instant" as ScrollBehavior,
    });
  }, [initialSection]);

  const { scrollToSection } = useScrollDriver({
    // Runs every frame. Writes CSS variables and refs directly — no React state, no re-render.
    onFrame: ({ screens }) => {
      const experience = experienceRef.current;
      if (!experience) return;

      // The hero camera flight and the film entrance were tuned against a 0..1 range that ends
      // when the reel has arrived. Remap onto that range so their timing survives page growth.
      const entry = clamp01(screens / REEL_ANCHOR);
      const filmReveal = smoothStep((entry - 0.66) / 0.22);
      const aboutStart = getSection("about-me").position;
      const reelExit = smoothStep((screens - (aboutStart - 0.6)) / 0.6);

      entryRef.current = entry;
      filmRevealRef.current = filmReveal;
      filmActiveRef.current = filmReveal > 0.55 && screens < aboutStart - 0.3;

      const style = experience.style;
      style.setProperty("--journey", (screens / TOTAL_SCREENS).toFixed(4));
      style.setProperty("--film-reveal", filmReveal.toFixed(4));
      style.setProperty("--computer-opacity", Math.max(0, 1 - filmReveal * 1.35).toFixed(4));
      style.setProperty("--film-shift", `${((1 - filmReveal) * 7).toFixed(3)}svh`);
      style.setProperty("--film-scale", (0.955 + filmReveal * 0.045).toFixed(4));
      style.setProperty("--film-clip", `${((1 - filmReveal) * 4.5).toFixed(3)}%`);
      style.setProperty("--film-radius", `${((1 - filmReveal) * 34).toFixed(2)}px`);
      style.setProperty("--hero-opacity", (1 - smoothStep(entry / 0.7)).toFixed(4));
      style.setProperty("--hero-shift", `${(entry * -28).toFixed(2)}px`);
      style.setProperty("--terminal-opacity", (1 - smoothStep(entry / 0.85)).toFixed(4));
      style.setProperty("--terminal-shift", `${(entry * 18).toFixed(2)}px`);
      style.setProperty("--reel-exit", reelExit.toFixed(4));
      style.setProperty("--about-progress", progressWithin("about-me", screens).toFixed(4));
      style.setProperty("--contact-progress", progressWithin("contact", screens).toFixed(4));
    },
    onSectionChange: setActiveSection,
    // Don't snap out from under someone who is dragging the reel.
    isLocked: () => filmActiveRef.current && dragActiveRef.current,
  });

  // Keep the address bar in step with where the reader actually is, without adding history
  // entries — scrolling is not navigation.
  useEffect(() => {
    const section = getSection(activeSection);
    if (window.location.pathname === section.path) return;
    window.history.replaceState(null, "", section.path);
    document.title = section.title;
  }, [activeSection]);

  return (
    <main
      ref={experienceRef}
      className={`${styles.experience} ${className}`}
      style={{
        // Scroll length comes from the section table, so adding a section extends the page.
        height: `${TOTAL_SCREENS * 100}svh`,
        "--computer-scale": 1,
      } as CSSProperties}
    >
      <div className={styles.stage}>
        <div className={styles.heroField} aria-hidden="true" />
        <div className={styles.computerLayer}>
          <Joi9000Hero
            progressRef={entryRef}
            onFormChange={setParticleForm}
            onReady={() => setComputerReady(true)}
          />
        </div>

        <section className={styles.heroCopy} aria-labelledby="joi9000-title">
          <p>PERSONAL AI SYSTEM · GUANGZHOU / 2026</p>
          <h1 id="joi9000-title">
            <span>I DESIGN</span>
            <span>HOW AI ENTERS</span>
            <span>HUMAN LIFE.</span>
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
          className={`${styles.filmLayer} ${activeSection === "selected-work" ? styles.filmLayerActive : ""}`}
          aria-label="Selected Joi work"
        >
          <div className={styles.blueField} aria-hidden="true" />
          <FilmCanvas
            step={step}
            revealRef={filmRevealRef}
            onStepChange={setStep}
            onProjectOpen={(href) => router.push(href)}
            onReady={() => setFilmReady(true)}
            onDragStateChange={(active: boolean) => { dragActiveRef.current = active; }}
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

          <p className={styles.hint}>
            {activeIndex < 3 ? "CLICK TO VIEW" : "DRAG THE FILM"}
            <span>·</span>
            {activeIndex < 3 ? "DRAG TO BROWSE" : "USE ARROW KEYS"}
          </p>
        </section>

        {/* Skeleton. Copy and layout land once the assets are in — see docs/design-audits. */}
        <section
          className={`${styles.closingPanel} ${activeSection === "about-me" ? styles.closingPanelActive : ""}`}
          aria-label="About me"
        >
          <p className={styles.closingKicker}>03 / GALLO</p>
          <h2>
            Curious about<br />what technology<br />changes in us.
          </h2>
          <p className={styles.closingBody}>
            AI becomes interesting when it stops being only a feature.
          </p>
          <a className={styles.closingLink} href="/about-me">
            THE ROOM, THE WORK, THE PERSON <span aria-hidden="true">→</span>
          </a>
        </section>

        <section
          className={`${styles.closingPanel} ${styles.contactPanel} ${activeSection === "contact" ? styles.closingPanelActive : ""}`}
          aria-label="Contact"
        >
          <p className={styles.closingKicker}>04 / CONTACT</p>
          <h2>
            Let&apos;s make technology<br />people can live with.
          </h2>
          <div className={styles.closingActions}>
            <a href="mailto:liujialuo233@gmail.com">EMAIL <span aria-hidden="true">↗</span></a>
            <a href="https://github.com/Gallo233" target="_blank" rel="noreferrer">GITHUB <span aria-hidden="true">↗</span></a>
            <a href="/resume/gallo-liu-resume-cn.pdf" target="_blank">RESUME <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <header className={styles.header}>
          <a className={styles.brand} href="/" aria-label="Back to Gallo home">
            <i aria-hidden="true" />
            <span>GALLO</span>
          </a>
          <nav className={styles.sectionNav} aria-label="Sections">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={section.path}
                className={activeSection === section.id ? styles.sectionNavActive : ""}
                aria-current={activeSection === section.id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection.current(section.id);
                }}
              >
                {section.label}
              </a>
            ))}
          </nav>
          <div className={styles.headerProgress} aria-hidden="true">
            <span>JOI9000</span>
            <i />
          </div>
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
