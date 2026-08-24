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
  const entry = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${canonicalPath(path)}`,
    changeFrequency: "monthly",
    priority,
  });

  return [
    ...SECTIONS.map((section) => entry(section.path, section.id === "hero" ? 1 : 0.8)),
    ...projects.map((project) => entry(`/work/${project.slug}`, 0.7)),
    entry("/play/night-tide", 0.5),
    entry("/lab", 0.5),
  ];
}
