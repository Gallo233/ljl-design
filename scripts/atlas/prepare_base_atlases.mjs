/**
 * Prepare the About room's base atlases for the web.
 *
 * The captured atlases are 4096² (books 6144²) Blender bakes on the standard
 * #C5C5C5 "nothing was baked here" background. Two things have to happen before a
 * browser can use them:
 *
 *   1. Dilate. The background is only a few pixels away from every UV island edge.
 *      Downscaling straight to 1–2K averages that grey into the island borders and
 *      every object picks up a pale outline. A bounded flood fill pushes island
 *      colour outward first, so the downscale only ever averages real colour.
 *   2. Downscale. Seven 4K atlases is ~470 MB of VRAM. The room never fills more
 *      than half the viewport, so the wood-and-desk atlas keeps 2K and the rest
 *      drop to 1K — about 56 MB, in the same range as our own Blender bakes.
 *
 * Run: node scripts/atlas/prepare_base_atlases.mjs
 */

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = path.join(ROOT, "docs/pinchen-room-research/.web-shader-extractor/evidence/network");
const OUT_DIR = path.join(ROOT, "public/models/about-room-base");

/** The bake background Blender writes where no island lands. */
const BACKGROUND = [197, 197, 197];
const BACKGROUND_TOLERANCE = 10;
/** Source pixels of colour pushed past each island edge before the downscale. */
const DILATE_STEPS = 16;

/**
 * Output edge per atlas. Two earn 2K: the desk-and-wood atlas because it covers most
 * of what the camera looks at, and the dark-objects atlas because the chair's islands
 * are small enough that 1K magnifies them into visible banding across the backrest.
 */
const ATLAS_SIZES = {
  env: 1024,
  group1: 2048,
  group2: 2048,
  group3: 1024,
  books: 1024,
  camera: 1024,
  vinyl: 1024,
};

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/**
 * Multi-source BFS outward from every island edge. Each background pixel takes the
 * colour of the nearest island pixel, up to `steps` away; anything further stays
 * background and is never sampled by a UV.
 */
function dilate(data, width, height, steps) {
  const count = width * height;
  const filled = new Uint8Array(count);
  let frontier = [];

  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const distance =
      Math.abs(data[o] - BACKGROUND[0]) +
      Math.abs(data[o + 1] - BACKGROUND[1]) +
      Math.abs(data[o + 2] - BACKGROUND[2]);
    if (distance > BACKGROUND_TOLERANCE) {
      filled[i] = 1;
      frontier.push(i);
    }
  }

  for (let step = 0; step < steps && frontier.length; step++) {
    const next = [];
    for (const i of frontier) {
      const x = i % width;
      const y = (i - x) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (filled[n]) continue;
        filled[n] = 1;
        data[n * 3] = data[i * 3];
        data[n * 3 + 1] = data[i * 3 + 1];
        data[n * 3 + 2] = data[i * 3 + 2];
        next.push(n);
      }
    }
    frontier = next;
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const manifest = {
  version: 1,
  lightingState: "light-day",
  source: "docs/pinchen-room-research/.web-shader-extractor/evidence/network",
  geometry: {},
  atlases: {},
};

const geometrySource = path.join(SOURCE, "desk.glb");
const geometryOut = path.join(ROOT, "public/models/about-room-base.glb");
copyFileSync(geometrySource, geometryOut);
manifest.geometry = {
  url: "/models/about-room-base.glb",
  sha256: sha256(geometryOut),
  bytes: statSync(geometryOut).size,
  compression: "KHR_draco_mesh_compression",
};
console.log(`geometry  about-room-base.glb  ${(statSync(geometryOut).size / 1024).toFixed(0)} KB`);

for (const [name, size] of Object.entries(ATLAS_SIZES)) {
  const source = path.join(SOURCE, `light-day-${name}.webp`);
  const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
  dilate(data, info.width, info.height, DILATE_STEPS);

  const out = path.join(OUT_DIR, `light-day-${name}.webp`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .resize(size, size, { fit: "fill", kernel: "lanczos3" })
    .webp({ quality: 88, effort: 6 })
    .toFile(out);

  const bytes = statSync(out).size;
  manifest.atlases[name] = { url: `/models/about-room-base/light-day-${name}.webp`, size, sha256: sha256(out), bytes };
  console.log(`atlas     light-day-${name.padEnd(7)} ${info.width}² → ${size}²  ${(bytes / 1024).toFixed(0)} KB`);
}

writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nwrote ${path.relative(ROOT, path.join(OUT_DIR, "manifest.json"))}`);
