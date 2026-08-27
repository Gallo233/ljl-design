/**
 * A lanyard as arithmetic: verlet particles under gravity with distance constraints.
 *
 * Pure and renderer-agnostic — `LanyardBadge.tsx` owns the rAF and the SVG/DOM writes,
 * this module owns nothing but positions. Fixed 1/120 s substeps behind an accumulator
 * keep the constraint solve stable however uneven the host's frames are.
 */

export type RopePoint = { x: number; y: number; px: number; py: number };

export type Rope = {
  points: RopePoint[];
  /** Move the fixed top end (layout shifts, resizes). */
  setAnchor: (x: number, y: number) => void;
  /** Pin the tail to the pointer. */
  grab: (x: number, y: number) => void;
  drag: (x: number, y: number) => void;
  /** Let go — the pointer's velocity carries into the tail, so a fling flings. */
  release: (vx: number, vy: number) => void;
  /**
   * Advance by `dtMs`. Returns true while anything meaningfully moved — the caller
   * uses a run of falses to put the simulation to sleep.
   */
  step: (dtMs: number) => boolean;
};

const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 4;
const GRAVITY = 2400;
const DAMPING = 0.982;
const ITERATIONS = 5;
/** Below this per-substep movement (px) the rope counts as still. */
const SLEEP_EPSILON = 0.045;

export function createRope(anchorX: number, anchorY: number, segments = 14, segmentLength = 16): Rope {
  const points: RopePoint[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const y = anchorY + index * segmentLength;
    points.push({ x: anchorX, y, px: anchorX, py: y });
  }

  const anchor = { x: anchorX, y: anchorY };
  let grabbed = false;
  const pointer = { x: 0, y: 0 };
  let accumulator = 0;

  const integrate = () => {
    let maxMove = 0;
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      const vx = (point.x - point.px) * DAMPING;
      const vy = (point.y - point.py) * DAMPING;
      point.px = point.x;
      point.py = point.y;
      point.x += vx;
      point.y += vy + GRAVITY * SUBSTEP * SUBSTEP;
      const moved = Math.abs(vx) + Math.abs(vy);
      if (moved > maxMove) maxMove = moved;
    }

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      points[0].x = anchor.x;
      points[0].y = anchor.y;
      if (grabbed) {
        const tail = points[points.length - 1];
        tail.x = pointer.x;
        tail.y = pointer.y;
      }
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const difference = (distance - segmentLength) / distance;
        const headFixed = index === 0;
        const tailFixed = grabbed && index === points.length - 2;
        const weightA = headFixed ? 0 : tailFixed ? 1 : 0.5;
        const weightB = tailFixed ? 0 : headFixed ? 1 : 0.5;
        a.x += dx * difference * weightA;
        a.y += dy * difference * weightA;
        b.x -= dx * difference * weightB;
        b.y -= dy * difference * weightB;
      }
    }
    return maxMove;
  };

  return {
    points,
    setAnchor: (x, y) => {
      anchor.x = x;
      anchor.y = y;
    },
    grab: (x, y) => {
      grabbed = true;
      pointer.x = x;
      pointer.y = y;
    },
    drag: (x, y) => {
      pointer.x = x;
      pointer.y = y;
    },
    release: (vx, vy) => {
      grabbed = false;
      // Carry the throw through the lower half of the lanyard rather than injecting
      // all of it into one particle. The old tail-only impulse made a sharp kink that
      // snapped through the rope before the rest of the chain could follow.
      const last = points.length - 1;
      for (let index = 1; index <= last; index += 1) {
        const weight = Math.pow(index / last, 2.4);
        const point = points[index];
        point.px = point.x - vx * SUBSTEP * weight;
        point.py = point.y - vy * SUBSTEP * weight;
      }
    },
    step: (dtMs) => {
      accumulator = Math.min(accumulator + dtMs / 1000, SUBSTEP * MAX_SUBSTEPS);
      let moving = false;
      while (accumulator >= SUBSTEP) {
        accumulator -= SUBSTEP;
        const moved = integrate();
        if (moved > SLEEP_EPSILON || grabbed) moving = true;
      }
      return moving;
    },
  };
}
