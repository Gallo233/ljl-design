import type { MetadataRoute } from "next";
import { projects } from "../components/projectData";
import { SECTIONS } from "./joi-signal-lab/sections";
import { SITE_URL, canonicalPath } from "./site";

/**
 * The four section routes are one page behind four addresses, and they belong here
 * as four entries: each is separately deep-linkable and carries its own title and
 * description, which is exactly what a crawler is being told.
 *
 * `/classic` is deliberately absent — AGENTS.md keeps it intact and unlinked, so
 * advertising it would contradict that.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (
    path: string,
    priority: number,
    lastModified?: string,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${canonicalPath(path)}`,
    changeFrequency: "monthly",
    priority,
    ...(lastModified ? { lastModified } : {}),
  });

  /*
   * `lastModified` comes from the content, not from the clock.
   *
   * The tempting version is `new Date()`, which stamps every entry with the build time
   * and tells a crawler the whole site changed every time anything deployed — which is
   * worse than saying nothing, because it trains it to ignore the field. The project
   * cases already carry the ISO date of their last content edit for the metadata card,
   * so that is what goes here, and routes without a real date simply omit it.
   */
  return [
    ...SECTIONS.map((section) => entry(section.path, section.id === "hero" ? 1 : 0.8)),
    ...projects.map((project) => entry(`/work/${project.slug}`, 0.7, project.updated)),
    entry("/play/night-tide", 0.5),
    entry("/lab", 0.5),
  ];
}
