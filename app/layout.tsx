import type { Metadata } from "next";
import type { ReactNode } from "react";
// The legacy light-site stylesheets load per-route now (see app/classic and app/work/[slug]).
// Loading them globally made body a scroll container and broke the CRT experience.
import "./globals.css";
import { GlobalMusicProvider } from "../components/global-music/GlobalMusic";
import { LocaleProvider } from "./i18n";
import { SITE_URL } from "./site";

export const metadata: Metadata = {
  /*
   * Metadata is served, not switched.
   *
   * The language toggle is client state, and `<head>` is written before any of it runs,
   * so these are the site's own language — the same Chinese `<html lang>` declares and
   * the same Chinese the first paint contains. A visitor who switches to English gets an
   * English interface and an English `document.title`, which the experience shell keeps
   * in step with the active section; what it cannot retroactively change is the document
   * a crawler was served. "Gallo" stays a name in both.
   */
  title: {
    default: "Gallo — AI 产品与产品设计",
    template: "%s — Gallo",
  },
  description:
    "Gallo 做的是 AI 如何进入人的生活：Joi、Joi Mobile，以及一系列在技术与人之间的产品实验。",
  // This used to read `gallo.design`, which is not where the site lives. Every
  // relative canonical and every generated OG image URL is resolved against it,
  // so a wrong value here silently points shares and crawlers at another domain.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: "Gallo",
    title: "Gallo — AI 产品与产品设计",
    description: "我做的是 AI 如何进入人的生活。",
    // No `url` here, and no `images: []`. Metadata set on a layout propagates to
    // every route under it, so a `url` would hand `/classic` the homepage's
    // address; and an empty `images` array would suppress the card that
    // `app/opengraph-image.png` supplies to all routes by file convention.
  },
  twitter: {
    card: "summary_large_image",
    title: "Gallo — AI 产品与产品设计",
    description: "我做的是 AI 如何进入人的生活。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    /*
     * `zh-CN` is the served language and the one the markup actually contains. The
     * provider rewrites this attribute the moment a visitor picks English, so assistive
     * technology follows the switch instead of reading English in a Chinese voice.
     */
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <LocaleProvider>
          <GlobalMusicProvider>{children}</GlobalMusicProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
