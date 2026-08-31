/**
 * The room's whiteboard surface.
 *
 * Modelled on pinchen.me's own board (see `docs/pinchen-room-research/room-miniapps-2026-08.md`):
 * five inks, a 4px nib, a clear button, and the drawing kept in IndexedDB with a
 * localStorage fallback so it is still there next visit.
 *
 * Ink only. The canvas is transparent where nothing has been drawn, so the 3D board
 * shows its own bake through and the panel shows its own white — neither has to agree
 * with a background baked into the bitmap.
 *
 * The module owns the canvas rather than the React overlay, because the board keeps
 * showing the drawing after the overlay closes — the drawing outlives its editor.
 */

/** Matches the board face in the capture: 4.203 tall x 3.412 wide. */
export const BOARD_WIDTH = 1024;
export const BOARD_HEIGHT = 1261;

/** The reference board's palette, in its order. */
export const BOARD_INKS = ["#222222", "#c0392b", "#2471a3", "#27874a", "#d4a017"] as const;
export const BOARD_NIB = 4;

const DB_NAME = "room-local-state";
const DB_STORE = "artifacts";
const DB_KEY = "whiteboard-snapshot-v1";
const LS_KEY = "room-whiteboard-v1";

type Snapshot = { dataUrl: string; updatedAt: number };

let surface: HTMLCanvasElement | null = null;
let ink: HTMLCanvasElement | null = null;
let ready: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/** Told when the surface changes, so the 3D board can flag its texture. */
export function onBoardChange(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = BOARD_WIDTH;
  canvas.height = BOARD_HEIGHT;
  return canvas;
}

/** The drawing. Transparent where untouched; both the board and the sheet show it. */
export function panelSurface(): HTMLCanvasElement {
  if (!surface) surface = makeCanvas();
  return surface;
}

/** The same canvas. The 3D board and the sheet are looking at one drawing. */
export const boardSurface = panelSurface;

function inkLayer(): HTMLCanvasElement {
  if (!ink) ink = makeCanvas();
  return ink;
}

/** Rebuild the surface from the ink layer. */
function recomposite() {
  const context = panelSurface().getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  context.drawImage(inkLayer(), 0, 0);
  notify();
}

// ── persistence ────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readIdb(): Promise<Snapshot | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve((request.result as Snapshot) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIdb(snapshot: Snapshot) {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(snapshot, DB_KEY);
  } catch { /* a private window with storage denied is not an error worth surfacing */ }
}

function readLocal(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.dataUrl !== "string") return null;
    return { dataUrl: parsed.dataUrl, updatedAt: Number(parsed.updatedAt) || 0 };
  } catch {
    return null;
  }
}

function writeLocal(snapshot: Snapshot) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ v: 2, ...snapshot }));
  } catch { /* quota or denied; IndexedDB is the primary anyway */ }
}

let saveTimer = 0;
/** Coalesced: a stroke is many pointer moves and one drawing. */
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const snapshot: Snapshot = {
      dataUrl: inkLayer().toDataURL("image/png"),
      updatedAt: Date.now(),
    };
    void writeIdb(snapshot);
    writeLocal(snapshot);
  }, 600);
}

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

/** Load the saved drawing. Safe to call repeatedly. */
export function ensureBoard(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    // Both stores are read and the newer wins, so a browser that lost one of them
    // still comes back with the drawing rather than a blank board.
    const [fromIdb, fromLocal] = [await readIdb(), readLocal()];
    const snapshot = [fromIdb, fromLocal]
      .filter(Boolean)
      .sort((a, b) => (b!.updatedAt ?? 0) - (a!.updatedAt ?? 0))[0];
    if (snapshot?.dataUrl) {
      const saved = await loadImage(snapshot.dataUrl);
      if (saved) inkLayer().getContext("2d")?.drawImage(saved, 0, 0);
    }
    recomposite();
  })();
  return ready;
}

// ── drawing ────────────────────────────────────────────────────────────────────

function strokeOn(canvas: HTMLCanvasElement, from: [number, number], to: [number, number], colour: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.strokeStyle = colour;
  context.lineWidth = BOARD_NIB;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(from[0], from[1]);
  context.lineTo(to[0], to[1]);
  context.stroke();
}

/** One segment, in board pixels. Struck onto the ink layer and the surface together. */
export function drawSegment(from: [number, number], to: [number, number], colour: string) {
  strokeOn(inkLayer(), from, to, colour);
  strokeOn(panelSurface(), from, to, colour);
  notify();
  scheduleSave();
}

/** Removes the drawing. */
export function clearBoard() {
  inkLayer().getContext("2d")?.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  recomposite();
  scheduleSave();
}
