import { DM_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

/**
 * The site's three voices, loaded once and shared by every surface that needs the
 * `--font-signal-*` variables: the lab experience shell, /lab, and any future page
 * in either world. next/font requires these to be module-scope consts — this module
 * is that scope.
 */

export const displayFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-signal-display",
});

export const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-signal-body",
});

export const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-signal-mono",
});

export const fontVariables = `${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`;
