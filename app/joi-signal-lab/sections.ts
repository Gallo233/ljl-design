/**
 * The site is one continuous scroll through four sections, the way shader.se does it:
 * every section has its own URL, but you can also just keep scrolling from one into the next.
 *
 * Positions are in **viewport heights**, matching the reference — `2.4` means "2.4 screens down".
 * That keeps the numbers readable and independent of how long the page ends up being.
 *
 * Model and constants: docs/shader-research/shader-se-2026-07/.web-shader-extractor/evidence/
 * source/scroll-and-transitions.md
 */

export type SectionId = "hero" | "selected-work" | "about-me" | "contact";

/**
 * A snap window, direction-aware. The active range is `position + range[0] .. position + range[1]`,
 * picked by scroll direction. `multiplier` weights the candidate: higher wins from further away.
 * A pair is `[whenAhead, whenBehind]`.
 */
export type SnapWindow = {
  range: [number, number];
  multiplier: number | [number, number];
};

export type SnapConfig = {
  forward: SnapWindow;
  backward: SnapWindow;
  /** Arrow-key snap durations in ms. */
  keyboard?: { toNext?: number; toPrevious?: number };
};

export type Section = {
  id: SectionId;
  path: string;
  label: string;
  title: string;
  /** Screens from the top. */
  position: number;
  /** Null means "nav target, not a snap target" — the reference does the same. */
  snap: SnapConfig | null;
};

/**
 * Snap layout copied from shader.se's `mainPage.snapPoints`.
 *
 * Only the first two snap. The asymmetry on Selected Work is the interesting part: scrolling
 * down it grabs you from 0.9 screens out at normal strength, scrolling up it only reaches
 * 0.22 screens but pulls at 3x. Easy to enter, hard to fall out of, easy to deliberately leave.
 *
 * About Me and Contact carry a position but no window, so they never yank a reader who is
 * partway through reading them.
 */
/**
 * The 8.6-screen map (gap-report §4 asked for 8–12). Positions carry the pacing:
 * the hero flight + film entrance stretch across 0→2 automatically because both are
 * calibrated to `screens / REEL_ANCHOR`; the reel then holds 2→~4.4 of interactive
 * dwell, hands off across 4.4→5.2, and the closing sections read at leisure.
 *
 * Snap windows are the source ratios scaled to the doubled anchor (hand-tuned from
 * shader.se's `mainPage.snapPoints`, not copied verbatim any more).
 */
export const SECTIONS: Section[] = [
  {
    id: "hero",
    path: "/",
    label: "HOME",
    title: "Gallo — AI Product & Product Design",
    position: 0,
    snap: {
      forward: { range: [-10000, 0.1], multiplier: 1 },
      backward: { range: [-10000, 1.6], multiplier: 1 },
      keyboard: { toNext: 2000 },
    },
  },
  {
    id: "selected-work",
    path: "/selected-work",
    label: "SELECTED WORK",
    title: "Selected Work",
    position: 2,
    snap: {
      forward: { range: [-1.8, 0.6], multiplier: 1 },
      backward: { range: [-0.44, 1.2], multiplier: [3, 0.3] },
      keyboard: { toPrevious: 2000, toNext: 3000 },
    },
  },
  { id: "about-me", path: "/about-me", label: "ABOUT ME", title: "About Me", position: 5.2, snap: null },
  { id: "contact", path: "/contact", label: "CONTACT", title: "Contact", position: 7.6, snap: null },
];

/** Total scroll length in screens: the last section plus a screen to read it in. */
export const TOTAL_SCREENS = SECTIONS[SECTIONS.length - 1].position + 1;

/**
 * Where the reel has fully taken over. The hero's camera flight and the film entrance are both
 * calibrated against a 0..1 range that ends here, so they keep their timing as the page grows.
 *
 * This has to be where Selected Work begins, not a moment after: deep-linking to /selected-work
 * lands exactly on that boundary, and anything later leaves the reader in the hand-off — hero
 * already faded, film not yet arrived, nothing on screen.
 */
const reelSection = SECTIONS.find((section) => section.id === "selected-work");
if (!reelSection) {
  throw new Error("SECTIONS must contain 'selected-work' — see AGENTS.md, scroll architecture");
}

export const REEL_ANCHOR = reelSection.position;

if (process.env.NODE_ENV !== "production" && REEL_ANCHOR !== SECTIONS[1].position) {
  // Belt-and-braces for future refactors: this equality has been broken once before,
  // and the failure mode is a blank screen on the /selected-work deep link.
  //
  // Looking the section up by id and *then* checking it is still second is what makes
  // this bite. Reading `SECTIONS[1].position` into the constant and comparing it to
  // `SECTIONS[1].position` — which is what stood here — is a tautology: it cannot fail,
  // and inserting a section above Selected Work would have moved the anchor in silence
  // rather than stopping the build.
  throw new Error("REEL_ANCHOR must equal SECTIONS[1].position — see AGENTS.md, scroll architecture");
}

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const smoothStep = (value: number) => {
  const amount = clamp01(value);
  return amount * amount * (3 - 2 * amount);
};

export function getSection(id: SectionId) {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];
}

/** 0 at the section's position, 1 at the next one's. */
export function progressWithin(id: SectionId, screens: number) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const section = SECTIONS[index];
  const next = SECTIONS[index + 1];
  const span = (next ? next.position : TOTAL_SCREENS) - section.position;
  return clamp01((screens - section.position) / Math.max(0.0001, span));
}

/** Which section the reader is in, given a position in screens. */
export function sectionAt(screens: number): SectionId {
  for (let index = SECTIONS.length - 1; index >= 0; index -= 1) {
    // A section owns the scroll from a little before its position, so the label flips as the
    // section actually starts to appear rather than after it has fully arrived.
    if (screens >= SECTIONS[index].position - 0.35) return SECTIONS[index].id;
  }
  return "hero";
}

/**
 * Pick the snap point that should claim the current scroll, or null.
 * Mirrors the reference: filter by direction-aware window, then rank by distance / multiplier.
 */
export function snapTarget(screens: number, direction: number): Section | null {
  const candidates = SECTIONS.filter((section) => {
    if (!section.snap) return false;
    const window = direction === -1 ? section.snap.backward : section.snap.forward;
    const [low, high] = window.range;
    return screens >= section.position + low && screens <= section.position + high;
  });
  if (candidates.length === 0) return null;

  let best: Section | null = null;
  let bestScore = Infinity;
  for (const section of candidates) {
    const window = direction === -1 ? section.snap!.backward : section.snap!.forward;
    const ahead = section.position >= screens;
    const multiplier = Array.isArray(window.multiplier)
      ? window.multiplier[ahead ? 0 : 1]
      : window.multiplier;
    const score = Math.abs(section.position - screens) / Math.max(multiplier, 0.001);
    if (score < bestScore) {
      bestScore = score;
      best = section;
    }
  }
  return best;
}

/** Arrow-key snap duration between two sections, in ms. Reference defaults to 1000. */
export function keyboardDuration(from: SectionId, to: SectionId) {
  const fromIndex = SECTIONS.findIndex((s) => s.id === from);
  const toIndex = SECTIONS.findIndex((s) => s.id === to);
  const source = SECTIONS[toIndex]?.snap?.keyboard;
  if (!source) return 1000;
  return (toIndex > fromIndex ? source.toNext : source.toPrevious) ?? 1000;
}
