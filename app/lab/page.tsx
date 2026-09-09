import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import { SHARE_CARD, canonicalPath } from "../site";
import { LabFolder } from "./LabFolder";

/**
 * The Lab — reel frame 04's destination. A filing drawer of research and retired
 * prototypes in the light editorial world, standalone: it does not import the legacy
 * global stylesheets, so it scrolls like a normal document.
 */

/*
 * Served metadata is the site's own language, like the root layout's.
 *
 * The language switch is client state and `<head>` is written before any of it runs, so
 * a served title cannot follow it. What used to be here — "The Lab / 实验室" — solved
 * that by saying both at once, which is the mixture the switch exists to replace.
 */
const description =
  "余钟：UE5 动作 RPG；余响：Three.js 探索游戏；来生酒吧：Blender 三维场景重建。三个关于游戏与空间的制作实验。";

export const metadata: Metadata = {
  // The root layout's title template appends "— Gallo".
  title: "实验室",
  description,
  alternates: { canonical: canonicalPath("/lab") },
  openGraph: {
    // A page's `openGraph` replaces the layout's, so siteName/type/card repeat here.
    type: "website",
    siteName: "Gallo",
    title: "实验室 — Gallo",
    description,
    url: canonicalPath("/lab"),
    images: [SHARE_CARD],
  },
  twitter: {
    card: "summary_large_image",
    title: "实验室 — Gallo",
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
