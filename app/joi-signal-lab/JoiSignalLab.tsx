"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createRoomScene } from "./room3d";
import { createHeroScene } from "./heroScene";
import { createOceanScene, SEA_STATES } from "./oceanScene";
import { createPostChain } from "./postfx";
import { detectQuality } from "./quality";
import { LanyardBadge } from "./badge/LanyardBadge";
import { JoiMusicPlayer, MIX_ORDER } from "./JoiMusicPlayer";
import { ROOM_OBJECTS, type RoomObjectId } from "./roomObjects";
import { RECORD_IDS } from "./roomRecords";
import { SiteHUD } from "../../components/SiteHUD";
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

/**
 * The six frames of the reel. Every frame is a real destination now: 01–03 are work,
 * 04 is the lab, and 05/06 land on sections of this same page — the open handler
 * turns those two into scrolls rather than route pushes, because pushing /about-me
 * would remount the whole lab and reboot both scenes.
 */
const projects = [
  { index: "01", title: "Joi Presence", subtitle: "Multimodal AI Companion", href: "/work/joi", palette: ["#07121d", "#f2eee7", "#ea6448"] },
  { index: "02", title: "Joi Mobile", subtitle: "Native Character Companion", href: "/work/joi-mobile", palette: ["#d8d6ef", "#17152c", "#6558f5"] },
  { index: "03", title: "Game Center", subtitle: "One Handheld · Four Cartridges", href: "/play/night-tide", palette: ["#071a2b", "#d9edf2", "#2f9ed0"] },
  { index: "04", title: "The Lab", subtitle: "Research & Experiments", href: "/lab", palette: ["#0b2236", "#dce9ef", "#7caed0"] },
  { index: "05", title: "My Room", subtitle: "About · 我的房间", href: "/about-me", palette: ["#2b2033", "#f1dfda", "#ee795c"] },
  { index: "06", title: "Contact", subtitle: "Call Sheet · 联系", href: "/contact", palette: ["#e9e3d8", "#111214", "#e55f43"] },
] as const;

type ProjectSignal = (typeof projects)[number];

const FRAME_WIDTH = (4 / 3) * 7.36 + 0.06;
const BORDER_X = 0.03;
const BORDER_Y = 0.07;
const ATLAS_FRAME_WIDTH = 1024;
const ATLAS_FRAME_HEIGHT = 768;
// The live procedural frames used to stop at 768×576, below their projected size on
// a Retina display. 1280×960 keeps the handheld and room legible at the front of the
// reel without turning either into a full-viewport render target.
const LIVE_FRAME_WIDTH = 1280;
const LIVE_FRAME_HEIGHT = 960;
/**
 * The reel's two moving frames, and the three ways they can be delivered.
 *
 * `src` is the desktop master. `mobileSrc` is the same footage at 960×540 — the Joi Mobile
 * master is **2560×1440**, and decoding that every frame *and* uploading it as a WebGL
 * texture is more than a phone GPU will do while a second WebGL context is also running.
 * That is most of why the mobile reel both stalled and dropped frames.
 *
 * `sheets` is the last resort, and it exists because a re-encode does not help against the
 * other mobile failure mode: several Chinese Android browsers (UC / Quark's T7 kernel,
 * WeChat's X5) hoist `<video>` out of the page into a native player layer. The element keeps
 * reporting a healthy `readyState` while the WebGL texture receives nothing — which is
 * exactly how the frame rendered *black* instead of falling back. Sprite sheets are plain
 * images, so no video policy can reach them.
 */
const reelMotionSources = [
  {
    projectIndex: 0,
    src: "/reel/01-joi/showcase.mp4",
    mobileSrc: "/reel/01-joi/showcase-mobile.mp4",
    poster: "/reel/01-joi/still.avif",
    sheets: { dir: "/reel/01-joi/sheets-mobile", count: 5 },
  },
  {
    projectIndex: 1,
    src: "/reel/02-joi-mobile/showcase.mp4",
    mobileSrc: "/reel/02-joi-mobile/showcase-mobile.mp4",
    poster: "/reel/02-joi-mobile/still.avif",
    sheets: { dir: "/reel/02-joi-mobile/sheets-mobile", count: 5 },
  },
] as const;
const reelPosterSources = reelMotionSources.map(({ projectIndex, poster }) => ({ projectIndex, poster }));

/** Sheet geometry, fixed by how the sheets were baked (ffmpeg `fps=10,scale=480:270,tile=4x3`). */
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 3;
const SHEET_FRAME_WIDTH = 480;
const SHEET_FRAME_HEIGHT = 270;
const SHEET_FPS = 10;

/**
 * How long a mobile video gets to produce its first frame before the sheets take over.
 * Long enough to cover a slow first segment, short enough that nobody watches a dead frame.
 */
const VIDEO_GIVE_UP_MS = 2600;
const seaStateLabels = SEA_STATES.map((state) => state.label);

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

/**
 * One moving reel frame, however it happens to be delivered.
 *
 * `texture` is read fresh every frame rather than captured once, because the mobile path
 * can swap the whole backend out from under it mid-playback (see `createReelMotion`).
 */
type ReelMotion = {
  projectIndex: number;
  texture: any;
  /** True only once real pixels exist. Never inferred from `readyState` — see below. */
  ready: boolean;
  play: () => void;
  pause: () => void;
  restart: () => void;
  /** Sheet playback advances here; the video backend ignores it. */
  tick: (delta: number) => void;
  dispose: () => void;
};

/**
 * Video backend.
 *
 * Two things here are not decoration:
 *
 * - **The element is in the document.** These used to be created and never attached. Desktop
 *   browsers decode a detached video into a texture anyway; Chrome on Android is stricter.
 *   `display: none` and `visibility: hidden` put it back outside the layout tree, so it is
 *   parked at 1px with a near-zero opacity: laid out, decoding, invisible.
 * - **`ready` waits for a presented frame**, not `readyState >= 2`, which several mobile
 *   browsers reach from metadata alone. Blending to a texture that has never received a
 *   frame is what painted the frame black rather than leaving the drawn art up.
 */
function createVideoMotion(
  source: (typeof reelMotionSources)[number],
  mobile: boolean,
  onFirstFrame?: () => void,
): ReelMotion {
  const video = document.createElement("video");
  video.src = mobile ? source.mobileSrc : source.src;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = mobile ? "metadata" : "auto";
  video.poster = source.poster;
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  // Older WebKit reads the attribute; the vendor pairs ask the Chinese Android kernels not
  // to hoist playback into their native player, which is what silently empties the texture.
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "");
  video.setAttribute("x5-video-player-type", "h5");
  video.setAttribute("x5-video-player-fullscreen", "false");
  video.setAttribute("x5-playsinline", "");
  video.setAttribute("t7-video-player-type", "inline");
  video.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;";
  document.body.appendChild(video);
  video.load();

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const motion: ReelMotion = {
    projectIndex: source.projectIndex,
    texture,
    ready: false,
    play: () => {
      if (!video.paused) return;
      void video.play().catch(() => {
        // Autoplay can be refused. The drawn art stays up, and on mobile the sheet
        // backend takes over once the give-up window passes.
      });
    },
    pause: () => video.pause(),
    restart: () => { video.currentTime = 0; },
    tick: () => {},
    dispose: () => {},
  };

  const markReady = () => {
    if (motion.ready) return;
    motion.ready = true;
    onFirstFrame?.();
  };

  // `requestVideoFrameCallback` fires on a *presented* frame, which is the actual question.
  // Where it is missing, `timeupdate` past zero is the closest honest substitute.
  const anyVideo = video as any;
  let frameHandle = 0;
  const onProgress = () => {
    if (video.readyState >= 2 && video.currentTime > 0) markReady();
  };
  if (typeof anyVideo.requestVideoFrameCallback === "function") {
    frameHandle = anyVideo.requestVideoFrameCallback(markReady);
  } else {
    video.addEventListener("timeupdate", onProgress);
    video.addEventListener("loadeddata", onProgress);
  }

  motion.dispose = () => {
    if (frameHandle) anyVideo.cancelVideoFrameCallback?.(frameHandle);
    video.removeEventListener("timeupdate", onProgress);
    video.removeEventListener("loadeddata", onProgress);
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    texture.dispose();
  };

  return motion;
}

/**
 * Sprite-sheet backend — the same footage as plain images.
 *
 * The GPU only ever sees one 480×270 canvas: each tick blits the current cell out of the
 * decoded sheet rather than uploading the 1920×810 sheet itself. Sheets load in order and
 * playback starts as soon as the first one decodes, so this is usable before it is complete.
 */
function createSheetMotion(source: (typeof reelMotionSources)[number]): ReelMotion {
  const canvas = document.createElement("canvas");
  canvas.width = SHEET_FRAME_WIDTH;
  canvas.height = SHEET_FRAME_HEIGHT;
  const context = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const perSheet = SHEET_COLUMNS * SHEET_ROWS;
  const sheets: Array<HTMLImageElement | null> = new Array(source.sheets.count).fill(null);
  let loadedSheets = 0;
  let elapsed = 0;
  let playing = false;

  const motion: ReelMotion = {
    projectIndex: source.projectIndex,
    texture,
    ready: false,
    play: () => { playing = true; },
    pause: () => { playing = false; },
    restart: () => { elapsed = 0; },
    tick: (delta: number) => {
      if (!playing || !context || loadedSheets === 0) return;
      elapsed += delta;
      const total = loadedSheets * perSheet;
      const frame = Math.floor(elapsed * SHEET_FPS) % total;
      const sheet = sheets[Math.floor(frame / perSheet)];
      if (!sheet) return;
      const cell = frame % perSheet;
      context.drawImage(
        sheet,
        (cell % SHEET_COLUMNS) * SHEET_FRAME_WIDTH,
        Math.floor(cell / SHEET_COLUMNS) * SHEET_FRAME_HEIGHT,
        SHEET_FRAME_WIDTH,
        SHEET_FRAME_HEIGHT,
        0,
        0,
        SHEET_FRAME_WIDTH,
        SHEET_FRAME_HEIGHT,
      );
      texture.needsUpdate = true;
    },
    dispose: () => {
      sheets.forEach((image) => { if (image) image.src = ""; });
      texture.dispose();
    },
  };

  for (let index = 0; index < source.sheets.count; index += 1) {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      sheets[index] = image;
      // Sheets are only playable as a contiguous run from the start, so count the prefix.
      while (sheets[loadedSheets]) loadedSheets += 1;
      if (loadedSheets > 0) motion.ready = true;
    }, { once: true });
    image.src = `${source.sheets.dir}/sheet-${index + 1}.webp`;
  }

  return motion;
}

/**
 * A reel frame that repairs itself.
 *
 * Desktop gets the video master and nothing else. Mobile gets the small re-encode, and if no
 * frame has been presented `VIDEO_GIVE_UP_MS` after playback was requested — the signature of
 * a browser that has taken the video somewhere we cannot see — the video is torn down and the
 * sheets take its place for the rest of the visit.
 */
function createReelMotion(source: (typeof reelMotionSources)[number], mobile: boolean): ReelMotion {
  if (!mobile) return createVideoMotion(source, false);

  let backend = createVideoMotion(source, true, () => { window.clearTimeout(giveUpTimer); });
  let giveUpTimer = 0;
  let playRequested = false;
  let swapped = false;

  const swapToSheets = () => {
    if (swapped || backend.ready) return;
    swapped = true;
    backend.dispose();
    backend = createSheetMotion(source);
    if (playRequested) backend.play();
  };

  return {
    projectIndex: source.projectIndex,
    get texture() { return backend.texture; },
    get ready() { return backend.ready; },
    play: () => {
      playRequested = true;
      backend.play();
      if (!swapped && !backend.ready && !giveUpTimer) {
        giveUpTimer = window.setTimeout(swapToSheets, VIDEO_GIVE_UP_MS);
      }
    },
    pause: () => { playRequested = false; backend.pause(); },
    restart: () => backend.restart(),
    tick: (delta: number) => backend.tick(delta),
    dispose: () => {
      window.clearTimeout(giveUpTimer);
      backend.dispose();
    },
  } as ReelMotion;
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
    // 04 · THE LAB — a manila folder with the real experiment index on its face.
    const fx = x + width * 0.14;
    const fy = y + height * 0.2;
    const fw = width * 0.72;
    const fh = height * 0.62;
    context.fillStyle = `${ink}14`;
    context.fillRect(fx + 14, fy + 18, fw, fh);
    context.fillStyle = `${ink}e8`;
    context.beginPath();
    context.moveTo(fx, fy + 26);
    context.lineTo(fx, fy);
    context.lineTo(fx + fw * 0.34, fy);
    context.lineTo(fx + fw * 0.4, fy + 26);
    context.lineTo(fx + fw, fy + 26);
    context.lineTo(fx + fw, fy + fh);
    context.lineTo(fx, fy + fh);
    context.closePath();
    context.fill();
    context.fillStyle = background;
    context.font = "600 15px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("LAB / 实验室", fx + 18, fy + 5);
    const entries = [
      "A-01  CRT / SHADER RESEARCH",
      "A-02  LIVE2D BINDING · 3D CHECK",
      "A-03  PARTICLE PROLOGUE / QTE",
      "A-04  LEITOWER POSTMORTEM",
    ];
    context.font = "500 21px ui-monospace, monospace";
    entries.forEach((entry, line) => {
      context.fillStyle = line === 0 ? accent : `${background}c8`;
      context.fillText(entry, fx + 34, fy + 74 + line * 46);
      context.strokeStyle = `${background}2e`;
      context.beginPath();
      context.moveTo(fx + 30, fy + 104 + line * 46);
      context.lineTo(fx + fw - 34, fy + 104 + line * 46);
      context.stroke();
    });
    // Barcode strip: the folder is a filed object, not a poster.
    let barX = fx + fw - 176;
    while (barX < fx + fw - 40) {
      const bar = 2 + ((barX * 7) % 5);
      context.fillStyle = `${background}d8`;
      context.fillRect(barX, fy + fh - 40, bar, 24);
      barX += bar + 3;
    }
  } else if (projectIndex === 4) {
    // 05 · MY ROOM — line-sketch of the desk until the live 3D room replaces this frame.
    const deskY = y + height * 0.68;
    context.strokeStyle = `${ink}b8`;
    context.lineWidth = 2.5;
    // desk
    context.strokeRect(x + width * 0.16, deskY, width * 0.68, height * 0.05);
    context.beginPath();
    context.moveTo(x + width * 0.2, deskY + height * 0.05);
    context.lineTo(x + width * 0.2, deskY + height * 0.2);
    context.moveTo(x + width * 0.78, deskY + height * 0.05);
    context.lineTo(x + width * 0.78, deskY + height * 0.2);
    context.stroke();
    // monitor
    context.strokeRect(x + width * 0.3, deskY - height * 0.3, width * 0.26, height * 0.24);
    context.beginPath();
    context.moveTo(x + width * 0.43, deskY - height * 0.06);
    context.lineTo(x + width * 0.43, deskY);
    context.stroke();
    // lamp
    context.beginPath();
    context.moveTo(x + width * 0.68, deskY);
    context.lineTo(x + width * 0.72, deskY - height * 0.18);
    context.arc(x + width * 0.7, deskY - height * 0.21, width * 0.035, Math.PI * 0.9, Math.PI * 1.9);
    context.stroke();
    context.fillStyle = `${accent}30`;
    context.beginPath();
    context.moveTo(x + width * 0.685, deskY - height * 0.185);
    context.lineTo(x + width * 0.6, deskY);
    context.lineTo(x + width * 0.77, deskY);
    context.closePath();
    context.fill();
    // cat silhouette on the desk
    context.fillStyle = `${ink}c8`;
    context.beginPath();
    context.ellipse(x + width * 0.63, deskY - 12, 26, 14, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + width * 0.655, deskY - 24, 10, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x + width * 0.649, deskY - 32);
    context.lineTo(x + width * 0.653, deskY - 40);
    context.lineTo(x + width * 0.658, deskY - 32);
    context.moveTo(x + width * 0.66, deskY - 32);
    context.lineTo(x + width * 0.665, deskY - 40);
    context.lineTo(x + width * 0.67, deskY - 31);
    context.fill();
    context.fillStyle = accent;
    context.font = "400 64px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("我的房间", x + width / 2, y + height * 0.24);
  } else {
    // 06 · CONTACT — a clapperboard: the reel needs an ending, and the ending is a call sheet.
    const bx = x + width * 0.16;
    const by = y + height * 0.2;
    const bw = width * 0.68;
    const bh = height * 0.56;
    // clap bar
    const stripeH = 34;
    context.save();
    context.beginPath();
    context.rect(bx, by, bw, stripeH);
    context.clip();
    for (let stripe = -1; stripe < 14; stripe += 1) {
      context.fillStyle = stripe % 2 === 0 ? ink : background;
      context.beginPath();
      context.moveTo(bx + stripe * 52, by + stripeH);
      context.lineTo(bx + stripe * 52 + 26, by);
      context.lineTo(bx + stripe * 52 + 78, by);
      context.lineTo(bx + stripe * 52 + 52, by + stripeH);
      context.closePath();
      context.fill();
    }
    context.restore();
    // slate
    context.fillStyle = ink;
    context.fillRect(bx, by + stripeH + 6, bw, bh - stripeH - 6);
    context.fillStyle = background;
    context.font = "500 19px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "top";
    const slate = [
      "SCENE: CONTACT          TAKE: 06",
      "DIR: GALLO LIU          GUANGZHOU",
      "",
      "18520455682@163.com",
      "GITHUB.COM/GALLO233",
      "RESUME / PDF",
    ];
    slate.forEach((line, index) => {
      context.fillStyle = index === 3 ? accent : `${background}${index < 2 ? "d8" : "b8"}`;
      context.fillText(line, bx + 30, by + stripeH + 34 + index * 38);
    });
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

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function buildAtlas(posters: Array<HTMLImageElement | null>) {
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
    const poster = posters.find((image, posterIndex) => reelPosterSources[posterIndex]?.projectIndex === index && image?.complete);
    if (poster) {
      drawCoverImage(context, poster, index * ATLAS_FRAME_WIDTH, 0, ATLAS_FRAME_WIDTH, ATLAS_FRAME_HEIGHT);
    }
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

  const rounded = (width: number, height: number, depth: number, radius: number) => (
    new RoundedBoxGeometry(width, height, depth, 5, radius)
  );
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x171c24,
    roughness: 0.34,
    metalness: 0.66,
    clearcoat: 0.38,
    clearcoatRoughness: 0.34,
  });
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x424b58,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.42,
  });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x0e131a, roughness: 0.54, metalness: 0.44 });
  const blueControllerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00bfe8,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 0.68,
    clearcoatRoughness: 0.2,
  });
  const redControllerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff4058,
    roughness: 0.3,
    metalness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
  });
  const blueFaceMaterial = new THREE.MeshStandardMaterial({ color: 0x049fc1, roughness: 0.48, metalness: 0.18 });
  const redFaceMaterial = new THREE.MeshStandardMaterial({ color: 0xd92e45, roughness: 0.48, metalness: 0.18 });
  const bezelMaterial = new THREE.MeshStandardMaterial({ color: 0x030609, roughness: 0.4, metalness: 0.45 });
  const controlMaterial = new THREE.MeshPhysicalMaterial({ color: 0x11151b, roughness: 0.5, metalness: 0.52, clearcoat: 0.18 });
  const controlTopMaterial = new THREE.MeshStandardMaterial({ color: 0x252d37, roughness: 0.6, metalness: 0.34 });
  const darkInsetMaterial = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9, metalness: 0.08 });
  const cyanMaterial = new THREE.MeshStandardMaterial({ color: 0x7ce9ff, emissive: 0x1f99ba, emissiveIntensity: 1.8, roughness: 0.24 });
  const amberMaterial = new THREE.MeshStandardMaterial({ color: 0xffa15f, emissive: 0x8c2b0e, emissiveIntensity: 1.45, roughness: 0.3 });

  mesh(rounded(4.86, 3.18, 0.66, 0.2), bodyMaterial, "console-core", [0, 0, 0]);
  mesh(rounded(4.62, 2.96, 0.16, 0.16), faceMaterial, "console-face", [0, 0, 0.41]);
  mesh(rounded(1.22, 3.22, 0.68, 0.3), blueControllerMaterial, "left-controller", [-3.04, 0, 0.01]);
  mesh(rounded(1.22, 3.22, 0.68, 0.3), redControllerMaterial, "right-controller", [3.04, 0, 0.01]);
  mesh(rounded(1.06, 3.02, 0.15, 0.25), blueFaceMaterial, "left-controller-face", [-3.04, 0, 0.42]);
  mesh(rounded(1.06, 3.02, 0.15, 0.25), redFaceMaterial, "right-controller-face", [3.04, 0, 0.42]);
  mesh(rounded(0.12, 2.86, 0.72, 0.05), edgeMaterial, "left-rail", [-2.42, 0, 0.01]);
  mesh(rounded(0.12, 2.86, 0.72, 0.05), edgeMaterial, "right-rail", [2.42, 0, 0.01]);
  mesh(rounded(4.36, 2.58, 0.18, 0.18), bezelMaterial, "screen-bezel", [0, 0.08, 0.53]);
  mesh(rounded(4.12, 2.34, 0.08, 0.12), darkInsetMaterial, "screen-inset", [0, 0.08, 0.62]);

  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x000102 });
  mesh(new THREE.PlaneGeometry(4.02, 2.26), screenMaterial, "screen", [0, 0.08, 0.67]);
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0b141a,
    transparent: true,
    opacity: 0.035,
    roughness: 0.08,
    metalness: 0,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  mesh(new THREE.PlaneGeometry(4.04, 2.28), glassMaterial, "screen-glass", [0, 0.08, 0.685]);

  const leftShoulder = mesh(rounded(0.98, 0.26, 0.72, 0.12), controlMaterial, "left-shoulder", [-3.04, 1.63, -0.02]);
  const rightShoulder = mesh(rounded(0.98, 0.26, 0.72, 0.12), controlMaterial, "right-shoulder", [3.04, 1.63, -0.02]);
  leftShoulder.rotation.z = -0.018;
  rightShoulder.rotation.z = 0.018;

  const leftStickBase = mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.17, 36), darkInsetMaterial, "left-stick-base", [-3.04, 0.72, 0.63]);
  leftStickBase.rotation.x = Math.PI / 2;
  const leftStick = mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.2, 36), controlTopMaterial, "left-stick", [-3.04, 0.72, 0.76]);
  leftStick.rotation.x = Math.PI / 2;
  const rightStickBase = mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.17, 36), darkInsetMaterial, "right-stick-base", [3.04, -0.72, 0.63]);
  rightStickBase.rotation.x = Math.PI / 2;
  const rightStick = mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.2, 36), controlTopMaterial, "right-stick", [3.04, -0.72, 0.76]);
  rightStick.rotation.x = Math.PI / 2;

  const dpadHorizontal = mesh(rounded(0.86, 0.29, 0.2, 0.09), controlMaterial, "dpad-horizontal", [-3.04, -0.58, 0.68]);
  const dpadVertical = mesh(rounded(0.29, 0.86, 0.2, 0.09), controlMaterial, "dpad-vertical", [-3.04, -0.58, 0.69]);
  pressables.up = dpadVertical;
  pressables.down = dpadVertical;
  pressables.left = dpadHorizontal;
  pressables.right = dpadHorizontal;

  const faceButtons = [
    ["y", 3.04, 1.0],
    ["x", 2.72, 0.68],
    ["b", 3.36, 0.68],
    ["a", 3.04, 0.36],
  ] as const;
  faceButtons.forEach(([name, x, y]) => {
    const button = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.16, 32), controlTopMaterial, `button-${name}`, [x, y, 0.72]);
    button.rotation.x = Math.PI / 2;
    pressables[name] = button;
  });
  pressables.select = mesh(rounded(0.52, 0.17, 0.13, 0.08), controlMaterial, "select", [-0.34, -1.18, 0.66]);
  pressables.start = mesh(rounded(0.52, 0.17, 0.13, 0.08), controlMaterial, "start", [0.34, -1.18, 0.66]);

  const ventPositions = [-0.24, -0.08, 0.08, 0.24];
  for (const offset of ventPositions) {
    const leftVent = mesh(rounded(0.08, 0.34, 0.08, 0.035), darkInsetMaterial, "left-vent", [-1.6 + offset, -1.3, 0.65]);
    leftVent.rotation.z = -0.32;
    const rightVent = mesh(rounded(0.08, 0.34, 0.08, 0.035), darkInsetMaterial, "right-vent", [1.6 + offset, -1.3, 0.65]);
    rightVent.rotation.z = -0.32;
  }
  mesh(rounded(0.2, 0.06, 0.06, 0.03), cyanMaterial, "cyan-status", [-3.04, -1.3, 0.69]);
  mesh(rounded(0.2, 0.06, 0.06, 0.03), amberMaterial, "amber-status", [3.04, -1.3, 0.69]);

  for (const x of [-3.34, 3.34]) {
    for (const y of [-1.24, 1.24]) {
      const fastener = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), darkInsetMaterial, "fastener", [x, y, 0.55]);
      fastener.rotation.x = Math.PI / 2;
    }
  }

  group.rotation.order = "YXZ";
  return {
    group,
    pressables,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      new Set(materials).forEach((material: any) => material.dispose?.());
    },
  };
}

/**
 * The stage: one canvas, one WebGL context, every fullscreen scene on the page.
 *
 * It renders the hero terminal into slot A and the film reel into slot B, blends
 * them by the same reveal the CSS layers used to cross-fade on, and puts the result
 * through `postfx.ts` — one pane of glass over both worlds instead of two canvases
 * under a stack of CSS approximations.
 *
 * The About room keeps its own small context on purpose. It is a panel widget in a
 * box, not a fullscreen layer that cross-fades with anything, so folding it in here
 * would buy a scissor rectangle and no seam.
 */
function FilmCanvas({
  step,
  revealRef,
  entryRef,
  exitRef,
  roomPresenceRef,
  onStepChange,
  onProjectOpen,
  onReady,
  onHeroReady,
  deckOpen,
  deckRpm,
  deckProgress,
  resetDeckViewRef,
  onSeaStateChange,
  onRoomHover,
  onRoomPick,
  onRecordDocked,
  recordPlaying,
  onDragStateChange,
}: {
  step: number;
  /** Live reel reveal, 0 before it arrives to 1 once it has. */
  revealRef: { current: number };
  /** Hero journey, 0 at the top to 1 when the reel has fully arrived. */
  entryRef: { current: number };
  /** How far the reel has handed over to the closing panels, 0 to 1. */
  exitRef: { current: number };
  /** The room belongs to About only and fades before Contact takes ownership. */
  roomPresenceRef: { current: number };
  /** True while the reader is at the deck, which is what puts the camera on it. */
  deckOpen: boolean;
  /** 33⅓ or 45; the platter follows it. */
  deckRpm: number;
  /** How far through the side the music is, for the tonearm. Null when stopped. */
  deckProgress: number | null;
  /** Filled in here so the deck's ROTATE button can reach the camera. */
  resetDeckViewRef: { current: () => void };
  onStepChange: (step: number) => void;
  onProjectOpen: (href: string) => void;
  onReady: () => void;
  onHeroReady: () => void;
  /** Fired when the sea moves to a new state, for the HUD readout. */
  onSeaStateChange: (index: number) => void;
  onRoomHover: (id: RoomObjectId | null) => void;
  onRoomPick: (id: RoomObjectId | null) => void;
  /** A record was carried onto the turntable. */
  onRecordDocked: (id: string) => void;
  /** True while a mix is playing, so the platter turns. */
  recordPlaying: boolean;
  /** Lets the scroll driver suspend snapping while the reader is dragging the reel. */
  onDragStateChange: (active: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posterRefs = useRef<Array<HTMLImageElement | null>>([]);
  const stepRef = useRef(step);
  const onStepChangeRef = useRef(onStepChange);
  const onProjectOpenRef = useRef(onProjectOpen);
  const onReadyRef = useRef(onReady);
  const onDragStateChangeRef = useRef(onDragStateChange);
  const onHeroReadyRef = useRef(onHeroReady);
  const deckOpenRef = useRef(deckOpen);
  const deckRpmRef = useRef(deckRpm);
  const deckProgressRef = useRef(deckProgress);
  useEffect(() => { deckOpenRef.current = deckOpen; }, [deckOpen]);
  useEffect(() => { deckRpmRef.current = deckRpm; }, [deckRpm]);
  useEffect(() => { deckProgressRef.current = deckProgress; }, [deckProgress]);
  const onSeaStateChangeRef = useRef(onSeaStateChange);
  const onRoomHoverRef = useRef(onRoomHover);
  const onRoomPickRef = useRef(onRoomPick);
  const onRecordDockedRef = useRef(onRecordDocked);
  const recordPlayingRef = useRef(recordPlaying);
  useEffect(() => { onRoomHoverRef.current = onRoomHover; }, [onRoomHover]);
  useEffect(() => { onRoomPickRef.current = onRoomPick; }, [onRoomPick]);
  useEffect(() => { onRecordDockedRef.current = onRecordDocked; }, [onRecordDocked]);
  useEffect(() => { recordPlayingRef.current = recordPlaying; }, [recordPlaying]);
  useEffect(() => { onDragStateChangeRef.current = onDragStateChange; }, [onDragStateChange]);
  useEffect(() => { onHeroReadyRef.current = onHeroReady; }, [onHeroReady]);
  useEffect(() => { onSeaStateChangeRef.current = onSeaStateChange; }, [onSeaStateChange]);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { onStepChangeRef.current = onStepChange; }, [onStepChange]);
  useEffect(() => { onProjectOpenRef.current = onProjectOpen; }, [onProjectOpen]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tier = detectQuality();
    const reducedMotion = tier.reducedMotion;
    const isMobile = tier.isMobile;
    // One context for the whole stage. MSAA over a full-screen canvas costs more on a
    // phone than the softer edges are worth — and the post chain resolves most edges
    // anyway, because everything it touches has been through a bloom pyramid.
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: tier.antialias,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = tier.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const post = createPostChain(renderer, tier);

    /*
     * The sea, drawn into its own target and handed to the terminal's glass as a
     * picture. Two things make this a target rather than geometry in the hero scene:
     * the screen's rounded mask, vignette and scanlines then apply to it for free, and
     * the hero camera is busy flying into the screen while the sea's camera has to hold
     * still on the horizon.
     *
     * HalfFloat is not a nicety here. Sun glitter runs well above 1.0, and a byte target
     * would clip it flat *before* the chain tone maps — the glitter would neither
     * sparkle nor register with the bloom, which is where most of the expensive read
     * lives. Same capability probe the post chain uses.
     */
    const oceanCanHalfFloat =
      renderer.capabilities.isWebGL2 || renderer.extensions.has("EXT_color_buffer_half_float");
    const oceanWidth = tier.isMobile ? 768 : 1280;
    // The screen mesh is scaled 10.15 x 7.875; match it or the horizon arrives stretched.
    const oceanHeight = Math.round(oceanWidth / (10.15 / 7.875));
    const oceanTarget = new THREE.WebGLRenderTarget(oceanWidth, oceanHeight, {
      type: oceanCanHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      // Keep the depth buffer. It looks droppable — one opaque mesh and a sky that
      // does not depth-test — but the sea's grid is indexed near row first, so without
      // depth testing a far row would paint straight over the near crest that occludes
      // it. The waves would quietly render inside out.
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    // Linear, not sRGB: tagging it sRGB would make three decode on sample and the chain
    // would lose a transfer function it needs. Same reasoning as `postfx.ts`.
    oceanTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const ocean = createOceanScene({
      isMobile: tier.isMobile,
      reducedMemory: tier.reducedMemory,
      reducedMotion: tier.reducedMotion,
      aspect: oceanWidth / oceanHeight,
    });

    const hero = createHeroScene({
      isMobile: tier.isMobile,
      reducedMotion: tier.reducedMotion,
      shadows: tier.shadows,
      screenMap: oceanTarget.texture,
      onModelReady: () => onHeroReadyRef.current(),
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 305);
    camera.position.set(0, 0, 5);
    const curve = buildCurve();
    const curveLength = curve.getLength();
    const geometry = buildFilmGeometry(curve);
    const atlas = buildAtlas(posterRefs.current);
    const texture = new THREE.CanvasTexture(atlas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // The drawn frames spend most of their time receding around the curve. A static
    // atlas can afford a mip pyramid, which lets the existing anisotropic filter follow
    // that long oblique footprint instead of aliasing or smearing across it.
    texture.generateMipmaps = !isMobile;
    texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const posterListeners: Array<{ image: HTMLImageElement; draw: () => void }> = [];
    reelPosterSources.forEach((source, index) => {
      const image = posterRefs.current[index];
      if (!image) return;
      const draw = () => {
        const context = atlas.getContext("2d");
        if (!context) return;
        drawCoverImage(
          context,
          image,
          source.projectIndex * ATLAS_FRAME_WIDTH,
          0,
          ATLAS_FRAME_WIDTH,
          ATLAS_FRAME_HEIGHT,
        );
        texture.needsUpdate = true;
      };
      if (image.complete && image.naturalWidth) draw();
      else image.addEventListener("load", draw, { once: true });
      posterListeners.push({ image, draw });
    });
    const reelMotions = reelMotionSources.map((source) => createReelMotion(source, isMobile));
    let activeMotionProject = -1;

    const nightTideTarget = new THREE.WebGLRenderTarget(LIVE_FRAME_WIDTH, LIVE_FRAME_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    nightTideTarget.texture.colorSpace = THREE.SRGBColorSpace;
    nightTideTarget.texture.generateMipmaps = false;
    const nightTideScene = new THREE.Scene();
    const studioCanvas = document.createElement("canvas");
    studioCanvas.width = 1024;
    studioCanvas.height = 768;
    const studioContext = studioCanvas.getContext("2d");
    if (studioContext) {
      const field = studioContext.createLinearGradient(0, 0, 0, studioCanvas.height);
      field.addColorStop(0, "#fbfcfd");
      field.addColorStop(0.62, "#f2f4f5");
      field.addColorStop(1, "#d8dde1");
      studioContext.fillStyle = field;
      studioContext.fillRect(0, 0, studioCanvas.width, studioCanvas.height);

      const halo = studioContext.createRadialGradient(540, 278, 30, 540, 310, 630);
      halo.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      halo.addColorStop(0.52, "rgba(255, 255, 255, 0.58)");
      halo.addColorStop(1, "rgba(233, 237, 240, 0)");
      studioContext.fillStyle = halo;
      studioContext.fillRect(0, 0, studioCanvas.width, studioCanvas.height);

      studioContext.save();
      studioContext.translate(520, 612);
      studioContext.scale(1, 0.2);
      const shadow = studioContext.createRadialGradient(0, 0, 10, 0, 0, 420);
      shadow.addColorStop(0, "rgba(70, 84, 94, 0.24)");
      shadow.addColorStop(0.58, "rgba(91, 106, 116, 0.1)");
      shadow.addColorStop(1, "rgba(91, 106, 116, 0)");
      studioContext.fillStyle = shadow;
      studioContext.beginPath();
      studioContext.arc(0, 0, 430, 0, Math.PI * 2);
      studioContext.fill();
      studioContext.restore();
    }
    const studioTexture = new THREE.CanvasTexture(studioCanvas);
    studioTexture.colorSpace = THREE.SRGBColorSpace;
    studioTexture.minFilter = THREE.LinearFilter;
    studioTexture.magFilter = THREE.LinearFilter;
    studioTexture.generateMipmaps = false;
    nightTideScene.background = studioTexture;
    const nightTideCamera = new THREE.PerspectiveCamera(
      34,
      LIVE_FRAME_WIDTH / LIVE_FRAME_HEIGHT,
      0.1,
      100,
    );
    nightTideCamera.position.set(0, 0.16, 9.25);
    nightTideCamera.lookAt(0, 0.05, 0);
    nightTideScene.add(new THREE.AmbientLight(0xb8deea, 2.25));
    const tideKeyLight = new THREE.DirectionalLight(0xb7e9ff, 5.4);
    tideKeyLight.position.set(-3, 5, 6);
    nightTideScene.add(tideKeyLight);
    const tideRimLight = new THREE.PointLight(0xea704e, 14, 18, 2);
    tideRimLight.position.set(3.6, -1.1, 3.5);
    nightTideScene.add(tideRimLight);
    const tideFillLight = new THREE.PointLight(0x5ecbea, 9, 16, 2);
    tideFillLight.position.set(-4.2, -0.8, 4.5);
    nightTideScene.add(tideFillLight);
    const nightTideModel = buildHandheldModel();
    nightTideModel.group.rotation.set(-0.075, 0.13, -0.025);
    nightTideModel.group.position.y = -0.04;
    nightTideScene.add(nightTideModel.group);

    // Frame 05's live scene: the room, rendered the same way the handheld is — into a
    // high-density target, only while the reader is near enough to be sampling it.
    const roomTarget = new THREE.WebGLRenderTarget(LIVE_FRAME_WIDTH, LIVE_FRAME_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    roomTarget.texture.colorSpace = THREE.SRGBColorSpace;
    roomTarget.texture.generateMipmaps = false;
    const roomScene = createRoomScene();

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
      uJoiVideo: { value: reelMotions[0]?.texture ?? texture },
      uJoiMapVideo: { value: reelMotions[1]?.texture ?? texture },
      uJoiVideoReady: { value: 0 },
      uJoiMapVideoReady: { value: 0 },
      uNightTideMap: { value: nightTideTarget.texture },
      uRoomMap: { value: roomTarget.texture },
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
        uniform float uJoiVideoReady;
        uniform float uJoiMapVideoReady;
        uniform sampler2D uNightTideMap;
        uniform sampler2D uRoomMap;
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
            vec3 fallback = texture2D(uMap, atlasUv).rgb;
            vec3 video = texture2D(uJoiVideo, contentUv).rgb;
            image = mix(fallback, video, uJoiVideoReady);
          } else if (abs(frameIndex - 1.0) < 0.5) {
            vec3 fallback = texture2D(uMap, atlasUv).rgb;
            vec2 mobileVideoUv = vec2(0.125 + contentUv.x * 0.75, contentUv.y);
            vec3 video = texture2D(uJoiMapVideo, mobileVideoUv).rgb;
            image = mix(fallback, video, uJoiMapVideoReady);
          } else if (abs(frameIndex - 2.0) < 0.5) {
            image = texture2D(uNightTideMap, contentUv).rgb;
          } else if (abs(frameIndex - 4.0) < 0.5) {
            image = texture2D(uRoomMap, contentUv).rgb;
          } else {
            image = vec3(
              texture2D(uMap, atlasUv + vec2(chromaOffset, 0.0)).r,
              texture2D(uMap, atlasUv).g,
              texture2D(uMap, atlasUv - vec2(chromaOffset, 0.0)).b
            );
          }
          float luminance = dot(image, vec3(0.299, 0.587, 0.114));
          // A uniform whisper of desaturation — the film stock's own voice. No frame is a
          // placeholder any more, so no frame gets washed harder than the rest.
          image = mix(image, vec3(luminance), 0.045);
          image = (image - 0.5) * 1.015 + 0.5;

          bool sideBorder = localX < uBorderX || localX > 1.0 - uBorderX;
          bool topBottom = filmUv.y < uBorderY || filmUv.y > 1.0 - uBorderY;
          vec3 color = (sideBorder || topBottom) ? vec3(0.007, 0.009, 0.014) : image;

          /*
           * Perforations, inset from a sealed edge.
           *
           * These used to be cut at filmUv.y < 0.047, which reaches the very edge of
           * the ribbon — so the holes opened outward and the strip read as a comb
           * rather than as film. Real stock keeps a continuous rail of base along both
           * edges and punches the perforations inside it. SEAL is that rail.
           */
          const float HOLE_SEAL = 0.016;   // continuous film base at the outer edge
          const float HOLE_INNER = 0.060;  // how far in the perforation row reaches
          const float HOLE_RADIUS = 0.34;  // corner rounding, in hole-local units
          float holePhase = fract(filmDistance * 1.92);
          float edgeBand = min(filmUv.y, 1.0 - filmUv.y);
          float holeCentre = (HOLE_SEAL + HOLE_INNER) * 0.5;
          float holeHalf = (HOLE_INNER - HOLE_SEAL) * 0.5;
          vec2 holeLocal = vec2((holePhase - 0.5) * 2.0, (edgeBand - holeCentre) / holeHalf);
          vec2 holeQ = abs(holeLocal) - vec2(0.56, 1.0) + HOLE_RADIUS;
          float holeSdf = length(max(holeQ, 0.0)) + min(max(holeQ.x, holeQ.y), 0.0) - HOLE_RADIUS;
          if (holeSdf < 0.0) discard;

          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float facing = abs(dot(normalize(vWorldNormal), viewDirection));
          // These frames are already display-authored pictures, not matte cards that
          // need relighting. Keep enough falloff to describe the curve, but never push
          // a front-facing white above display white before bloom even begins.
          float diffuse = 0.30 + 0.62 * pow(facing, 0.72);
          vec3 lightDirection = normalize(vec3(14.0, 7.0, 0.0) - vWorldPosition);
          float sideLight = pow(max(dot(lightDirection, normalize(vWorldNormal)), 0.0), 28.0) * 0.08;
          color = color * diffuse + vec3(0.42, 0.61, 0.78) * sideLight;

          float viewDistance = distance(cameraPosition, vWorldPosition);
          float farFade = smoothstep(12.0, 29.0, viewDistance);
          color = mix(color, vec3(0.008, 0.026, 0.052), farFade * 0.88);

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
      const pixelRatio = Math.min(window.devicePixelRatio || 1, tier.dprCap);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      hero.setSize(width, height);
      post.setSize(width, height, pixelRatio);
      roomScene.setFullAspect(aspect);
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
    /*
     * One canvas now serves both worlds, so it also routes the pointer between them.
     * The old arrangement got this for free: the film layer sat under
     * `pointer-events: none` until the reel arrived. Here the boundary is explicit,
     * and it is the same number the draw gate uses.
     */
    const HERO_OWNS_POINTER_UNTIL = 0.86;
    const heroOwnsPointer = () => entryRef.current < HERO_OWNS_POINTER_UNTIL;
    /** Once the room is the picture, it is also what the pointer is pointing at. */
    const roomOwnsPointer = () =>
      exitRef.current > 0.55 && roomPresenceRef.current > 0.05;
    const roomPointer = { x: 0, y: 0 };
    resetDeckViewRef.current = () => roomScene.resetPlayerOrbit();
    let orbiting = false;
    let orbitX = 0;
    let orbitY = 0;
    let hoveredRoomObject: RoomObjectId | null = null;

    const normalisedPointer = (event: PointerEvent | MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        y: -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1),
      };
    };

    const heroPointerFromEvent = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1;
      const y = -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1);
      hero.setPointer(x, y);
      ocean.setPointer(x, y);
    };

    /**
     * The reel owns the pointer only in the stretch between the other two.
     *
     * Before it, the hero cycles the sea state on click; after it, the room takes
     * hover and picking. `handlePointerDown` used to guard on the hero alone, so on
     * About and Contact every press still opened a reel drag that nothing would ever
     * move — and releasing it counted as a tap, which opened whichever project the
     * playhead happened to be parked on. That is why a click anywhere down there went
     * to /work/joi.
     */
    const reelOwnsPointer = () => !heroOwnsPointer() && !roomOwnsPointer();

    /** Set while a record is being carried, so the drag is not read as a room click. */
    let carryingRecord = false;
    /** Set while the hero's light orb is being carried. */
    let carryingOrb = false;
    /** A drag that actually moved the orb must not also cycle the sea behind it. */
    let orbMoved = false;
    /** Last orb hover state, so a pointer move does not restyle the canvas every frame. */
    let orbHovered = false;

    const handlePointerDown = (event: PointerEvent) => {
      // Nothing on this canvas is text, and a drag that begins a selection drags that
      // selection across every panel behind the stage — which is what turned the whole
      // page coral the moment anyone tried to rotate the deck.
      event.preventDefault();
      // The orb is the hero's one grabbable thing, and it outranks the sea-state click
      // it is sitting in front of.
      if (heroOwnsPointer() && hero.grabOrb(normalisedPointer(event))) {
        carryingOrb = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        return;
      }
      // At the deck the room's usual verbs are suspended: there is one object in shot
      // and dragging turns it, the way you would turn it on a desk.
      if (deckOpenRef.current && roomOwnsPointer()) {
        orbiting = true;
        orbitX = event.clientX;
        orbitY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        return;
      }
      if (roomOwnsPointer()) {
        // A record under the pointer wins over everything else in the room: it is the
        // one thing here that is picked up rather than looked at.
        const grabbed = roomScene.grabRecordAt(normalisedPointer(event));
        if (grabbed) {
          carryingRecord = true;
          canvas.setPointerCapture(event.pointerId);
          canvas.style.cursor = "grabbing";
        }
        return;
      }
      if (!reelOwnsPointer()) return;
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
      if (carryingOrb) {
        hero.moveOrb(normalisedPointer(event));
        return;
      }
      if (orbiting) {
        const bounds = canvas.getBoundingClientRect();
        roomScene.orbitPlayer(
          (event.clientX - orbitX) / Math.max(1, bounds.width),
          (event.clientY - orbitY) / Math.max(1, bounds.height),
        );
        orbitX = event.clientX;
        orbitY = event.clientY;
        return;
      }
      if (heroOwnsPointer()) {
        heroPointerFromEvent(event);
        const overOrb = hero.orbHitTest(normalisedPointer(event));
        if (overOrb !== orbHovered) {
          orbHovered = overOrb;
          canvas.style.cursor = overOrb ? "grab" : "";
        }
        return;
      }
      if (roomOwnsPointer()) {
        const ndc = normalisedPointer(event);
        if (carryingRecord) {
          roomScene.moveRecordTo(ndc);
          return;
        }
        roomPointer.x = ndc.x;
        roomPointer.y = ndc.y;
        const hit = roomScene.raycastAt(ndc);
        if (hit !== hoveredRoomObject) {
          hoveredRoomObject = hit;
          roomScene.setHover(hit);
          onRoomHoverRef.current(hit);
          canvas.style.cursor = hit ? "pointer" : "";
        }
        return;
      }
      pointerPosition(event);
      if (!drag.active) return;
      const limit = width * 0.2;
      drag.offset = THREE.MathUtils.clamp(event.clientX - drag.startX, -limit, limit);
      targetReelOffset = stepRef.current * FRAME_WIDTH - drag.offset / (0.05 * width);
    };
    const finishDrag = (event: PointerEvent, openOnTap: boolean) => {
      if (orbiting) {
        orbiting = false;
        canvas.style.cursor = "";
        try { canvas.releasePointerCapture(event.pointerId); } catch {}
        return;
      }
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
      if (openOnTap && wasTap && project) {
        onProjectOpenRef.current(project.href);
      }
    };
    const dropRecord = (event: PointerEvent) => {
      if (!carryingRecord) return false;
      carryingRecord = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = "";
      const drop = roomScene.releaseRecord();
      if (drop?.docked) onRecordDockedRef.current(drop.id);
      return true;
    };
    const dropOrb = (event: PointerEvent) => {
      if (!carryingOrb) return false;
      carryingOrb = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = orbHovered ? "grab" : "";
      // `releaseOrb` reports whether the orb actually travelled. A press that never moved
      // it is still a plain click on the terminal, and should still turn the sea over.
      orbMoved = hero.releaseOrb();
      return true;
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (dropOrb(event)) return;
      if (dropRecord(event)) return;
      finishDrag(event, true);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (dropOrb(event)) return;
      if (dropRecord(event)) return;
      finishDrag(event, false);
    };
    const handleLeave = () => {
      hero.setPointer(0, 0);
      ocean.setPointer(0, 0);
      if (orbHovered) {
        orbHovered = false;
        if (!carryingOrb) canvas.style.cursor = "";
      }
      roomPointer.x = 0;
      roomPointer.y = 0;
      if (hoveredRoomObject) {
        hoveredRoomObject = null;
        roomScene.setHover(null);
        onRoomHoverRef.current(null);
        canvas.style.cursor = "";
      }
      if (!drag.active) targetPointer.set(0, 0);
    };
    // Clicking the terminal moves the sea on to its next state — the hero's one
    // interaction, and it must not fire once the reel owns the surface.
    const handleClick = (event: MouseEvent) => {
      if (heroOwnsPointer()) {
        // Putting the orb down fires a click on the canvas too. Swallow that one, or
        // moving the light would also turn the weather over behind it.
        if (orbMoved) {
          orbMoved = false;
          return;
        }
        const next = ocean.cycleSeaState();
        hero.setSeaState(next);
        onSeaStateChangeRef.current(next);
        return;
      }
      if (!roomOwnsPointer() || carryingRecord || deckOpenRef.current) return;
      const hit = roomScene.raycastAt(normalisedPointer(event));
      roomScene.focus(hit);
      onRoomPickRef.current(hit);
    };
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
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    let elapsed = 0;
    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05);

      roomScene.setRecordSpinning(recordPlayingRef.current);

      const reveal = revealRef.current;
      const entry = entryRef.current;
      const exit = exitRef.current;
      const reelVisible = reveal > 0.001;
      const heroVisible = entry < HERO_OWNS_POINTER_UNTIL;

      // A hidden tab suspends nothing by itself, and the reel sits at reveal 0 for the
      // whole hero section. The first pass always runs: `onReady` fires from inside it
      // and the boot loader waits on that.
      if (readySent && document.hidden) {
        reelMotions.forEach((motion) => motion.pause());
        frame = window.requestAnimationFrame(render);
        return;
      }
      if (!reelVisible) reelMotions.forEach((motion) => motion.pause());

      if (!drag.active && observedStep !== stepRef.current) {
        observedStep = stepRef.current;
        targetReelOffset = observedStep * FRAME_WIDTH;
      }

      // The texture is re-read every frame because the mobile backend can swap from video
      // to sprite sheets mid-playback; a reference captured at setup would go stale.
      const joiMotion = reelMotions[0];
      const mobileMotion = reelMotions[1];
      if (joiMotion) {
        uniforms.uJoiVideo.value = joiMotion.texture;
        uniforms.uJoiVideoReady.value = joiMotion.ready ? 1 : 0;
      }
      if (mobileMotion) {
        uniforms.uJoiMapVideo.value = mobileMotion.texture;
        uniforms.uJoiMapVideoReady.value = mobileMotion.ready ? 1 : 0;
      }

      const activeProject = modulo(stepRef.current, projects.length);
      const wantsMotion = revealRef.current > 0.4 && !reducedMotion;
      if (activeProject !== activeMotionProject) {
        reelMotions.find((motion) => motion.projectIndex === activeMotionProject)?.pause();
        const next = reelMotions.find((motion) => motion.projectIndex === activeProject);
        if (next) {
          next.restart();
          if (wantsMotion) next.play();
        }
        activeMotionProject = activeProject;
      }
      const activeMotion = reelMotions.find((motion) => motion.projectIndex === activeMotionProject);
      if (activeMotion) {
        if (wantsMotion) activeMotion.play();
        else activeMotion.pause();
        activeMotion.tick(delta);
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
      // The Night Tide handheld is a whole second scene drawn into a 768×576 target. It only
      // feeds frame 03, so rendering it while the reader is three frames away was paying for
      // an offscreen pass sixty times a second to light a texture nobody was sampling.
      const nightTideDistance = Math.min(
        modulo(activeProject - 2, projects.length),
        modulo(2 - activeProject, projects.length),
      );
      if (nightTideDistance <= 1) {
        nightTideModel.group.rotation.y = 0.22 + Math.sin(uniforms.uTime.value * 0.005) * 0.28;
        nightTideModel.group.rotation.z = -0.06 + Math.sin(uniforms.uTime.value * 0.003) * 0.045;
        nightTideModel.group.position.y = Math.sin(uniforms.uTime.value * 0.006) * 0.16;
        nightTideCamera.lookAt(0, nightTideModel.group.position.y, 0);
        renderer.setRenderTarget(nightTideTarget);
        renderer.clear();
        renderer.render(nightTideScene, nightTideCamera);
        renderer.setRenderTarget(null);
      }

      /*
       * The room has two jobs: it is the picture inside reel frame 05, and once the
       * reel hands over it is the whole stage — the reader walks out of the machine
       * and into the room it was sitting in. One scene, two cameras, updated once.
       */
      const roomDistance = Math.min(
        modulo(activeProject - 4, projects.length),
        modulo(4 - activeProject, projects.length),
      );
      const roomPresence = roomPresenceRef.current;
      const roomIsStage = roomPresence > 0.001;
      // The deck owns the camera, the platter speed and the tonearm while it is open.
      roomScene.setPlayerMode(deckOpenRef.current && roomIsStage);
      roomScene.setPlatterRpm(deckRpmRef.current);
      roomScene.setTonearm(deckProgressRef.current);
      if (roomDistance <= 1 || roomIsStage) roomScene.update(performance.now(), roomPointer);
      if (roomDistance <= 1) {
        renderer.setRenderTarget(roomTarget);
        renderer.clear();
        renderer.render(roomScene.scene, roomScene.frameCamera);
        renderer.setRenderTarget(null);
      }

      /*
       * The stage, in order: hero into slot A, reel into slot B, then one chain over
       * both. A scene that is not on screen is not drawn — but its slot is cleared,
       * because a stale slot blended at even a hundredth would show yesterday's frame
       * ghosted behind today's.
       */
      if (heroVisible || !readySent) {
        ocean.setLodBias(
          Math.log2(Math.max(1, oceanWidth / Math.max(1, hero.screenPixelWidth()))),
        );
        ocean.update(delta);
        renderer.setRenderTarget(oceanTarget);
        renderer.clear();
        renderer.render(ocean.scene, ocean.camera);
        renderer.setRenderTarget(null);
      }

      hero.update(delta, entry);
      // The orb's scattering buffer is a target of its own, so it has to be drawn before
      // the stage target is bound — and only when the hero is what is being drawn.
      if (!roomIsStage && (heroVisible || !readySent)) hero.prepare(renderer);
      renderer.setRenderTarget(post.slotA);
      renderer.clear();
      if (roomIsStage) renderer.render(roomScene.scene, roomScene.fullCamera);
      else if (heroVisible || !readySent) renderer.render(hero.scene, hero.camera);

      renderer.setRenderTarget(post.slotB);
      renderer.clear();
      if (reelVisible || !readySent) renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      /*
       * The glass is not a constant. Inside the terminal the picture is nearly flat
       * and quiet; as the reel arrives the tube asserts itself — more curvature,
       * more colour split, more grain — because that is the moment the page stops
       * being a room with a computer in it and becomes the computer's own output.
       */
      /*
       * Leaving the reel is a push, not a dissolve. The ribbon comes at the camera
       * through the exit and the room is already behind it, so the cut lands at the
       * moment the film is too close to read — you go through the picture rather
       * than watching it fade.
       */
      camera.position.z = 5 - exit * 3.1;
      camera.fov = 65 + exit * 14;
      camera.updateProjectionMatrix();

      // How much of the frame the reel still owns. The reel arrives on `reveal` and
      // leaves on `exit`; `reveal` saturates at the anchor and never comes back down on
      // its own, which is what used to leave the film hanging behind About and Contact.
      // The handover is deliberately late and quick: the reel holds the frame while it
      // pushes in, then gives way over the last third of the exit.
      const reelOwnsFrame = reveal * (1 - smoothStep((exit - 0.62) / 0.3));

      // The curved glass belongs to the reel and to nothing else.
      //
      // It used to be on everywhere — 0.42 under the hero before the reel had even
      // arrived, 0.2 still bending the room afterwards — which put a lens on two
      // sections that are not looking through one. The hero is a scene and the room is
      // a room; only the reel is footage inside a tube. So both the distortion and the
      // colour split it drags with it now ride `reelOwnsFrame`, the same term the
      // composite blend uses, and reach zero the moment the reel hands the frame over.
      // Note that the bezel radius and feather are already `mix(0, …, uLensDistortion)`
      // in the shader, so zeroing this takes the rounded corners with it.
      post.uniforms.uLensDistortion.value = THREE.MathUtils.lerp(0.32, 0.72, reveal) * reelOwnsFrame;
      post.uniforms.uChromaticAberrationStrength.value =
        THREE.MathUtils.lerp(0.18, 0.34, reveal) * reelOwnsFrame;

      // Bright application screens need a much tighter CRT response than the dark
      // hero. The old settings added a broad 32% bloom to already relit whites, then
      // split their edges by more than a pixel. Preserve the tube in highlights and
      // sprockets while letting UI text and the original video pixels stay readable.
      post.uniforms.uBloomIntensity.value = roomIsStage
        ? 0.32
        : THREE.MathUtils.lerp(0.32, 0.08, reelOwnsFrame);
      post.uniforms.uBloomThreshold.value = roomIsStage
        ? 0.62
        : THREE.MathUtils.lerp(0.62, 0.78, reelOwnsFrame);
      post.uniforms.uBloomSmoothing.value = roomIsStage
        ? 0.28
        : THREE.MathUtils.lerp(0.28, 0.16, reelOwnsFrame);
      post.uniforms.uBloomRadius.value = roomIsStage
        ? 0.5
        : THREE.MathUtils.lerp(0.5, 0.28, reelOwnsFrame);
      post.uniforms.uPhosphorAmount.value = roomIsStage
        ? 0.1
        : THREE.MathUtils.lerp(0.1, 0.035, reelOwnsFrame);
      post.uniforms.uPow.value = roomIsStage
        ? 1
        : THREE.MathUtils.lerp(1, 1.1, reelOwnsFrame);
      post.uniforms.uSharpness.value = roomIsStage
        ? 0
        : THREE.MathUtils.lerp(0, 0.28, reelOwnsFrame);
      post.uniforms.uSepiaIntensity.value = roomIsStage
        ? 0.025
        : THREE.MathUtils.lerp(0.18, 0.035, reelOwnsFrame);
      // The baked room has already gone through its photographic contrast in
      // Blender. A gentler display grade keeps the dark oak, black upholstery and
      // small hardware legible without washing out the window or monitor whites.
      post.uniforms.uBrightness.value = roomIsStage
        ? 1.18
        : THREE.MathUtils.lerp(1, 0.9, reelOwnsFrame);
      post.uniforms.uContrast.value = roomIsStage
        ? 0.86
        : THREE.MathUtils.lerp(1.04, 1, reelOwnsFrame);
      // A little of the last frame while the reel is being thrown, and none of it
      // when the picture is still — persistence on a static frame is just softness.
      post.uniforms.uPersistence.value = roomIsStage
        ? 0
        : Math.min(0.14, Math.abs(reelVelocity) * 0.008);

      elapsed += delta;
      post.render({
        blend: reelOwnsFrame,
        // Slot A is the hero before the reel and the room after it. The room fades
        // away before Contact becomes active, revealing the stage's dark call-sheet
        // field instead of leaking About's desk into the next section.
        slotAOpacity: exit > 0.001 ? roomPresence : 1,
        // Only the hero was authored under Neutral tone mapping, which a render
        // target drops. The room in the same slot never had it.
        toneMapA: roomIsStage ? 0 : 1,
        // No dimming past the reel any more — the room is the picture there, not an
        // afterglow, and dimming it would just make the About section look broken.
        dim: 0,
        elapsed,
      });

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
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
      window.clearTimeout(wheel.resetTimer);
      geometry.dispose();
      material.dispose();
      reelMotions.forEach((motion) => motion.dispose());
      posterListeners.forEach(({ image, draw }) => image.removeEventListener("load", draw));
      texture.dispose();
      studioTexture.dispose();
      nightTideModel.dispose();
      nightTideTarget.dispose();
      ocean.dispose();
      oceanTarget.dispose();
      roomScene.dispose();
      roomTarget.dispose();
      hero.dispose();
      post.dispose();
      renderer.dispose();
      // `dispose()` releases what Three allocated; the GL context itself lives on
      // until the canvas is collected. A reader bouncing between the reel and a
      // project page can outrun the collector and walk into the browser's
      // per-tab context ceiling, at which point the oldest live context is killed
      // — which is this one, on the way back.
      renderer.forceContextLoss();
    };
  }, []);

  const activeProject = projects[modulo(step, projects.length)];
  const openActiveProject = () => {
    onProjectOpen(activeProject.href);
  };

  return (
    <>
      <div className={styles.reelPreload} aria-hidden="true">
        {reelPosterSources.map((source, index) => (
          <img
            key={source.poster}
            ref={(node) => { posterRefs.current[index] = node; }}
            src={source.poster}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className={`${styles.filmCanvas} ${styles.filmCanvasOpenable}`}
        role="link"
        tabIndex={0}
        aria-label={`Open ${activeProject.title}. Drag horizontally to browse projects.`}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openActiveProject();
        }}
      />
    </>
  );
}

export function JoiSignalLab({ className = "", initialSection = "hero" }: JoiSignalLabProps) {
  const router = useRouter();
  const experienceRef = useRef<HTMLElement>(null);
  const filmActiveRef = useRef(false);
  const [step, setStep] = useState(0);
  const [filmReady, setFilmReady] = useState(false);
  /** Which room object the reader picked — lights the matching interest chip. */
  const [hoveredInterest, setHoveredInterest] = useState<RoomObjectId | null>(null);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  // Which mix the turntable has been loaded with, and whether it is actually sounding.
  // The record on the deck turns off the second, not the first, so a paused deck sits
  // still with the record still on it.
  const [requestedMixId, setRequestedMixId] = useState<string | null>(null);
  const [playingMixId, setPlayingMixId] = useState<string | null>(null);
  const [computerReady, setComputerReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** True while the leave-transition veil covers the stage on the way to a detail page. */
  const [leaving, setLeaving] = useState(false);
  const [seaState, setSeaState] = useState(0);
  /** 33⅓ by default, the way a deck is left. */
  const [deckRpm, setDeckRpm] = useState(33 + 1 / 3);
  const [deckProgress, setDeckProgress] = useState<number | null>(null);
  const resetDeckViewRef = useRef(() => {});
  /** The scroll driver runs outside React, so it closes the deck through a ref. */
  const closeDeckRef = useRef(() => {});
  // Reassigned each render so it closes over the live flag: the scroll driver calls this
  // on every frame it is away from About, and only the first one should do anything.
  closeDeckRef.current = () => { if (musicPlayerOpen) setMusicPlayerOpen(false); };
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);
  const activeIndex = modulo(step, projects.length);
  // The loader doubles as the reference's boot screen: it holds the page (scroll lock in
  // the driver) until every system it fronts for is actually warm.
  const ready = filmReady && computerReady && fontsReady;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const loadedSystems = (filmReady ? 1 : 0) + (computerReady ? 1 : 0) + (fontsReady ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => { if (!cancelled) setFontsReady(true); });
    // Fonts must never hold the machine hostage — a CDN stall boots us anyway.
    const fontFailsafe = window.setTimeout(() => { if (!cancelled) setFontsReady(true); }, 3200);
    /*
     * Nor may anything else. The boot screen holds the page still, so a system that
     * never reports ready is not a slow loader — it is a page nobody can scroll. A
     * missing GLB, a refused WebGL context, a decoder that 404s: all of them end here
     * instead of in a reader staring at a lock they cannot break.
     */
    const bootFailsafe = window.setTimeout(() => {
      if (cancelled) return;
      setFontsReady(true);
      setFilmReady(true);
      setComputerReady(true);
    }, 9000);
    return () => {
      cancelled = true;
      window.clearTimeout(fontFailsafe);
      window.clearTimeout(bootFailsafe);
    };
  }, []);

  // The reference focuses its scroll container when the intro releases; focusing the
  // stage means arrow keys work immediately without a click.
  useEffect(() => {
    if (ready) experienceRef.current?.focus({ preventScroll: true });
  }, [ready]);

  // Returning from a detail page: land back on the frame the reader left from.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("reel:return");
      if (!raw) return;
      sessionStorage.removeItem("reel:return");
      const saved = JSON.parse(raw) as { step?: number };
      if (typeof saved.step === "number") setStep(saved.step);
    } catch {
      // Malformed state is not worth a crash on the way home.
    }
  }, []);

  // Scroll-derived values live in refs and go straight to CSS variables. Nothing here re-renders
  // per frame — the reference keeps these in motion values for the same reason.
  const entryRef = useRef(0);
  const filmRevealRef = useRef(0);
  const reelExitRef = useRef(0);
  /** About's full-stage room fades out before Contact owns the address and copy. */
  const roomPresenceRef = useRef(0);
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
      // With the anchor at 2 screens the crossfade occupies screens 1.0→1.7 — roughly
      // three times yesterday's window — and still completes before the anchor, so the
      // /selected-work deep link keeps landing on a fully arrived reel.
      const filmReveal = smoothStep((entry - 0.5) / 0.35);
      const aboutStart = getSection("about-me").position;
      const contactStart = getSection("contact").position;
      const reelExit = smoothStep((screens - (aboutStart - 0.8)) / 0.8);
      // `sectionAt` hands the route to Contact 0.35 screens before its anchor. Finish
      // the room fade at that same boundary so a /contact landing never inherits the
      // About scene, while the last stretch of About gets a deliberate exit.
      const contactOwnership = contactStart - 0.35;
      const roomExit = smoothStep((screens - (contactOwnership - 0.35)) / 0.35);
      const roomPresence = reelExit * (1 - roomExit);

      entryRef.current = entry;
      filmRevealRef.current = filmReveal;
      reelExitRef.current = reelExit;
      roomPresenceRef.current = roomPresence;
      if (roomPresence < 0.35) closeDeckRef.current();
      filmActiveRef.current = filmReveal > 0.55 && screens < aboutStart - 0.4;

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
    // The boot screen holds the page still until every system is warm.
    bootLocked: () => !readyRef.current,
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
      tabIndex={-1}
      className={`${styles.experience} ${className}`}
      style={{
        // Scroll length comes from the section table, so adding a section extends the page.
        height: `${TOTAL_SCREENS * 100}svh`,
        "--computer-scale": 1,
      } as CSSProperties}
    >
      <div className={styles.stage}>
        <div className={styles.heroField} aria-hidden="true" />

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
            <strong>{seaStateLabels[seaState]}</strong>
          </div>
          <p><span>MOVE</span> WIND · <span>CLICK</span> SEA STATE</p>
          <em>{String(seaState + 1).padStart(2, "0")} / 04</em>
        </aside>

        <section
          className={`${styles.filmLayer} ${activeSection === "selected-work" ? styles.filmLayerActive : ""}`}
          aria-label="Selected Joi work"
        >
          <div className={styles.blueField} aria-hidden="true" />
        </section>

        {/*
          The stage canvas sits above both CSS backdrops and carries every fullscreen
          scene. It is deliberately outside `.filmLayer`: that layer's opacity and
          clip-path are the reel's arrival, and applying them to the canvas would fade
          the hero out along with the reel it is handing over to.
        */}
        <div className={styles.stageLayer}>
          <FilmCanvas
            step={step}
            revealRef={filmRevealRef}
            entryRef={entryRef}
            exitRef={reelExitRef}
            roomPresenceRef={roomPresenceRef}
            deckOpen={musicPlayerOpen}
            deckRpm={deckRpm}
            deckProgress={deckProgress}
            resetDeckViewRef={resetDeckViewRef}
            onHeroReady={() => setComputerReady(true)}
            onSeaStateChange={setSeaState}
            onRoomHover={setHoveredInterest}
            onRoomPick={(id) => {
              if (id === "joi-music-box") setMusicPlayerOpen(true);
            }}
            onRecordDocked={(recordId) => {
              // The wall hangs the records in the same order the panel lists the mixes.
              const index = RECORD_IDS.indexOf(recordId as never);
              const mixId = MIX_ORDER[index] ?? MIX_ORDER[0];
              setRequestedMixId(mixId);
            }}
            recordPlaying={playingMixId !== null}
            onStepChange={setStep}
            onProjectOpen={(href) => {
              // Frames whose destination is a section of this page scroll instead of
              // navigating — a route push would remount the lab and replay the boot.
              const section = SECTIONS.find((entry) => entry.path === href);
              if (section) {
                scrollToSection.current(section.id);
                return;
              }
              if (leaving) return;
              // Stepping out of the machine: remember the frame for the way back, veil
              // the stage in the detail pages' own paper colour, then navigate under it.
              try {
                sessionStorage.setItem("reel:return", JSON.stringify({ step }));
                sessionStorage.setItem("reel:arrive", "1");
              } catch {}
              setLeaving(true);
              window.setTimeout(() => router.push(href), 300);
            }}
            onReady={() => setFilmReady(true)}
            onDragStateChange={(active: boolean) => { dragActiveRef.current = active; }}
          />
        </div>

        <JoiMusicPlayer
          open={musicPlayerOpen}
          onClose={() => setMusicPlayerOpen(false)}
          requestedMixId={requestedMixId}
          onPlayingChange={setPlayingMixId}
          onProgressChange={setDeckProgress}
          rpm={deckRpm}
          onRpmChange={setDeckRpm}
          onResetView={() => resetDeckViewRef.current()}
        />

        <section
          className={`${styles.filmUi} ${activeSection === "selected-work" ? styles.filmLayerActive : ""}`}
          aria-label="Selected Joi work"
        >
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
                  aria-pressed={index === activeIndex}
                />
              ))}
            </div>
            <button type="button" onClick={() => setStep((value) => value + 1)} aria-label="Next project"><span>→</span></button>
          </div>

          <p className={styles.hint}>
            CLICK TO OPEN
            <span>·</span>
            DRAG TO BROWSE
          </p>
        </section>

        {/*
          The closing panels. Their scroll positions live in `sections.ts`; the header nav
          scrolls to them, and `--about-progress` / `--contact-progress` are written every
          frame. The 3D room and the lanyard badge mount beside the About copy — those land
          with the room build and read the same activeSection state.
        */}
        {/*
          The room is the stage itself once the reel hands over, so what is left on
          this layer is the badge — and the label for whatever object the reader is
          pointing at out there in the room.
        */}
        <div
          className={`${styles.aboutScene} ${activeSection === "about-me" ? styles.aboutSceneActive : ""}`}
        >
          {hoveredInterest && (
            <p className={styles.roomLabel} aria-hidden="true">
              {ROOM_OBJECTS.find((entry) => entry.id === hoveredInterest)?.labelZh}
              <span>{ROOM_OBJECTS.find((entry) => entry.id === hoveredInterest)?.label}</span>
            </p>
          )}
        </div>

        {/*
          The badge hangs over Contact, not over the room. It is a call sheet's object —
          a name, a role, a way to reach someone — and on About it was competing with
          the desk for the same corner of the frame.
        */}
        <div
          className={`${styles.contactScene} ${activeSection === "contact" ? styles.contactSceneActive : ""}`}
        >
          <div className={styles.badgeBox}>
            <LanyardBadge active={activeSection === "contact"} />
          </div>
        </div>

        <section
          className={`${styles.closingPanel} ${styles.aboutPanel} ${activeSection === "about-me" ? styles.closingPanelActive : ""}`}
          aria-label="About me"
        >
          {/*
            The About copy has been taken out on purpose. It is being rewritten as labels
            that hang off the objects themselves — the room already carries one, on hover,
            and the rest will join it — so a block of prose sitting over the desk was
            describing what the room is about to say for itself.

            The links stay: they are the only route to the CV from this section, and a
            download is not copy.
          */}
          <div className={styles.closingActions}>
            <a href="/resume/gallo-liu-resume-cn.pdf" download>RESUME / PDF</a>
            <a href="https://github.com/Gallo233" target="_blank" rel="noreferrer">GITHUB</a>
            <a href="mailto:18520455682@163.com">EMAIL</a>
          </div>
        </section>

        <section
          className={`${styles.closingPanel} ${styles.contactPanel} ${activeSection === "contact" ? styles.closingPanelActive : ""}`}
          aria-label="Contact"
        >
          <p className={styles.closingKicker}>04 / CONTACT — CALL SHEET</p>
          <h2>Let&rsquo;s make technology people can live with.</h2>
          <div className={styles.closingBody}>
            <p lang="zh-CN">在找 AI 产品 / 产品设计的机会，也接有意思的项目。来聊。</p>
          </div>
          <div className={styles.closingActions}>
            <a href="mailto:18520455682@163.com">18520455682@163.COM</a>
            <a href="https://github.com/Gallo233" target="_blank" rel="noreferrer">GITHUB / GALLO233</a>
            <a href="/resume/gallo-liu-resume-cn.pdf" download>RESUME / PDF</a>
          </div>
          <p className={styles.closingMeta}>GUANGZHOU · GMT+8 · 2026</p>
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
          <button
            type="button"
            className={styles.menu}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </button>
        </header>

        {menuOpen && (
          <div
            className={styles.menuSheet}
            role="dialog"
            aria-label="Sections"
            onClick={(event) => {
              if (event.target === event.currentTarget) setMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenuOpen(false);
            }}
          >
            <nav>
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={section.path}
                  aria-current={activeSection === section.id ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    setMenuOpen(false);
                    scrollToSection.current(section.id);
                  }}
                >
                  {section.label}
                </a>
              ))}
              <a href="/lab">THE LAB</a>
              <a href="/play/night-tide">GAME CENTER</a>
            </nav>
          </div>
        )}

        {/* Scanlines and grain now come from the post chain. What stays is the
            vignette, which is the tube's edge over the DOM as well as the canvas. */}
        <div className={styles.vignette} aria-hidden="true" />

        <SiteHUD />

        <div className={`${styles.loader} ${ready ? styles.loaderReady : ""}`} role="status" aria-live="polite">
          <span>GALLO / JOI</span>
          <i />
          <strong>
            BOOTING JOI9000
            <em>{loadedSystems}/3 SYSTEMS</em>
          </strong>
        </div>

        {/* The way out: cream over everything, then the route swap happens under it. */}
        <div className={`${styles.leaveVeil} ${leaving ? styles.leaveVeilActive : ""}`} aria-hidden="true" />
      </div>
    </main>
  );
}
