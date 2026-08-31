/**
 * Work-route identity and metadata only.
 *
 * The previous long-case-study fields (problem/decision/outcome, product loop,
 * screenshots and captions) were deliberately removed after the Living
 * Aperture direction was approved. Do not add them back as placeholders. The
 * two work routes are short experience launchers; future editorial content
 * needs a separately approved surface.
 */

export type ProjectCase = {
  slug: "joi" | "joi-mobile";
  index: string;
  title: string;
  tagline: string;
  kind: string;
  repo: string;
  /** Search/share metadata. It is not rendered as case-study copy. */
  summary: string;
  updated: string;
};

export const projects: ProjectCase[] = [
  {
    slug: "joi",
    index: "01",
    title: "JOI — PRESENCE",
    tagline: "A machine learning how to live with you.",
    kind: "AI COMPANION / LIVE WEB",
    repo: "https://github.com/Gallo233/Joi",
    summary: "A live, interruptible AI companion designed to remain present between requests.",
    updated: "2026-08-30",
  },
  {
    slug: "joi-mobile",
    index: "02",
    title: "JOI MOBILE — WITH YOU",
    tagline: "The same relationship, carried with you.",
    kind: "NATIVE COMPANION / IPHONE",
    repo: "https://github.com/Gallo233/Joi-Mobile",
    summary: "A native iPhone companion that carries character, conversation and chosen memory with you.",
    updated: "2026-08-30",
  },
];

export function getProject(slug: string) {
  const canonicalSlug = slug === "joi-map" ? "joi-mobile" : slug;
  return projects.find((project) => project.slug === canonicalSlug);
}
