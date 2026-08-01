import type { Metadata } from "next";
import type { ReactNode } from "react";
// The legacy light-site stylesheets load per-route now (see app/classic and app/work/[slug]).
// Loading them globally made body a scroll container and broke the CRT experience.
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gallo — AI Product & Product Design",
    template: "%s — Gallo",
  },
  description:
    "Gallo designs how AI enters human life through Joi, Joi Map, and product experiments at the boundary of technology and people.",
  metadataBase: new URL("https://gallo.design"),
  openGraph: {
    title: "Gallo — AI Product & Product Design",
    description: "I design how AI enters human life.",
    images: [],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
