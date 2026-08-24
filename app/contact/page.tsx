import type { Metadata } from "next";
import { canonicalPath } from "../site";
import { ExperienceShell } from "../joi-signal-lab/ExperienceShell";

export const metadata: Metadata = {
  title: "Contact",
  description: "Let's make technology people can live with.",
  alternates: { canonical: canonicalPath("/contact") },
};

export default function ContactPage() {
  return <ExperienceShell section="contact" />;
}
