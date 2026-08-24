/**
 * Case-study content model.
 *
 * **The copy has been cleared on purpose.** Both entries carry identity only —
 * slug, index, title — while the site's project writing is rebuilt from scratch.
 * The schema below is deliberately intact: it is the shape the rebuild fills in,
 * and `docs/design-audits/reel-content-design.md` plans against it.
 *
 * Every content field is optional, so a half-written entry renders as far as it
 * has been written instead of crashing or printing `undefined`. The detail page
 * (`app/work/[slug]/page.tsx`) skips any block whose data is absent.
 *
 * The one thing that is not content and therefore stayed: `/work/joi` still
 * hosts the live Joi session (`components/JoiWebEmbed.tsx`).
 */

export type ProjectSection = {
  heading: string;
  headingZh: string;
  body: string[];
  bodyZh: string[];
};

export type ProjectFigure = {
  src: string;
  alt: string;
  caption: string;
};

export type ProjectLoopStep = {
  index: string;
  label: string;
  title: string;
  body: string;
};

export type ProjectCase = {
  /** Identity. These three are the only fields the reset kept. */
  slug: string;
  index: string;
  title: string;

  /** Everything below is content, and is filled in by the rebuild. */
  date?: string;
  kind?: string;
  /** Optional line shown under the title on the detail page. */
  tagline?: string;
  role?: string;
  repo?: string;
  status?: string;
  stack?: string;
  summary?: string;
  summaryZh?: string;
  question?: string;
  caseFrame?: {
    decision: string;
    outcome: string;
  };
  cover?: string;
  motion?: {
    src: string;
    poster: string;
    label: string;
    caption: string;
  };
  loopTitle?: string;
  loopTitleZh?: string;
  loop?: ProjectLoopStep[];
  figures?: ProjectFigure[];
  sections?: ProjectSection[];
  experience?: {
    href: string;
    eyebrow: string;
    title: string;
    body: string;
    bodyZh: string;
    action: string;
  };
  nextSlug?: string;
  nextTitle?: string;
};

export const projects: ProjectCase[] = [
  {
    slug: "joi",
    index: "01",
    title: "JOI — PRESENCE",
  },
  {
    slug: "joi-mobile",
    index: "02",
    title: "JOI MOBILE — WITH YOU",
  },
];

export function getProject(slug: string) {
  const canonicalSlug = slug === "joi-map" ? "joi-mobile" : slug;
  return projects.find((project) => project.slug === canonicalSlug);
}
