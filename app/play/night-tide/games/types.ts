import type { GameAudio } from "./gameAudio";

/**
 * The contract between the handheld shell and whatever is on its screen.
 *
 * The shell owns the buttons — touch, keyboard, and the Godot build's mirrored keys all
 * arrive the same way — so a game never listens to the DOM. That is what lets the same
 * D-pad drive a Godot iframe and a canvas game without either knowing about the other.
 */

export type GameButton =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "x"
  | "y"
  | "l1"
  | "l2"
  | "r1"
  | "r2"
  | "start"
  | "select";

export type GameInput = {
  /** Held right now. Use for continuous motion. */
  isDown: (button: GameButton) => boolean;
  /**
   * Edge-triggered: true once per physical press, then false until released and pressed
   * again. Games poll this, so a press that lands between two frames is still seen.
   */
  pressed: (button: GameButton) => boolean;
};

export type GameHandle = {
  destroy: () => void;
};

export type GameContext = {
  input: GameInput;
  /** Shown on the shell's readout — score, state, whatever the game wants to say. */
  setStatus: (status: string) => void;
  /**
   * Sound, the same way input arrives: the shell owns it, the game asks for it. A game
   * never builds an AudioContext of its own — see `gameAudio.ts` for why that matters.
   */
  audio: GameAudio;
};

export type ArcadeGame = {
  id: string;
  /** Latin name, used in the shell's monospace chrome. */
  title: string;
  titleZh: string;
  blurb: string;
  blurbZh: string;
  /** Drawn on the select card, and used as the game's own highlight colour. */
  accent: string;
  /** Buttons worth telling the player about, in the order they should read. */
  controls: Array<{ keys: string; action: string }>;
  mount: (canvas: HTMLCanvasElement, context: GameContext) => GameHandle;
};

/**
 * Internal render size for every canvas game. Exact 16:9, matching the enlarged handheld
 * screen, and fixed so gameplay geometry never depends on the element's CSS size.
 */
export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 450;

/**
 * The shared palette.
 *
 * Deliberately the light, low-saturation register of the Joi web session rather than the
 * arcade-cabinet neon these games usually wear: the handheld sits on a page that already
 * has one dark machine on it, and a second one competing beside it read as noise.
 */
export const PALETTE = {
  paper: "#f2f4f9",
  panel: "#ffffff",
  ink: "#242835",
  muted: "#8d95a8",
  line: "#e0e5ef",
  grid: "#e8ecf4",
  indigo: "#6f7ee0",
  coral: "#e58f7b",
  mint: "#74bda9",
  amber: "#dcae6e",
  rose: "#d98aa4",
} as const;

/** Shared helper: a crisp rounded rect, since games draw a lot of them. */
export function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/**
 * Every canvas game is a fixed-step simulation driven by rAF.
 *
 * Wrapping the loop here rather than in each game keeps three things consistent: the
 * accumulator never spirals after a background tab (delta is clamped), `destroy` always
 * cancels the frame, and a game's `step` can assume an exact timestep.
 */
export function createLoop(step: (delta: number) => void, draw: () => void) {
  let frame = 0;
  let last = performance.now();
  let running = true;

  const tick = (now: number) => {
    if (!running) return;
    // A tab that was hidden for a minute must not deliver a minute of simulation at once.
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(delta);
    draw();
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);

  return () => {
    running = false;
    window.cancelAnimationFrame(frame);
  };
}
