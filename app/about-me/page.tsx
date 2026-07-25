import type { Metadata } from "next";
import { ExperienceShell } from "../joi-signal-lab/ExperienceShell";

export const metadata: Metadata = {
  title: "About Me",
  description: "Gallo — AI product builder and product designer in Guangzhou.",
};

export default function AboutMePage() {
  return <ExperienceShell section="about-me" />;
}
