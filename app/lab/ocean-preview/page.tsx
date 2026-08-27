import { notFound } from "next/navigation";
import { OceanPreview } from "./OceanPreview";

/**
 * Development-only bench for the sea in the JOI9000's screen. See `OceanPreview` for why
 * it exists; frames go to the same sink as the room bench.
 */
export const metadata = { title: "Ocean bench", robots: { index: false, follow: false } };

export default function OceanPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OceanPreview />;
}
