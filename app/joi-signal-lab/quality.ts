/**
 * One place to decide how much machine we are running on.
 *
 * The reference keeps the same two switches — `isMobileDevice` and `reducedMemoryMode` —
 * and gates the expensive half of its post chain on them. Ours does the same, plus the
 * pixel-ratio clamp. A nine-pass full-viewport chain at DPR 2 shades four times as many
 * pixels as DPR 1, and its last draw is a fullscreen quad — canvas MSAA cannot improve
 * an edge that is not there. The measured compromise is DPR 1.5 on a capable desktop,
 * with one more step down on memory-limited hardware and phones. Five bloom levels
 * keep the wide glow while removing two down/up passes from the former six-level tier.
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
      dprCap: 1.5,
      bloomLevels: 5,
      persistence: true,
      antialias: false,
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
    dprCap: isMobile ? 1.25 : reducedMemory ? 1.25 : 1.5,
    bloomLevels: 5,
    // Two viewport-sized HalfFloat targets is the single largest allocation in the
    // chain, and the effect it buys is the one nobody misses on a small screen.
    persistence: !isMobile && !reducedMemory && !reducedMotion,
    // The renderer presents the post chain's fullscreen quad, not raw scene edges.
    antialias: false,
    shadows: !isMobile,
  };
}
