/**
 * One place to decide how much machine we are running on.
 *
 * The reference keeps the same two switches — `isMobileDevice` and `reducedMemoryMode` —
 * and gates the expensive half of its post chain on them. Ours does the same, plus the
 * pixel-ratio clamp. The stage used to stop at 1.5 even on a 2x desktop display, so
 * the browser enlarged every finished frame by a third and softened the video, drawn
 * atlas and typography baked into those images together. Full-density desktop output
 * is worth more than four-sample MSAA here; the post chain uses two samples instead.
 *
 * Read once at startup. A device does not stop being a phone mid-session, and a tier
 * that changes under a running renderer means reallocating every target.
 */

export type QualityTier = {
  isMobile: boolean;
  reducedMemory: boolean;
  reducedMotion: boolean;
  /** Ceiling on devicePixelRatio for the stage canvas. */
  dprCap: number;
  /** Mip levels in the bloom chain. */
  bloomLevels: number;
  /** Temporal persistence needs two HalfFloat targets the size of the viewport. */
  persistence: boolean;
  /** MSAA on the stage canvas. */
  antialias: boolean;
  /** Shadow maps in the hero scene. */
  shadows: boolean;
};

export function detectQuality(): QualityTier {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      reducedMemory: false,
      reducedMotion: false,
      dprCap: 2,
      bloomLevels: 7,
      persistence: true,
      antialias: true,
      shadows: true,
    };
  }

  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // `deviceMemory` is Chromium-only and reports in GiB, rounded down to a power of two.
  // Absent means "unknown", and on a phone unknown is not a reason for optimism.
  const memory = (navigator as any).deviceMemory as number | undefined;
  const reducedMemory = memory !== undefined ? memory <= 4 : isMobile;

  return {
    isMobile,
    reducedMemory,
    reducedMotion,
    dprCap: isMobile ? 1.25 : reducedMemory ? 1.5 : 2,
    bloomLevels: isMobile || reducedMemory ? 5 : 7,
    // Two viewport-sized HalfFloat targets is the single largest allocation in the
    // chain, and the effect it buys is the one nobody misses on a small screen.
    persistence: !isMobile && !reducedMemory && !reducedMotion,
    antialias: !isMobile,
    shadows: !isMobile,
  };
}
