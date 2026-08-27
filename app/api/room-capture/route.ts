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

/**
 * Ceiling on a decoded frame.
 *
 * Production 404s and the name is sanitised, so what is left is the development case:
 * any local process can POST here, and without a bound it can write a file of any size
 * as fast as it can send one. A 4K PNG of this scene is comfortably under two megabytes,
 * so eight is generous for a screenshot sink and still refuses to fill a disk.
 *
 * Checked against the decoded length rather than the string's, because base64 is what
 * arrives and bytes are what get written — the encoded form is a third larger, and
 * measuring the wrong one is how a limit ends up meaning something other than it says.
 */
const MAX_BYTES = 8 * 1024 * 1024;

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
  if (bytes.length > MAX_BYTES) {
    return Response.json(
      { error: `frame is ${bytes.length} bytes; the limit is ${MAX_BYTES}` },
      { status: 413 },
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, bytes);

  return Response.json({ file, bytes: bytes.length });
}
