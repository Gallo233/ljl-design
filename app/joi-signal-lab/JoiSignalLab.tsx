"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { createRoomScene, type RoomLightPreset } from "./room3d";
import type { DeckControlId } from "./roomTurntable";
import { createHeroScene } from "./heroScene";
import { createOceanScene, SEA_STATES } from "./oceanScene";
import { createPostChain } from "./postfx";
import { detectQuality } from "./quality";
import { LanyardBadge } from "./badge/LanyardBadge";
import { JoiMusicPlayer } from "./JoiMusicPlayer";
import { PageTurnCorner } from "./PageTurnCorner";
import { createScrollSignal } from "./scrollSignal";
import { ROOM_OBJECTS, type RoomObjectId } from "./roomObjects";
import { ROOM_BOOKS } from "./roomBooks";
import {
  BooksSheet,
  CartridgeSheet,
  FilmsSheet,
  OrbitButtons,
  PosterSheet,
  RoomAppSheet,
  RoomTimeSwitch,
  TerminalInputBridge,
  type RoomAppId,
  type RoomLightPresetUi,
} from "./roomApps";
import type { RoomTerminalRig } from "./roomTerminal";
import { setRoomTerminalActive } from "./roomTerminalGate";
import { projects, reelMotionSources, reelPosterSources, type ProjectSignal } from "./reelProjects";
import { createReelMotion, modulo, type ReelMotion } from "./reelMotion";
import { ATLAS_FRAME_HEIGHT, ATLAS_FRAME_WIDTH, buildAtlas, drawCoverImage } from "./reelArt";
import { buildHandheldModel } from "./handheldModel";
import { useGlobalMusic } from "../../components/global-music/GlobalMusic";

/**
 * What the DOM layer may ask the room to do. Filled in by FilmCanvas once the scene
 * exists; the sheets, the time switch and the terminal bridge all read it.
 */
type RoomApi = {
  focus: (id: RoomObjectId | null, close?: boolean) => void;
  setLightPreset: (preset: RoomLightPreset) => void;
  setBookSelected: (nodeIndex: number | null) => void;
  pokeProp: (id: "cat" | "balls") => void;
  terminal: RoomTerminalRig;
  orbitZoom: (factor: number) => void;
  orbitReset: () => void;
};

/** Objects whose click opens a reading surface — they get the close-up camera. */
const CLOSE_FOCUS_IDS = new Set<RoomObjectId>(["crt-monitor", "camera", "bookshelf", "poster", "handheld"]);

/** Guangzhou hours: the room wakes in daylight, eases through blue hour, then night. */
const lightPresetForHour = (hour: number): RoomLightPresetUi => {
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 19.5) return "blue";
  return "night";
};

const seaStateLabels = SEA_STATES.map((state) => state.label);

/** Keys the room's terminal claims while it is up — everything else reaches the page. */
const TERMINAL_OWNED_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "Tab",
  "Enter",
  "Backspace",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/** Contact copy becomes legible shortly after the paper starts exposing it. */
const contactPresenceFor = (turn: number) => smoothStep((turn - 0.18) / 0.62);

/**
 * One writer for both scroll and pointer-driven paper motion.
 *
 * The contact sheet grows as a diagonal polygon from the top-right corner. The separate
 * curl follows the hand during a drag and follows a restrained diagonal during scroll,
 * so the two inputs never produce two visibly different transitions.
 */
const applyPageTurnStyle = (
  root: HTMLElement,
  turn: number,
  presence: number,
  dragX = 0,
  dragY = 0,
  dragging = false,
) => {
  const amount = clamp01(turn);
  const restingCorner = Math.min(116, Math.max(82, window.innerWidth * 0.075));
  const defaultX = amount * Math.min(window.innerWidth * 0.82, 1180);
  const defaultY = amount * Math.min(window.innerHeight * 0.82, 760);
  const curlX = dragging ? Math.max(defaultX, dragX) : defaultX;
  const curlY = dragging ? Math.max(defaultY, dragY) : defaultY;
  // Reveal gently for the first four-fifths, then clear the last opposite corner.
  const revealSize = amount < 0.8
    ? amount * 140
    : 112 + ((amount - 0.8) / 0.2) * 108;
  const cornerOpacity = 1 - smoothStep((amount - 0.76) / 0.2);
  const style = root.style;
  style.setProperty("--contact-turn", amount.toFixed(4));
  style.setProperty("--contact-turn-size", `${revealSize.toFixed(2)}%`);
  // A zero-area polygon can still leave a one-pixel filtered seam in some browsers.
  style.setProperty("--contact-page-opacity", smoothStep(amount / 0.035).toFixed(4));
  style.setProperty("--contact-presence", clamp01(presence).toFixed(4));
  style.setProperty("--page-curl-width", `${(restingCorner + curlX).toFixed(1)}px`);
  style.setProperty("--page-curl-height", `${(restingCorner + curlY).toFixed(1)}px`);
  style.setProperty("--page-fold-opacity", (1 - smoothStep((amount - 0.82) / 0.15)).toFixed(4));
  style.setProperty("--page-under-opacity", (1 - smoothStep(amount / 0.32)).toFixed(4));
  style.setProperty("--page-corner-opacity", cornerOpacity.toFixed(4));
};
import { SiteHUD } from "../../components/SiteHUD";
import {
  FOCAL_HANDOFFS,
  REEL_ANCHOR,
  SECTIONS,
  TOTAL_SCREENS,
  clamp01,
  focalHandoffProgress,
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


const FRAME_WIDTH = (4 / 3) * 7.36 + 0.06;
const BORDER_X = 0.03;
const BORDER_Y = 0.07;
// The live procedural frames used to stop at 768×576, below their projected size on
// a Retina display. 1280×960 keeps the handheld and room legible at the front of the
// reel without turning either into a full-viewport render target.
const LIVE_FRAME_WIDTH = 1280;
const LIVE_FRAME_HEIGHT = 960;

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

function FilmCanvas({
  step,
  revealRef,
  entryRef,
  exitRef,
  roomPresenceRef,
  contactTurnRef,
  scrollVelocityRef,
  signalRef,
  onStepChange,
  onProjectOpen,
  onReady,
  onHeroReady,
  deckOpen,
  deckRpm,
  deckVolume,
  deckTone,
  deckProgress,
  deckSide,
  resetDeckViewRef,
  roomApiRef,
  onSeaStateChange,
  onRoomHover,
  onRoomPick,
  recordPlaying,
  onDeckVolumeChange,
  onDeckToneChange,
  onDeckToggle,
  onDeckRpmToggle,
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
  /** About → Contact paper turn, shared by scroll and the draggable corner. */
  contactTurnRef: { current: number };
  /** Scroll speed in screens per second, signed. Drives the tube's grip on the signal. */
  scrollVelocityRef: { current: number };
  /**
   * Filled in here: the smoothed instability, 0 at rest to 1 at speed.
   *
   * The signal is computed on this canvas because this is the loop that has a frame
   * delta, and published so the DOM over the glass can be bent by the same number that
   * bends the picture under it, rather than by a second one that drifts out of step.
   */
  signalRef: { current: number };
  /** True while the reader is at the deck, which is what puts the camera on it. */
  deckOpen: boolean;
  /** 33⅓ or 45; the platter follows it. */
  deckRpm: number;
  deckVolume: number;
  deckTone: number;
  /** How far through the side the music is, for the tonearm. Null when stopped. */
  deckProgress: number | null;
  /** The record currently on the platter, for its live centre label. */
  deckSide: { id?: string; title: string; artist: string; color: string; artwork?: string | null } | null;
  /** Filled in here so the deck's ROTATE button can reach the camera. */
  resetDeckViewRef: { current: () => void };
  /**
   * Filled in here: everything the DOM layer may ask the room — focus, light preset,
   * the reading shelf, prop pokes, and the terminal rig itself. Children mount before
   * parents run effects, so the caller's first effect sees this filled.
   */
  roomApiRef: { current: RoomApi | null };
  onStepChange: (step: number) => void;
  onProjectOpen: (href: string) => void;
  onReady: () => void;
  onHeroReady: () => void;
  /** Fired when the sea moves to a new state, for the HUD readout. */
  onSeaStateChange: (index: number) => void;
  onRoomHover: (id: RoomObjectId | null) => void;
  /** bookIndex is set when the pick landed on one of the shelf's data books. */
  onRoomPick: (id: RoomObjectId | null, bookIndex?: number | null) => void;
  /** True while a mix is playing, so the platter turns. */
  recordPlaying: boolean;
  onDeckVolumeChange: (value: number) => void;
  onDeckToneChange: (value: number) => void;
  onDeckToggle: () => void;
  onDeckRpmToggle: () => void;
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
  const deckVolumeRef = useRef(deckVolume);
  const deckToneRef = useRef(deckTone);
  const deckProgressRef = useRef(deckProgress);
  const deckSideRef = useRef(deckSide);
  const appliedSideRef = useRef<typeof deckSide>(null);
  useEffect(() => { deckOpenRef.current = deckOpen; }, [deckOpen]);
  useEffect(() => { deckRpmRef.current = deckRpm; }, [deckRpm]);
  useEffect(() => { deckVolumeRef.current = deckVolume; }, [deckVolume]);
  useEffect(() => { deckToneRef.current = deckTone; }, [deckTone]);
  useEffect(() => { deckProgressRef.current = deckProgress; }, [deckProgress]);
  useEffect(() => { deckSideRef.current = deckSide; }, [deckSide]);
  const onSeaStateChangeRef = useRef(onSeaStateChange);
  const onRoomHoverRef = useRef(onRoomHover);
  const onRoomPickRef = useRef(onRoomPick);
  const onDeckVolumeChangeRef = useRef(onDeckVolumeChange);
  const onDeckToneChangeRef = useRef(onDeckToneChange);
  const onDeckToggleRef = useRef(onDeckToggle);
  const onDeckRpmToggleRef = useRef(onDeckRpmToggle);
  const recordPlayingRef = useRef(recordPlaying);
  useEffect(() => { onRoomHoverRef.current = onRoomHover; }, [onRoomHover]);
  useEffect(() => { onRoomPickRef.current = onRoomPick; }, [onRoomPick]);
  useEffect(() => { onDeckVolumeChangeRef.current = onDeckVolumeChange; }, [onDeckVolumeChange]);
  useEffect(() => { onDeckToneChangeRef.current = onDeckToneChange; }, [onDeckToneChange]);
  useEffect(() => { onDeckToggleRef.current = onDeckToggle; }, [onDeckToggle]);
  useEffect(() => { onDeckRpmToggleRef.current = onDeckRpmToggle; }, [onDeckRpmToggle]);
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
    /*
     * Scroll speed, as something the picture has to survive.
     *
     * Halved on a phone: the same offsets over a small screen held close read as a
     * fault rather than as speed, and the tier is already the place that decides how
     * much machine we are running on.
     */
    const scrollSignal = createScrollSignal(
      tier.reducedMotion ? 0 : tier.isMobile ? 0.5 : 1,
    );
    const reelMotions = reelMotionSources.map((source) => createReelMotion(source, isMobile));
    /** By the frame they belong to. The frame loop below asked for these by search. */
    const motionByProject = new Map(reelMotions.map((motion) => [motion.projectIndex, motion]));
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

    const roomScene = createRoomScene({
      atlas: uniforms.uMap,
      joiVideo: uniforms.uJoiVideo,
      joiMapVideo: uniforms.uJoiMapVideo,
      joiVideoReady: uniforms.uJoiVideoReady,
      joiMapVideoReady: uniforms.uJoiMapVideoReady,
      nightTide: uniforms.uNightTideMap,
      room: uniforms.uRoomMap,
    });
    roomApiRef.current = {
      focus: roomScene.focus,
      setLightPreset: roomScene.setLightPreset,
      setBookSelected: roomScene.setBookSelected,
      pokeProp: roomScene.pokeProp,
      terminal: roomScene.terminal,
      orbitZoom: roomScene.orbitZoom,
      orbitReset: roomScene.orbitReset,
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

    // The selected frame is aligned to the curve's front-most point by `uPhase` above.
    // Keeping that point in world space gives the exit camera a real focal plane: it
    // approaches whichever frame the visitor stopped on instead of zooming toward the
    // canvas origin and letting the chosen frame slide off-axis.
    const reelCameraHome = new THREE.Vector3(0, 0, 5);
    const reelLookHome = new THREE.Vector3(0, 0, 0);
    const reelFocusLocal = curve.getPointAt(frontT);
    const reelFocusWorld = new THREE.Vector3();
    const reelLook = new THREE.Vector3();
    const reelDirection = new THREE.Vector3();

    let frame = 0;
    let readySent = false;
    let width = 1;
    let height = 1;
    let ribbonHomeY = 0;
    /*
     * Where the canvas sits in the viewport.
     *
     * Three separate helpers each called `getBoundingClientRect`, so one pointermove
     * forced up to two layout flushes, interleaved with the cursor, class and style
     * writes that follow it — read/write/read/write on a full-screen canvas, which is
     * the textbook shape of layout thrash. The stage is `position: fixed` at the origin
     * and the canvas fills it, so this only moves when the viewport does, and the
     * ResizeObserver below already says when that happens.
     */
    let boundsLeft = 0;
    let boundsTop = 0;
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
      boundsLeft = bounds.left;
      boundsTop = bounds.top;
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
      ribbonHomeY = 0.2 + reelY * 0.4;
      ribbon.position.y = ribbonHomeY;
      ribbon.scale.setScalar(scale);
      ribbon.updateMatrixWorld(true);
      reelFocusWorld.copy(reelFocusLocal);
      ribbon.localToWorld(reelFocusWorld);
    };

    /** Normalised device coordinates, from the cached rect. */
    const ndcX = (clientX: number) => ((clientX - boundsLeft) / width) * 2 - 1;
    const ndcY = (clientY: number) => -(((clientY - boundsTop) / height) * 2 - 1);

    const pointerPosition = (event: PointerEvent) => {
      // Half of NDC: this one wants -0.5..0.5, not -1..1.
      targetPointer.set(ndcX(event.clientX) * 0.5, ndcY(event.clientY) * 0.5);
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
      exitRef.current > 0.55 &&
      roomPresenceRef.current > 0.05 &&
      contactTurnRef.current < 0.08;
    const roomPointer = { x: 0, y: 0 };
    resetDeckViewRef.current = () => roomScene.resetPlayerOrbit();
    let orbiting = false;
    let orbitX = 0;
    let orbitY = 0;
    let activeDeckControl: DeckControlId | null = null;
    let hoveredDeckControl: DeckControlId | null = null;
    let knobStartY = 0;
    let knobStartValue = 0;
    let hoveredRoomObject: RoomObjectId | null = null;
    /*
     * The room's free orbit. One finger (or the mouse) turns it; two walk the
     * distance. A drag that actually moved suppresses the click that follows it, so
     * orbiting never focuses whatever happens to be under the release point.
     */
    const roomPointers = new Map<number, { x: number; y: number }>();
    let roomOrbitDrag: { x: number; y: number; travelled: number } | null = null;
    let roomPinch: { startSpan: number; startDistance: number } | null = null;
    let roomOrbitMoved = false;

    const normalisedPointer = (event: PointerEvent | MouseEvent) => ({
      x: ndcX(event.clientX),
      y: ndcY(event.clientY),
    });

    const heroPointerFromEvent = (event: PointerEvent) => {
      const x = ndcX(event.clientX);
      const y = ndcY(event.clientY);
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
    const reelOwnsPointer = () =>
      !heroOwnsPointer() && !roomOwnsPointer() && exitRef.current < 0.08;

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
      window.getSelection()?.removeAllRanges();
      // The orb is the hero's one grabbable thing, and it outranks the sea-state click
      // it is sitting in front of.
      if (heroOwnsPointer() && hero.grabOrb(normalisedPointer(event))) {
        carryingOrb = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        return;
      }
      // At the deck the room's usual verbs are suspended: there is one object in shot
      // and its four physical controls outrank the camera orbit behind them.
      if (deckOpenRef.current && roomOwnsPointer()) {
        const hit = roomScene.raycastDeckControl(normalisedPointer(event));
        if (hit) {
          activeDeckControl = hit;
          knobStartY = event.clientY;
          knobStartValue = hit === "volume" ? deckVolumeRef.current : deckToneRef.current;
          canvas.setPointerCapture(event.pointerId);
          if (hit === "start") {
            roomScene.pressDeckStart();
            onDeckToggleRef.current();
          } else if (hit === "speed") {
            onDeckRpmToggleRef.current();
          }
          canvas.style.cursor = hit === "volume" || hit === "tone" ? "ns-resize" : "pointer";
          return;
        }
        orbiting = true;
        orbitX = event.clientX;
        orbitY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        return;
      }
      if (roomOwnsPointer() && !deckOpenRef.current) {
        roomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (roomPointers.size === 2) {
          const [a, b] = [...roomPointers.values()];
          roomPinch = {
            startSpan: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
            startDistance: roomScene.orbitDistance(),
          };
          roomOrbitDrag = null;
        } else {
          roomOrbitDrag = { x: event.clientX, y: event.clientY, travelled: 0 };
        }
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
        return;
      }
      if (!reelOwnsPointer()) return;
      // At About the drag is the reader's orbit, not the reel's — this branch only
      // runs past the reel's region, so an empty fallthrough is fine.
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
      if (activeDeckControl === "volume" || activeDeckControl === "tone") {
        const value = THREE.MathUtils.clamp(
          knobStartValue + (knobStartY - event.clientY) * 0.006,
          0,
          1,
        );
        if (activeDeckControl === "volume") {
          deckVolumeRef.current = value;
          roomScene.setDeckControlValue("volume", value);
          onDeckVolumeChangeRef.current(value);
        } else {
          deckToneRef.current = value;
          roomScene.setDeckControlValue("tone", value);
          onDeckToneChangeRef.current(value);
        }
        return;
      }
      if (activeDeckControl) return;
      if (orbiting) {
        // Cached size, same as the NDC helpers — an orbit drag is a stream of moves.
        roomScene.orbitPlayer(
          (event.clientX - orbitX) / width,
          (event.clientY - orbitY) / height,
        );
        orbitX = event.clientX;
        orbitY = event.clientY;
        return;
      }
      if (roomPointers.has(event.pointerId)) {
        roomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (roomPinch && roomPointers.size === 2) {
        const [a, b] = [...roomPointers.values()];
        const span = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
        roomScene.orbitZoomTo((roomPinch.startDistance * roomPinch.startSpan) / span);
        return;
      }
      if (roomOrbitDrag) {
        const dx = event.clientX - roomOrbitDrag.x;
        const dy = event.clientY - roomOrbitDrag.y;
        roomOrbitDrag.x = event.clientX;
        roomOrbitDrag.y = event.clientY;
        roomOrbitDrag.travelled += Math.abs(dx) + Math.abs(dy);
        roomScene.orbitRotate(dx, dy);
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
        roomPointer.x = ndc.x;
        roomPointer.y = ndc.y;
        if (deckOpenRef.current) {
          const control = roomScene.raycastDeckControl(ndc);
          if (control !== hoveredDeckControl) {
            hoveredDeckControl = control;
            roomScene.setDeckControlHover(control);
          }
          canvas.style.cursor = control === "volume" || control === "tone"
            ? "ns-resize"
            : control
              ? "pointer"
              : "grab";
          return;
        }
        const hit = roomScene.raycastAt(ndc);
        roomScene.setHoverBook(hit === "bookshelf" ? roomScene.bookAt(ndc) : null);
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
      if (activeDeckControl) {
        activeDeckControl = null;
        canvas.style.cursor = hoveredDeckControl === "volume" || hoveredDeckControl === "tone"
          ? "ns-resize"
          : hoveredDeckControl
            ? "pointer"
            : "grab";
        try { canvas.releasePointerCapture(event.pointerId); } catch {}
        return;
      }
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
    const endRoomDrag = (event: PointerEvent) => {
      if (!roomPointers.has(event.pointerId)) return false;
      roomPointers.delete(event.pointerId);
      if (roomPinch && roomPointers.size < 2) roomPinch = null;
      if (roomOrbitDrag) {
        if (roomOrbitDrag.travelled > 6) roomOrbitMoved = true;
        roomOrbitDrag = null;
      }
      if (roomPointers.size === 0 && !hoveredRoomObject && !orbiting && !activeDeckControl) {
        canvas.style.cursor = "";
      }
      return true;
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (dropOrb(event)) return;
      if (endRoomDrag(event)) return;
      finishDrag(event, true);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (dropOrb(event)) return;
      if (endRoomDrag(event)) return;
      finishDrag(event, false);
    };
    const handleLeave = () => {
      hero.setPointer(0, 0);
      ocean.setPointer(0, 0);
      roomPointers.clear();
      roomPinch = null;
      roomOrbitDrag = null;
      if (orbHovered) {
        orbHovered = false;
        if (!carryingOrb) canvas.style.cursor = "";
      }
      roomPointer.x = 0;
      roomPointer.y = 0;
      if (hoveredDeckControl) {
        hoveredDeckControl = null;
        roomScene.setDeckControlHover(null);
        if (!activeDeckControl && !orbiting) canvas.style.cursor = "";
      }
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
      if (!roomOwnsPointer() || deckOpenRef.current) return;
      // An orbit that actually moved is not a pick, whatever ended up under the cursor.
      if (roomOrbitMoved) {
        roomOrbitMoved = false;
        return;
      }
      const ndc = normalisedPointer(event);
      const hit = roomScene.raycastAt(ndc);
      const bookIndex = hit === "bookshelf" ? roomScene.bookAt(ndc) : null;
      // Objects that open a reading surface get the close-up; the cat and the balls
      // are pokes, not reads, so the camera keeps its seat.
      roomScene.focus(hit, hit !== null && CLOSE_FOCUS_IDS.has(hit));
      onRoomPickRef.current(hit, bookIndex);
    };
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      // Same ownership contract the pointer path signs. Without it a two-finger
      // sideways swipe anywhere on the page stepped the reel behind the reader's
      // back: on the hero and down in About and Contact the film is not on screen,
      // so the step was invisible, but it still fired `onStepChange` and still
      // re-rendered — and the project it landed on was the one waiting when they
      // scrolled back up. `reelOwnsPointer` reads scroll state, not the cursor, so
      // it answers just as well for a wheel as for a finger.
      if (!reelOwnsPointer()) return;
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

      roomScene.setPlatterSpinning(recordPlayingRef.current);

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
        motionByProject.get(activeMotionProject)?.pause();
        const next = motionByProject.get(activeProject);
        if (next) {
          next.restart();
          if (wantsMotion) next.play();
        }
        activeMotionProject = activeProject;
      }
      const activeMotion = motionByProject.get(activeMotionProject);
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
      // As a hand-off begins, parallax and flex settle back onto the chosen frame. The
      // frame itself may still be moving on its spring, but pointer noise no longer
      // knocks the focal object away from the approaching camera.
      uniforms.uFlex.value = flex * (1 - exit);
      uniforms.uTime.value += delta * 60;
      uniforms.uPointer.value.copy(pointer).multiplyScalar(1 - exit);

      /*
       * The selected frame is copied into the room before the ribbon leaves. Once the
       * copy owns the focal plane, the rest of the strip can slip up and left without
       * dragging the visitor's point of attention with it. Reversing the scroll runs
       * the same physical relay backwards — no second entrance animation to desynchronise.
       */
      const ribbonRelease = smoothStep((exit - 0.06) / 0.26);
      ribbon.position.x = -2.25 * ribbonRelease;
      ribbon.position.y = ribbonHomeY + 0.82 * ribbonRelease;
      ribbon.rotation.z = -0.065 * ribbonRelease;
      ribbon.updateMatrixWorld(true);
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
      roomScene.setFilmHandoff(exit, activeProject);
      // The deck owns the camera, the platter speed and the tonearm while it is open.
      roomScene.setPlayerMode(deckOpenRef.current && roomIsStage);
      roomScene.setPlatterRpm(deckRpmRef.current);
      roomScene.setDeckControlValue("volume", deckVolumeRef.current);
      roomScene.setDeckControlValue("tone", deckToneRef.current);
      roomScene.setDeckControlValue("speed", deckRpmRef.current);
      roomScene.setTonearm(deckProgressRef.current);
      // Only on change: printing a label redraws a canvas and uploads a texture, which
      // is a fine thing to do when the record changes and a terrible one to do at 60Hz.
      if (deckSideRef.current && deckSideRef.current !== appliedSideRef.current) {
        appliedSideRef.current = deckSideRef.current;
        roomScene.setRecordLabel(deckSideRef.current);
      }
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
       * The camera now holds on the selected frame while the object changes worlds.
       * Previously it rushed through the film to hide a cut; that made every project
       * look like an arbitrary portal. The relay negative supplies continuity, so a
       * nearly still lens is both calmer and more legible.
       */
      camera.position.copy(reelCameraHome);
      camera.lookAt(reelLookHome);
      const nextFov = 65;
      if (nextFov !== camera.fov) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }

      // How much of the frame the reel still owns. The reel arrives on `reveal` and
      // leaves on `exit`; `reveal` saturates at the anchor and never comes back down on
      // its own, which is what used to leave the film hanging behind About and Contact.
      // Slot A first reproduces the selected frame at the same focal position. Only
      // after that match is established does the reel release the picture to the room.
      const reelOwnsFrame = reveal * (1 - smoothStep((exit - 0.06) / 0.26));
      const roomGrade = smoothStep((exit - 0.06) / 0.38);

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
      /*
       * How badly the signal is holding together, 0 when the page is still.
       *
       * It rides `reelOwnsFrame` with everything else here: the hero is a scene and
       * the room is a room, and neither is being watched through a tube, so speed
       * costs them nothing. Grain is deliberately not among the knobs — see the note
       * in `scrollSignal.ts`.
       */
      const instability = scrollSignal.update(scrollVelocityRef.current, delta);
      signalRef.current = instability;

      post.uniforms.uLensDistortion.value =
        (THREE.MathUtils.lerp(0.32, 0.72, reveal) + instability * 0.08) * reelOwnsFrame;
      post.uniforms.uChromaticAberrationStrength.value =
        (THREE.MathUtils.lerp(0.18, 0.34, reveal) + instability * 0.22) * reelOwnsFrame;

      // Bright application screens need a much tighter CRT response than the dark
      // hero. The old settings added a broad 32% bloom to already relit whites, then
      // split their edges by more than a pixel. Preserve the tube in highlights and
      // sprockets while letting UI text and the original video pixels stay readable.
      post.uniforms.uBloomIntensity.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.32, 0.08, reelOwnsFrame),
        0.32,
        roomGrade,
      );
      post.uniforms.uBloomThreshold.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.62, 0.78, reelOwnsFrame),
        0.62,
        roomGrade,
      );
      post.uniforms.uBloomSmoothing.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.28, 0.16, reelOwnsFrame),
        0.28,
        roomGrade,
      );
      post.uniforms.uBloomRadius.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.5, 0.28, reelOwnsFrame),
        0.5,
        roomGrade,
      );
      post.uniforms.uPhosphorAmount.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.1, 0.035, reelOwnsFrame),
        0.1,
        roomGrade,
      );
      post.uniforms.uPow.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(1, 1.1, reelOwnsFrame),
        1,
        roomGrade,
      );
      post.uniforms.uSharpness.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0, 0.28, reelOwnsFrame),
        0,
        roomGrade,
      );
      post.uniforms.uSepiaIntensity.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.18, 0.035, reelOwnsFrame),
        0.025,
        roomGrade,
      );
      // The baked room has already gone through its photographic contrast in
      // Blender. A gentler display grade keeps the dark oak, black upholstery and
      // small hardware legible without washing out the window or monitor whites.
      post.uniforms.uBrightness.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(1, 0.9, reelOwnsFrame),
        1.18,
        roomGrade,
      );
      post.uniforms.uContrast.value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(1.04, 1, reelOwnsFrame),
        0.86,
        roomGrade,
      );
      // A little of the last frame while the reel is being thrown, and none of it
      // when the picture is still — persistence on a static frame is just softness.
      post.uniforms.uPersistence.value = Math.min(
        0.2,
        Math.abs(reelVelocity) * 0.008 + instability * 0.09 * reelOwnsFrame,
      ) * (1 - roomGrade);

      elapsed += delta;
      post.render({
        blend: reelOwnsFrame,
        // Slot A is the hero before the reel and the room after it. The room fades
        // away before Contact becomes active, revealing the stage's dark call-sheet
        // field instead of leaking About's desk into the next section.
        slotAOpacity: exit > 0.001
          ? smoothStep(exit / 0.22) * THREE.MathUtils.clamp(roomPresence / exit, 0, 1)
          : 1,
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
      roomApiRef.current = null;
      setRoomTerminalActive(false);
      roomScene.dispose();
      roomTarget.dispose();
      hero.dispose();
      post.dispose();
      const surface = renderer.domElement;
      renderer.dispose();
      /*
       * Give the context back, but only once the canvas has actually gone.
       *
       * `dispose()` releases what three allocated; the GL context itself lives on until
       * the canvas is collected, and a reader bouncing between the reel and a project
       * page can outrun the collector toward the browser's per-tab ceiling.
       * `forceContextLoss()` is how you hand it back early — and it is permanent. The
       * canvas can never render again.
       *
       * That is the trap this guard exists for. This cleanup does not only run when the
       * reader leaves: React also tears an effect down and sets it straight back up on
       * the *same* DOM node — StrictMode does it on every mount in development, and a
       * router re-render does it in production. Killing the context there leaves the
       * next line to construct a renderer on a dead canvas, where
       * `getShaderPrecisionFormat` returns null and reading `.precision` off it throws
       * before anything paints. Which is exactly what "back to reel" did.
       *
       * So the decision waits a macrotask for React to finish committing, and then asks
       * the only question that distinguishes the two cases: is this canvas still in the
       * document? Still attached means React kept it and is about to reuse it — and a
       * reused canvas is a reused context, so there is nothing to reclaim. Detached
       * means it is genuinely gone, and the context can go with it.
       */
      window.setTimeout(() => {
        if (surface.isConnected) return;
        renderer.forceContextLoss();
      }, 0);
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

/*
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * React warns when a component that renders on the server uses a layout effect, and
 * this one has to be a layout effect: it decides whether the boot screen is drawn at
 * all, and an ordinary effect makes that decision one frame too late — which is one
 * frame of full-screen cream, i.e. exactly the blink it exists to remove.
 */
const useBeforePaint = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function JoiSignalLab({ className = "", initialSection = "hero" }: JoiSignalLabProps) {
  const router = useRouter();
  const {
    loaded: deckSide,
    isPlaying: recordPlaying,
    rpm: deckRpm,
    volume: deckVolume,
    tone: deckTone,
    tonearmProgress: deckProgress,
    toggle: toggleDeck,
    setVolume: setDeckVolume,
    setTone: setDeckTone,
    setRpm: setDeckRpm,
  } = useGlobalMusic();
  const experienceRef = useRef<HTMLElement>(null);
  const filmActiveRef = useRef(false);
  const [step, setStep] = useState(0);
  const [filmReady, setFilmReady] = useState(false);
  /** Which room object the reader picked — lights the matching interest chip. */
  const [hoveredInterest, setHoveredInterest] = useState<RoomObjectId | null>(null);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [computerReady, setComputerReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  /** True when this mount is the way back from a detail page rather than an arrival. */
  const [returning, setReturning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /*
   * What each custom property was last set to.
   *
   * All thirteen below were written unconditionally every frame, so a page sitting
   * perfectly still went on dirtying the style of the element the whole experience
   * hangs off, sixty times a second. Most of them hold the same value for most of the
   * scroll — `--film-*` is pinned at both ends of its crossfade, and the two progress
   * variables are 0 until their section is reached.
   */
  const cssCacheRef = useRef(new Map<string, string>());
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuSheetRef = useRef<HTMLDivElement>(null);
  /** True while the leave-transition veil covers the stage on the way to a detail page. */
  const [leaving, setLeaving] = useState(false);
  /** Where the veil is on its way to, so it can say so. */
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [seaState, setSeaState] = useState(0);
  const resetDeckViewRef = useRef(() => {});
  /** Everything the DOM layer may ask the room to do; FilmCanvas fills it in. */
  const roomApiRef = useRef<RoomApi | null>(null);
  /** The object sheet the reader opened in the room, if any. */
  const [activeRoomApp, setActiveRoomApp] = useState<RoomAppId | null>(null);
  /** The volume the reading timeline has slid off the shelf. */
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  /** True while the room's terminal owns the keyboard. */
  const [terminalActive, setTerminalActive] = useState(false);
  /** Coarse pointers type into the terminal through the hidden bridge, not keydown. */
  const [coarsePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );
  /*
   * The room's moment. Session-stored, so a reader who chose night keeps it; the
   * default is Guangzhou time — daylight, blue hour, then the deep end. The server
   * renders "day" and the client reconciles after mount: the choice depends on a
   * clock and a session store, neither of which may vote during hydration.
   */
  const [roomLight, setRoomLight] = useState<RoomLightPresetUi>("day");
  /** The scroll driver runs outside React, so it closes the deck through a ref. */
  const closeDeckRef = useRef(() => {});
  // Reassigned each render so it closes over the live flag: the scroll driver calls this
  // on every frame it is away from About, and only the first one should do anything.
  closeDeckRef.current = () => { if (musicPlayerOpen) setMusicPlayerOpen(false); };
  /*
   * The way out of the room, shared: the reel's open handler and the terminal's
   * `works go 1` both land here — sections scroll, routes push under the veil.
   */
  const openProjectRef = useRef<(href: string) => void>(() => {});
  openProjectRef.current = (href) => {
    const section = SECTIONS.find((entry) => entry.path === href);
    if (section) {
      scrollToSection.current(section.id);
      return;
    }
    if (leaving) return;
    try {
      sessionStorage.setItem("reel:return", JSON.stringify({ step }));
      sessionStorage.setItem("reel:arrive", "1");
    } catch {}
    setLeavingTo(href);
    setLeaving(true);
    window.setTimeout(() => router.push(href), 300);
  };
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);
  const activeIndex = modulo(step, projects.length);
  // The loader doubles as the reference's boot screen: it holds the page (scroll lock in
  // the driver) until every system it fronts for is actually warm.
  const ready = filmReady && computerReady && fontsReady;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const loadedSystems = (filmReady ? 1 : 0) + (computerReady ? 1 : 0) + (fontsReady ? 1 : 0);

  // The room's moment follows the switch, and the switch follows the session. The
  // session/clock read happens after mount — see the state's note on hydration.
  useEffect(() => {
    let restored: RoomLightPresetUi | null = null;
    try {
      const saved = sessionStorage.getItem("room:light");
      if (saved === "day" || saved === "blue" || saved === "night") restored = saved;
    } catch {}
    setRoomLight(restored ?? lightPresetForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    roomApiRef.current?.setLightPreset(roomLight);
    try {
      sessionStorage.setItem("room:light", roomLight);
    } catch {}
  }, [roomLight]);

  // Terminal lifecycle: the keyboard gate, and where `works go 1` lands.
  useEffect(() => {
    const rig = roomApiRef.current?.terminal;
    if (!rig) return;
    rig.onActiveChange((on) => {
      setTerminalActive(on);
      setRoomTerminalActive(on);
    });
    rig.onNavigate((href) => {
      rig.deactivate();
      openProjectRef.current(href);
    });
  }, []);

  // The terminal owns the keyboard while it is up — capture phase, ahead of the page's
  // own handlers. Escape hands it back; modifier chords belong to the browser.
  useEffect(() => {
    if (!terminalActive) return;
    const rig = roomApiRef.current?.terminal;
    if (!rig) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rig.deactivate();
        return;
      }
      rig.handleKey(event);
      if (!event.metaKey && !event.ctrlKey && !event.altKey && TERMINAL_OWNED_KEYS.has(event.key)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [terminalActive]);

  // Walking away from About puts the room's apps away.
  useEffect(() => {
    if (activeSection === "about-me") return;
    if (activeRoomApp) setActiveRoomApp(null);
    if (selectedBook !== null) setSelectedBook(null);
    roomApiRef.current?.setBookSelected(null);
    roomApiRef.current?.terminal.deactivate();
  }, [activeSection, activeRoomApp, selectedBook]);

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

  /*
   * The menu sheet is a dialog; this is what made it one.
   *
   * It had the role and none of the behaviour. Opening it left focus on the button
   * behind it, so a screen reader announced nothing and a keyboard reader had to
   * guess the menu was there. Escape was bound to the sheet's own `onKeyDown` — a
   * div that never takes focus — so it only fired if the reader had already tabbed
   * onto a link inside. Tab walked straight out of the sheet and down the page
   * underneath, which was still scrolling.
   *
   * The scroll lock reuses `bootLocked` rather than putting `overflow: hidden` on
   * the body: this page's scroll position *is* its state, and zeroing it would drop
   * the reader back at the hero every time they opened the menu.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const sheet = menuSheetRef.current;
    if (!sheet) return;
    const opener = menuButtonRef.current;
    const items = () => Array.from(sheet.querySelectorAll<HTMLAnchorElement>("a[href]"));
    items()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !sheet.contains(active);
      // Wrap at both ends, and pull focus back if it has already left the sheet.
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Hand focus back to what opened it, so the reader keeps their place.
      opener?.focus();
    };
  }, [menuOpen]);

  /*
   * Returning from a detail page: land back on the frame the reader left from, and do
   * not make them watch the machine start up again.
   *
   * Booting is a first-arrival story. On the way back it is pure friction — the same
   * cream field, the same three systems counting up, in front of a page the reader has
   * already seen. What they left under was a cream veil, and the boot screen happens to
   * be the same cream, so the way home is to keep the colour and drop the chrome: no
   * wordmark, no pulse, no system count, and a shorter lift.
   *
   * The cream itself stays until the stage is genuinely ready. Lifting it early would
   * trade a boot screen for a black one, which is not an improvement. And the boot lock
   * is deliberately untouched — it is what holds the page where the deep link put it
   * while the models parse, and that job does not change just because nobody is being
   * shown a progress count.
   *
   * Read before paint, or the boot screen renders for a frame on the way back and the
   * whole point is a visible blink.
   */
  useBeforePaint(() => {
    try {
      const raw = sessionStorage.getItem("reel:return");
      if (!raw) return;
      sessionStorage.removeItem("reel:return");
      setReturning(true);
      const saved = JSON.parse(raw) as { step?: number };
      if (typeof saved.step === "number") setStep(saved.step);
    } catch {
      // Malformed state is not worth a crash on the way home.
    }
  }, []);

  // Scroll-derived values live in refs and go straight to CSS variables. Nothing here re-renders
  // per frame — the reference keeps these in motion values for the same reason.
  const entryRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  /** Filled by FilmCanvas each frame; read straight back out as `--velocity`. */
  const signalRef = useRef(0);
  const filmRevealRef = useRef(0);
  const reelExitRef = useRef(0);
  /** About's full-stage room fades out before Contact owns the address and copy. */
  const roomPresenceRef = useRef(0);
  /** Scroll-driven paper turn from the room into Contact's black call sheet. */
  const contactTurnRef = useRef(0);
  /** Pointer drag temporarily owns the same variables the scroll callback normally writes. */
  const pageTurnGestureRef = useRef(false);
  const pageTurnSettleTimerRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);

  /*
   * Left and right step the reel — the other half of the sentence `useScrollDriver`
   * makes where it handles up and down.
   *
   * The guards are the same contract the pointer and the wheel sign. Stepping the reel
   * from behind an open menu or an open deck is the bug the wheel had: both are modal,
   * and the reader pressing an arrow inside one is not talking to the film. A modifier
   * means the key belongs to the browser — ⌘← is Back — and a key pressed inside a
   * field belongs to the field. `preventDefault` stops the page taking the same arrow
   * as a horizontal scroll on top of the step.
   */
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!filmActiveRef.current || menuOpen || musicPlayerOpen || terminalActive) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      setStep((value) => value + (event.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen, musicPlayerOpen, terminalActive]);

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
    onFrame: ({ screens, velocity }) => {
      const experience = experienceRef.current;
      if (!experience) return;
      scrollVelocityRef.current = velocity;

      // The hero camera flight and the film entrance were tuned against a 0..1 range that ends
      // when the reel has arrived. Remap onto that range so their timing survives page growth.
      const entry = clamp01(screens / REEL_ANCHOR);
      // With the anchor at 2 screens the crossfade occupies screens 1.0→1.7 — roughly
      // three times yesterday's window — and still completes before the anchor, so the
      // /selected-work deep link keeps landing on a fully arrived reel.
      const filmReveal = smoothStep((entry - 0.5) / 0.35);
      const reelExit = focalHandoffProgress(FOCAL_HANDOFFS.selectedToAbout, screens);
      const contactTurn = focalHandoffProgress(FOCAL_HANDOFFS.aboutToContact, screens);

      // The picture stays with its focal object for most of each move. Copy leaves
      // early enough not to cross the paper edge, while the room releases only once
      // Contact's black sheet covers most of it.
      const aboutArrival = smoothStep((reelExit - 0.58) / 0.3);
      const aboutDeparture = smoothStep((contactTurn - 0.18) / 0.46);
      const aboutPresence = aboutArrival * (1 - aboutDeparture);
      const contactPresence = contactPresenceFor(contactTurn);
      const roomPresence = reelExit * (1 - contactPresence);

      entryRef.current = entry;
      filmRevealRef.current = filmReveal;
      reelExitRef.current = reelExit;
      roomPresenceRef.current = roomPresence;
      contactTurnRef.current = contactTurn;
      if (roomPresence < 0.35) closeDeckRef.current();
      filmActiveRef.current = filmReveal > 0.55 && reelExit < 0.08;

      const style = experience.style;
      const cache = cssCacheRef.current;
      const write = (name: string, value: string) => {
        if (cache.get(name) === value) return;
        cache.set(name, value);
        style.setProperty(name, value);
      };
      write("--journey", (screens / TOTAL_SCREENS).toFixed(4));
      write("--film-reveal", filmReveal.toFixed(4));
      write("--film-shift", `${((1 - filmReveal) * 7).toFixed(3)}svh`);
      write("--film-scale", (0.955 + filmReveal * 0.045).toFixed(4));
      write("--film-clip", `${((1 - filmReveal) * 4.5).toFixed(3)}%`);
      write("--film-radius", `${((1 - filmReveal) * 34).toFixed(2)}px`);
      write("--hero-opacity", (1 - smoothStep(entry / 0.7)).toFixed(4));
      write("--hero-shift", `${(entry * -28).toFixed(2)}px`);
      write("--terminal-opacity", (1 - smoothStep(entry / 0.85)).toFixed(4));
      write("--terminal-shift", `${(entry * 18).toFixed(2)}px`);
      write("--reel-exit", reelExit.toFixed(4));
      write("--reel-furniture-presence", (1 - smoothStep(reelExit / 0.2)).toFixed(4));
      write("--about-presence", aboutPresence.toFixed(4));
      write("--about-shift", `${((1 - aboutPresence) * 34).toFixed(2)}px`);
      if (!pageTurnGestureRef.current) {
        applyPageTurnStyle(experience, contactTurn, contactPresence);
      }
      write("--contact-shift", `${((1 - contactPresence) * 34).toFixed(2)}px`);
      write("--about-progress", progressWithin("about-me", screens).toFixed(4));
      write("--contact-progress", progressWithin("contact", screens).toFixed(4));
      // The same instability the post chain is using, for the type sitting over it.
      write("--velocity", signalRef.current.toFixed(3));
    },
    onSectionChange: setActiveSection,
    // Don't snap out from under someone who is dragging the reel.
    isLocked: () => pageTurnGestureRef.current || (filmActiveRef.current && dragActiveRef.current),
    // The boot screen holds the page still until every system is warm.
    // The menu is modal, so the page behind it holds still — same pin the boot uses.
    bootLocked: () => !readyRef.current || menuOpen,
  });

  const handlePageTurnProgress = (
    progress: number,
    dragX: number,
    dragY: number,
    dragging: boolean,
  ) => {
    const experience = experienceRef.current;
    if (!experience) return;
    if (pageTurnSettleTimerRef.current !== null) {
      window.clearTimeout(pageTurnSettleTimerRef.current);
      pageTurnSettleTimerRef.current = null;
    }
    pageTurnGestureRef.current = dragging;
    if (dragging) {
      experience.dataset.pageTurn = "dragging";
    } else {
      experience.dataset.pageTurn = "settling";
      pageTurnSettleTimerRef.current = window.setTimeout(() => {
        delete experience.dataset.pageTurn;
        pageTurnSettleTimerRef.current = null;
      }, 560);
    }
    applyPageTurnStyle(
      experience,
      progress,
      contactPresenceFor(progress),
      dragX,
      dragY,
      dragging,
    );
  };

  useEffect(() => () => {
    if (pageTurnSettleTimerRef.current !== null) {
      window.clearTimeout(pageTurnSettleTimerRef.current);
    }
  }, []);

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
      className={`${styles.experience} ${musicPlayerOpen ? styles.experienceDeckOpen : ""} ${className}`}
      style={{
        // Scroll length comes from the section table, so adding a section extends the page.
        height: `${TOTAL_SCREENS * 100}svh`,
      } as CSSProperties}
    >
      <div className={styles.stage}>
        <div className={styles.heroField} aria-hidden="true" />

        <section
          className={`${styles.heroCopy} ${activeSection === "hero" ? "" : styles.heroGone}`}
          aria-labelledby="joi9000-title"
          aria-hidden={activeSection === "hero" ? undefined : true}
        >
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

        <aside
          className={`${styles.terminalHud} ${activeSection === "hero" ? "" : styles.heroGone}`}
          aria-label="JOI9000 screen controls"
          aria-hidden={activeSection === "hero" ? undefined : true}
        >
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
            contactTurnRef={contactTurnRef}
            scrollVelocityRef={scrollVelocityRef}
            signalRef={signalRef}
            deckOpen={musicPlayerOpen}
            deckRpm={deckRpm}
            deckVolume={deckVolume}
            deckTone={deckTone}
            deckProgress={deckProgress}
            deckSide={deckSide}
            resetDeckViewRef={resetDeckViewRef}
            roomApiRef={roomApiRef}
            onHeroReady={() => setComputerReady(true)}
            onSeaStateChange={setSeaState}
            onRoomHover={setHoveredInterest}
            onRoomPick={(id, bookIndex) => {
              if (!id) return;
              // Picking anything other than the screen puts the terminal away first —
              // the keyboard belongs to one surface at a time.
              if (id !== "crt-monitor") roomApiRef.current?.terminal.deactivate();
              if (id === "joi-music-box") {
                setMusicPlayerOpen(true);
                return;
              }
              if (id === "crt-monitor") {
                roomApiRef.current?.terminal.activate();
                return;
              }
              if (id === "cat" || id === "balls") {
                roomApiRef.current?.pokeProp(id);
                return;
              }
              if (id === "bookshelf") {
                const first = bookIndex ?? ROOM_BOOKS[0].nodeIndex;
                setSelectedBook(first);
                roomApiRef.current?.setBookSelected(first);
                setActiveRoomApp("books");
                return;
              }
              if (id === "camera") setActiveRoomApp("films");
              else if (id === "poster") setActiveRoomApp("poster");
              else if (id === "handheld") setActiveRoomApp("handheld");
            }}
            recordPlaying={recordPlaying}
            onDeckVolumeChange={setDeckVolume}
            onDeckToneChange={setDeckTone}
            onDeckToggle={() => { void toggleDeck(); }}
            onDeckRpmToggle={() => setDeckRpm(deckRpm > 39 ? 33 + 1 / 3 : 45)}
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
              setLeavingTo(href);
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
          <RoomTimeSwitch value={roomLight} onChange={setRoomLight} />
          <OrbitButtons apiRef={roomApiRef} />
        </div>

        {/*
          The room's objects open into these sheets. The camera pull happens underneath
          (FilmCanvas focused it on the pick); the sheet is the reading surface.
        */}
        {activeRoomApp && (
          <RoomAppSheet
            appId={activeRoomApp}
            onClose={() => {
              setActiveRoomApp(null);
              if (activeRoomApp === "books") {
                setSelectedBook(null);
                roomApiRef.current?.setBookSelected(null);
              }
            }}
          >
            {activeRoomApp === "books" && (
              <BooksSheet
                selected={selectedBook}
                onSelect={(nodeIndex) => {
                  setSelectedBook(nodeIndex);
                  roomApiRef.current?.setBookSelected(nodeIndex);
                }}
              />
            )}
            {activeRoomApp === "films" && <FilmsSheet />}
            {activeRoomApp === "poster" && <PosterSheet />}
            {activeRoomApp === "handheld" && <CartridgeSheet />}
          </RoomAppSheet>
        )}

        {terminalActive && (
          <div className={styles.roomTerminalHint} role="status">
            <span>JOI9000 TERMINAL</span>
            <em>ESC 退出 · help 看命令</em>
          </div>
        )}
        <TerminalInputBridge
          active={terminalActive && coarsePointer}
          rig={roomApiRef.current?.terminal ?? null}
        />

        <section
          className={`${styles.closingPanel} ${styles.aboutPanel} ${activeSection === "about-me" ? styles.closingPanelActive : ""}`}
          aria-label="About me"
          aria-hidden={activeSection === "about-me" ? undefined : true}
          inert={activeSection === "about-me" ? undefined : true}
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

        {/* Contact is a black call sheet underneath the room's draggable paper corner. */}
        <div
          className={styles.contactPage}
          aria-hidden={activeSection === "contact" ? undefined : true}
        >
          <div
            className={`${styles.contactScene} ${activeSection === "contact" ? styles.contactSceneActive : ""}`}
          >
            <div className={styles.badgeBox}>
              <LanyardBadge active={activeSection === "contact"} />
            </div>
          </div>

          <section
            className={`${styles.closingPanel} ${styles.contactPanel} ${activeSection === "contact" ? styles.closingPanelActive : ""}`}
            aria-label="Contact"
            inert={activeSection === "contact" ? undefined : true}
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
        </div>

        <PageTurnCorner
          active={activeSection === "about-me"}
          progressRef={contactTurnRef}
          onProgress={handlePageTurnProgress}
          onCommit={() => scrollToSection.current("contact")}
        />

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
            ref={menuButtonRef}
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
            ref={menuSheetRef}
            className={styles.menuSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Sections"
            onClick={(event) => {
              if (event.target === event.currentTarget) setMenuOpen(false);
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

        <div
          className={`${styles.loader} ${ready ? styles.loaderReady : ""} ${returning ? styles.loaderReturning : ""}`}
          role={returning ? undefined : "status"}
          aria-live={returning ? undefined : "polite"}
          aria-hidden={returning ? true : undefined}
        >
          {!returning && (
            <>
              <span>GALLO / JOI</span>
              <i />
              <strong>
                <span>
                  BOOTING JOI9000
                  <b className={styles.loaderCursor} aria-hidden="true" />
                </span>
                {/*
                  The three systems by name rather than as a count.
                  
                  They are the same three signals the gate has always been built from —
                  the film, the terminal, the fonts — and naming them makes the wait
                  legible: a reader who sits here for a moment can see *what* is slow.
                  The names come from vocabulary the page already uses; the HUD has
                  called the terminal the optical core since it was written.

                  Hidden from assistive tech, which keeps the single spoken count below
                  instead of announcing three separate lines as they land.
                */}
                <ul className={styles.loaderSystems} aria-hidden="true">
                  <li className={filmReady ? styles.loaderSystemUp : ""}>FILM TRANSPORT</li>
                  <li className={computerReady ? styles.loaderSystemUp : ""}>OPTICAL CORE</li>
                  <li className={fontsReady ? styles.loaderSystemUp : ""}>TYPE SETTER</li>
                </ul>
                <em>{loadedSystems}/3 SYSTEMS</em>
              </strong>
            </>
          )}
        </div>

        {/*
          The way out: cream over everything, then the route swap happens under it.

          The line names where the machine is going. Three hundred milliseconds of blank
          cream is the one moment in the transition that says nothing at all, and a
          transport that announces what it is doing is the whole conceit of this page —
          the reader is stepping out of a machine, so the machine says so.
        */}
        <div className={`${styles.leaveVeil} ${leaving ? styles.leaveVeilActive : ""}`} aria-hidden="true">
          {leavingTo && <span>EJECTING — {leavingTo}</span>}
        </div>
      </div>
    </main>
  );
}
