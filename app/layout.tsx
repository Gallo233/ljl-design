import type { Metadata } from "next";
import type { ReactNode } from "react";
// The legacy light-site stylesheets load per-route now (see app/classic and app/work/[slug]).
// Loading them globally made body a scroll container and broke the CRT experience.
import "./globals.css";
import { GlobalMusicProvider } from "../components/global-music/GlobalMusic";
import { SITE_URL } from "./site";

export const metadata: Metadata = {
  title: {
    default: "Gallo — AI Product & Product Design",
    template: "%s — Gallo",
  },
  description:
    "Gallo designs how AI enters human life through Joi, Joi Mobile, and product experiments at the boundary of technology and people.",
  // This used to read `gallo.design`, which is not where the site lives. Every
  // relative canonical and every generated OG image URL is resolved against it,
  // so a wrong value here silently points shares and crawlers at another domain.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: "Gallo",
    title: "Gallo — AI Product & Product Design",
    description: "I design how AI enters human life.",
    // No `url` here, and no `images: []`. Metadata set on a layout propagates to
    // every route under it, so a `url` would hand `/classic` the homepage's
    // address; and an empty `images` array would suppress the card that
    // `app/opengraph-image.png` supplies to all routes by file convention.
  },
  twitter: {
    card: "summary_large_image",
    title: "Gallo — AI Product & Product Design",
    description: "I design how AI enters human life.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <GlobalMusicProvider>{children}</GlobalMusicProvider>
      </body>
    </html>
  );
}
