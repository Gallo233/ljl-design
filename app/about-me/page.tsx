import type { Metadata } from "next";
import { canonicalPath } from "../site";
import { ExperienceShell } from "../joi-signal-lab/ExperienceShell";

export const metadata: Metadata = {
  title: "About Me",
  description: "Gallo — AI product builder and product designer in Guangzhou.",
  alternates: { canonical: canonicalPath("/about-me") },
};

export default function AboutMePage() {
  return <ExperienceShell section="about-me" />;
}
