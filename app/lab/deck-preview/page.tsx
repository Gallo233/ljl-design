import { notFound } from "next/navigation";
import { DeckPreview } from "./DeckPreview";

/** Development-only bench for the deck console. See `DeckPreview` for why it exists. */
export const metadata = { title: "Deck bench", robots: { index: false, follow: false } };

export default function DeckPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DeckPreview />;
}
