import type { Metadata } from "next";
import { ExperienceShell } from "../joi-signal-lab/ExperienceShell";

export const metadata: Metadata = {
  title: "Selected Work",
  description: "Six frames of selected work, browsed through a continuous 3D film reel.",
};

export default function SelectedWorkPage() {
  return <ExperienceShell section="selected-work" />;
}
