import type { Metadata } from "next";
import { ExperienceShell } from "./joi-signal-lab/ExperienceShell";

/**
 * The canonical is declared here rather than in the root layout on purpose: metadata
 * in a layout propagates to every route beneath it, so a canonical there told
 * `/classic` and `/play/night-tide` they were copies of the homepage.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <ExperienceShell section="hero" />;
}
