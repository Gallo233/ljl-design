import { fontVariables } from "../fonts";
import { JoiSignalLab } from "./JoiSignalLab";
import type { SectionId } from "./sections";

/**
 * One continuous experience behind four routes. Each route lands on its own section; from there
 * the reader just keeps scrolling. Fonts come from `app/fonts.ts`, shared with /lab.
 */
export function ExperienceShell({ section = "hero" }: { section?: SectionId }) {
  return <JoiSignalLab className={fontVariables} initialSection={section} />;
}
