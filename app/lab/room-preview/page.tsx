import { notFound } from "next/navigation";
import { RoomPreview } from "./RoomPreview";

/**
 * Development-only bench for the About room. See `RoomPreview` for why it exists and
 * `app/api/room-capture/route.ts` for where its frames go.
 */
export const metadata = { title: "About room bench", robots: { index: false, follow: false } };

export default function RoomPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RoomPreview />;
}
