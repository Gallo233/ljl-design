import type { ProjectCase } from "./projectData";
import { SITE_URL, canonicalPath } from "../app/site";

/**
 * Structured data, as a server component.
 *
 * One `<script type="application/ld+json">` per page, rendered on the server so it is
 * in the HTML a crawler is handed rather than something it has to run JavaScript to
 * find. Nothing here is user input — every value comes from the project data or from
 * `site.ts` — but `JSON.stringify` output still gets its `<` escaped, because a `</` in
 * any string would otherwise close the script tag early and put the rest of the graph
 * into the document as markup.
 */
function LdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

const PERSON = {
  "@type": "Person",
  "@id": `${SITE_URL}/#gallo`,
  name: "Gallo",
  url: `${SITE_URL}/`,
  jobTitle: "AI Product & Product Designer",
  homeLocation: { "@type": "Place", name: "Guangzhou, China" },
  sameAs: ["https://github.com/Gallo233"],
} as const;

/** The homepage says who the site is about. */
export function PersonJsonLd() {
  return (
    <LdScript
      data={{
        "@context": "https://schema.org",
        ...PERSON,
        description: "I design how AI enters human life.",
      }}
    />
  );
}

/**
 * A case study, as a CreativeWork rather than an Article.
 *
 * Article wants a headline, a byline and a publication date and is read as journalism.
 * These are design cases — dated by their last edit, authored rather than published —
 * and CreativeWork is the type that describes that without claiming fields the content
 * does not actually have.
 */
export function ProjectJsonLd({ project }: { project: ProjectCase }) {
  const url = `${SITE_URL}${canonicalPath(`/work/${project.slug}`)}`;
  return (
    <LdScript
      data={{
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": url,
        url,
        name: project.title,
        ...(project.summary ? { abstract: project.summary } : {}),
        ...(project.kind ? { genre: project.kind } : {}),
        ...(project.updated ? { dateModified: project.updated } : {}),
        ...(project.role ? { creditText: project.role } : {}),
        inLanguage: ["en", "zh-CN"],
        author: PERSON,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#site`,
          name: "Gallo",
          url: `${SITE_URL}/`,
        },
      }}
    />
  );
}
