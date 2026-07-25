/**
 * The site is one continuous scroll through four sections, the way shader.se does it:
 * every section has its own URL, but you can also just keep scrolling from one into the next.
 *
 * `start`/`end` are positions along the whole scroll (0 = top, 1 = bottom).
 */

export type SectionId = "hero" | "selected-work" | "about-me" | "contact";

export type Section = {
  id: SectionId;
  path: string;
  label: string;
  /** Screen-reader / document title for this section. */
  title: string;
  start: number;
  end: number;
};

export const SECTIONS: Section[] = [
  { id: "hero", path: "/", label: "HOME", title: "Gallo — AI Product & Product Design", start: 0, end: 0.28 },
  { id: "selected-work", path: "/selected-work", label: "SELECTED WORK", title: "Selected Work", start: 0.28, end: 0.62 },
  { id: "about-me", path: "/about-me", label: "ABOUT ME", title: "About Me", start: 0.62, end: 0.84 },
  { id: "contact", path: "/contact", label: "CONTACT", title: "Contact", start: 0.84, end: 1 },
];

/**
 * Where the reel has fully taken over. The hero's camera flight and the film entrance are both
 * calibrated against a 0..1 range that ends here, so they keep their original timing no matter
 * how long the rest of the page gets.
 *
 * This has to be the moment Selected Work begins, not a moment after it: deep-linking to
 * /selected-work lands exactly on that boundary, and anything later leaves the reader in the
 * hand-off — hero already faded, film not yet arrived, nothing on screen.
 */
export const REEL_ANCHOR = SECTIONS[1].start;

/** Total scroll length. Roughly 4.5 viewport heights per section, like the reference. */
export const SCROLL_SCREENS = 7;

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const smoothStep = (value: number) => {
  const amount = clamp01(value);
  return amount * amount * (3 - 2 * amount);
};

export function getSection(id: SectionId) {
  return SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];
}

export function sectionForPath(path: string): SectionId {
  const match = SECTIONS.find((section) => section.path === path);
  return match ? match.id : "hero";
}

/** 0 at the section's start, 1 at its end. */
export function progressWithin(section: Section, scrollProgress: number) {
  return clamp01((scrollProgress - section.start) / Math.max(0.0001, section.end - section.start));
}

/** Which section the given scroll position sits in. */
export function sectionAt(scrollProgress: number): SectionId {
  for (let index = SECTIONS.length - 1; index >= 0; index -= 1) {
    if (scrollProgress >= SECTIONS[index].start) return SECTIONS[index].id;
  }
  return "hero";
}

/**
 * Scroll offset in pixels that lands the given section at its start.
 * A hair past the boundary so `sectionAt` agrees with where we jumped.
 */
export function scrollTopForSection(id: SectionId, travel: number) {
  const section = getSection(id);
  return section.start === 0 ? 0 : Math.round((section.start + 0.005) * travel);
}
