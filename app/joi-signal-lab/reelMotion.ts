import * as THREE from "three";
import { reelMotionSources } from "./reelProjects";

/**
 * The three ways a reel frame can be made to move.
 *
 * A frame is either a decoded video, a sprite sheet, or a still, and which one it gets is
 * decided per device rather than per frame — every reason to fall back is a property of
 * the machine, not of the footage. Each factory's own header says what it is defending
 * against; the short version is that some phones will not decode the master, and some
 * browsers hoist a <video> out of the page entirely and leave the texture black while
 * still reporting a healthy readyState.
 */

type ReelMotionSource = (typeof reelMotionSources)[number];

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

export function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

/**
 * One moving reel frame, however it happens to be delivered.
 *
 * `texture` is read fresh every frame rather than captured once, because the mobile path
 * can swap the whole backend out from under it mid-playback (see `createReelMotion`).
 */
export type ReelMotion = {
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
export function createVideoMotion(
  source: ReelMotionSource,
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
export function createSheetMotion(source: ReelMotionSource): ReelMotion {
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
export function createReelMotion(source: ReelMotionSource, mobile: boolean): ReelMotion {
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
