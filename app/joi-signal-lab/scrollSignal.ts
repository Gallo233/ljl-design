/**
 * Scroll speed as a visual input.
 *
 * The reference treats the picture as a signal, and moving fast through it as something
 * the signal has to survive: scroll hard and the tube loses its grip, stop and it locks.
 * The page already measures the velocity it needs for this — the driver publishes it
 * every frame — and until now nothing looked at it.
 *
 * Two properties matter more than the exact curve:
 *
 *   - **Zero in, zero out.** At rest the offsets must be exactly the authored grade and
 *     not merely close to it, or the page never quite looks settled.
 *   - **The fall is slower than the rise.** Instability that decays as fast as it builds
 *     reads as flicker. Letting it ring out reads as a machine recovering, which is the
 *     thing being described.
 *
 * ### On grain
 *
 * Grain is deliberately not one of the knobs this drives, though it is the obvious
 * fourth. It was taken out of the chain twice on purpose — "it read as dirt on a lens
 * rather than as film stock", and again as "the last thing sitting between the reader
 * and the picture" — and `uNoiseIntensity` is held at zero for that reason. Bringing it
 * back on a velocity curve would reverse that decision by the back door. The knob is
 * still there if the argument changes.
 */

/** Screens per second at which the signal is as unstable as it gets. */
const FULL_SCALE = 2.2;
/** How fast instability builds, and how much more slowly it lets go. */
const RISE_PER_SECOND = 9;
const FALL_PER_SECOND = 3.2;
/** Below this the reader is not scrolling, and the picture is locked. */
const DEAD_ZONE = 0.02;

export type ScrollSignal = {
  /**
   * Advance and return instability, 0 at rest to 1 at full speed.
   *
   * @param velocity screens per second, signed; only the magnitude is read
   * @param delta    seconds since the last frame
   */
  update: (velocity: number, delta: number) => number;
};

/**
 * @param scale caps the output, so a tier can ask for half the effect. `quality.ts`
 *              decides the number; this module does not know what a phone is.
 */
export function createScrollSignal(scale = 1): ScrollSignal {
  let level = 0;
  return {
    update: (velocity, delta) => {
      const speed = Math.abs(velocity);
      const target = speed < DEAD_ZONE ? 0 : Math.min(1, speed / FULL_SCALE);
      const rate = target > level ? RISE_PER_SECOND : FALL_PER_SECOND;
      // Frame-rate independent approach, same shape the scroll driver's lerp uses.
      level += (target - level) * (1 - Math.exp(-rate * delta));
      // Snap the tail to zero so a settled page reads the authored grade exactly.
      if (target === 0 && level < 0.002) level = 0;
      return level * scale;
    },
  };
}
