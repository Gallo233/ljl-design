import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import { SHARE_CARD, canonicalPath } from "../site";
import { LabFolder } from "./LabFolder";

/**
 * The Lab — reel frame 04's destination. A filing drawer of research and retired
 * prototypes in the light editorial world, standalone: it does not import the legacy
 * global stylesheets, so it scrolls like a normal document.
 */

const description =
  "Research and experiments around Joi and this site: CRT/shader pipeline work, Live2D binding, retired prototypes, and the postmortems that made room for the real work.";

export const metadata: Metadata = {
  // The root layout's title template appends "— Gallo".
  title: "The Lab / 实验室",
  description,
  alternates: { canonical: canonicalPath("/lab") },
  openGraph: {
    // A page's `openGraph` replaces the layout's, so siteName/type/card repeat here.
    type: "website",
    siteName: "Gallo",
    title: "The Lab / 实验室 — Gallo",
    description,
    url: canonicalPath("/lab"),
    images: [SHARE_CARD],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Lab / 实验室 — Gallo",
    description,
    images: [SHARE_CARD.url],
  },
};

export default function LabPage() {
  return (
    <div className={fontVariables}>
      <LabFolder />
    </div>
  );
}
