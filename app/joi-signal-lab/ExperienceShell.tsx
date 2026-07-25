import { DM_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { JoiSignalLab } from "./JoiSignalLab";
import type { SectionId } from "./sections";

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

/**
 * One continuous experience behind four routes. Each route lands on its own section; from there
 * the reader just keeps scrolling.
 */
export function ExperienceShell({ section = "hero" }: { section?: SectionId }) {
  return (
    <JoiSignalLab
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      initialSection={section}
    />
  );
}
