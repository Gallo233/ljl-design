import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Development-only sink for `/lab/room-preview` frames.
 *
 * An agent browser pane reports `document.visibilityState === "hidden"`, which
 * suspends `requestAnimationFrame` and therefore every paint on this site — a
 * screenshot there is a black rectangle whatever the scene is doing. The preview page
 * sidesteps that by rendering on demand into a `preserveDrawingBuffer` canvas and
 * POSTing the pixels here, so the About room can be looked at without a visible
 * browser. See AGENTS.md, "How to work here".
 *
 * Writes under `.next/cache/`, which is already ignored, and 404s outside development.
 */

const OUT_DIR = path.join(process.cwd(), ".next", "cache", "room-preview");

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const { name, dataUrl } = (await request.json()) as { name?: string; dataUrl?: string };
  if (!name || !dataUrl?.startsWith("data:image/png;base64,")) {
    return Response.json({ error: "expected { name, dataUrl } with a PNG data URL" }, { status: 400 });
  }

  // The name only ever labels a frame; keep it to something that cannot escape OUT_DIR.
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  const file = path.join(OUT_DIR, `${safeName}.png`);
  const bytes = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, bytes);

  return Response.json({ file, bytes: bytes.length });
}
