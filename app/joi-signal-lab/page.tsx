import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { JoiSignalLab } from "./JoiSignalLab";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-signal-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-signal-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-signal-mono",
});

export const metadata: Metadata = {
  title: "JOI9000 — Selected Joi Work",
  description: "Enter JOI9000, reform Joi's particle identities, and inspect selected work through a continuous 3D film reel.",
};

export default function JoiSignalLabPage() {
  return (
    <JoiSignalLab className={`${display.variable} ${body.variable} ${mono.variable}`} />
  );
}
