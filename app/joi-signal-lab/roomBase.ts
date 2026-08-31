import type { RoomObjectId } from "./roomObjects";

/**
 * The About room's base shell: the high-fidelity desk study captured from the
 * reference site, wired up here as the floor the rest of the room stands on.
 *
 * Provenance and the terms this sits under: `docs/asset-provenance.md`. The short
 * version is that the geometry and its bakes are third-party and staged, not owned;
 * everything below is written so the base can be swapped without touching the props,
 * the hotspots or the camera.
 *
 * The capture is a Draco-compressed GLB carrying **no materials at all** — the
 * original assigns them at runtime — plus seven separate baked colour atlases. So the
 * two things this module owns are the parts that were not in the file: which atlas
 * each mesh samples, and where the whole thing sits in our room's coordinates.
 */

export type BaseAtlasId = "env" | "group1" | "group2" | "group3" | "books" | "camera" | "vinyl";

/**
 * GLTFLoader renames every node on the way in, the same way `THREE.PropertyBinding`
 * does for animation tracks: whitespace becomes `_` and `[ ] . : /` are dropped. The
 * capture is full of names like `desk lamp` and `Tube_Light Grey_0.001`, so the tables
 * below are written with the names as authored and looked up through this.
 */
export const sanitizeNodeName = (name: string) => name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");

export const BASE_ATLAS_IDS: BaseAtlasId[] = [
  "env",
  "group1",
  "group2",
  "group3",
  "books",
  "camera",
  "vinyl",
];

/**
 * Mesh → atlas.
 *
 * Recovered, not read: the capture has no material array, so this table was derived
 * by rasterising every mesh's UVs against each atlas's baked-content mask and ranking
 * by how far above chance the fit landed (an atlas that is 87% covered scores 87% on a
 * mesh that belongs to a different one). Names and the atlas contact sheets settle the
 * rest — the books atlas is book spines, the vinyl atlas is two records and a tonearm.
 *
 * Anything missing from this table falls back to `group1` and warns in development.
 */
const AUTHORED_NODE_ATLAS: Record<string, BaseAtlasId> = {
  // The shell: floor, walls and the room's own baked daylight.
  env: "env",

  // Desk, shelving, paper and the warm wood the room is built out of.
  "Cube.001_mate_0": "group1",
  "Cube.001_mate_0.001": "group1",
  "Cube.001_mate_0.002": "group1",
  bookshelf: "group1",
  "bookshelf.001": "group1",
  "desk lamp": "group1",
  "Lamp_stand_Circle.006": "group1",
  headphones: "group1",
  guitar: "group1",
  "poster.001": "group1",
  "poster.002": "group1",
  StackOfPaper_blinn2_0: "group1",
  polySurface7_standardSurface1_0: "group1",
  "polySurface7_standardSurface1_0.001": "group1",
  "light 3.001": "group1",
  "light 3.002": "group1",
  "light 3.003": "group1",

  // The dark half: chair, turntable, ceiling tubes, laptop body.
  "bottom chair": "group2",
  "top chair": "group2",
  "top chair.002": "group2",
  "turntable body 1": "group2",
  "turntable body 2": "group2",
  "turntable body 3": "group2",
  "turntable buttons 1": "group2",
  turntable_needle: "group2",
  "turntable cover": "group2",
  POWER_DIAL_SPEED_LIGHT_GLASS_Circle: "group2",
  "POWER_DIAL_SPEED_LIGHT_GLASS_Circle.105": "group2",
  "POWER_DIAL_SPEED_LIGHT_LIGHT_Circle.109": "group2",
  macbook: "group2",
  "Cube.008": "group2",
  "Tube_Light Grey_0.001": "group2",
  "Tube_Light Grey_0.002": "group2",
  "Tube_Light Grey_0.003": "group2",

  // Screens, whiteboard and the small desk hardware.
  whiteboard: "group3",
  "whiteboard face": "group3",
  screen: "group3",
  "screen.001": "group3",
  pen: "group3",
  Cylinder: "group3",
  Curve: "group3",
  "desk lamp.001": "group3",
  "Lamphead_Circle.007": "group3",

  // The camera body and the film roll beside it carry their own 4K atlas.
  camera: "camera",
  film: "camera",
  "film.001": "camera",
};

/** Both halves of every shelved book share the 6K book-spine atlas. */
for (let i = 1; i <= 10; i += 1) {
  AUTHORED_NODE_ATLAS[`book${i}`] = "books";
  AUTHORED_NODE_ATLAS[`book${i} outer`] = "books";
}

/** Records and their labels, on the wall and on the platter. */
for (let i = 1; i <= 4; i += 1) {
  AUTHORED_NODE_ATLAS[`Vinyl ${i}`] = "vinyl";
  AUTHORED_NODE_ATLAS[`Vinyl face ${i}`] = "vinyl";
}

/**
 * Meshes whose atlas layout lives in TEXCOORD_1 rather than TEXCOORD_0.
 *
 * Some of the capture's objects arrived from a different source than the desk did and
 * kept their own texture UVs in slot 0, with the bake packed into slot 1. Sampling slot
 * 0 on those paints the atlas's packing layout across them, which is unmistakable.
 *
 * Which slot holds the bake is a question with an answer, not a guess: read the mesh's
 * UVs and sample the atlas at them. A bake layout lands on ink; a texture layout strays
 * onto the light grey the packer leaves between islands. The ceiling tubes were the ones
 * still getting it wrong — slot 0 straddles the background, slot 1 is solid ink.
 */
const AUTHORED_NODE_UV: Record<string, 0 | 1> = {
  "Tube_Light Grey_0.001": 1,
  "Tube_Light Grey_0.002": 1,
  "Tube_Light Grey_0.003": 1,
};

/**
 * Meshes the capture ships geometry for but never baked, and the colour to stand in.
 *
 * The chair is the one object here with no lightmap at all. Its slot 0 UVs span the full
 * 0..1 of the atlas — no bake layout does that, since a bake gives every mesh its own
 * island — and its slot 1 UVs are broken two different ways: `top chair` runs from
 * -1.3994 to 2.3994, so it wraps the atlas several times over and smears it into bands,
 * and `top chair.002` is degenerate, every vertex sitting on exactly (0, 1) so the whole
 * panel samples a single texel. Both land on the packer's grey background rather than on
 * ink, which is why the backrest read as a pale streaked panel instead of as a chair.
 *
 * There is nothing to recover, so the panels take the median ink of the atlas they
 * belong to — the same near-black the turntable and the tubes beside them bake to. It
 * runs through the same exposure and lift as a sampled texel would, so it sits in the
 * room's tonal world rather than beside it.
 */
const AUTHORED_NODE_FLAT: Record<string, string> = {
  "top chair": "#1f1d19",
  "top chair.002": "#1f1d19",
};

export const BASE_NODE_UV: Record<string, 0 | 1> = Object.fromEntries(
  Object.entries(AUTHORED_NODE_UV).map(([name, channel]) => [sanitizeNodeName(name), channel]),
);

/**
 * Meshes the original site put a picture on rather than a bake, and the picture to hang.
 *
 * `poster.002` is the sheet inside the frame beside the bookshelf — the original hung a
 * film poster there. It is authored for it: sixteen vertices whose UVs run the full 0..1,
 * which is what a mesh meant to carry one whole image looks like and is nothing like a
 * bake island. Routed to the atlas it samples the entire 2048px sheet and comes out as
 * the packing layout, which is the garble that was in the frame.
 *
 * `mirrorU` because the sheet's `u` grows toward the viewer's left: read off its corners,
 * where u=0 sits at z=+2.02 and the room is viewed from +X, so +Z is the viewer's right.
 * Without it the picture hangs back to front.
 */
const AUTHORED_NODE_IMAGE: Record<string, { url: string; mirrorU?: boolean }> = {
  "poster.002": { url: "/work/about-room/poster-art.jpg", mirrorU: true },
};

/** The same table, keyed the way the nodes actually arrive. */
export const BASE_NODE_IMAGE: Record<string, { url: string; mirrorU?: boolean }> =
  Object.fromEntries(
    Object.entries(AUTHORED_NODE_IMAGE).map(([name, spec]) => [sanitizeNodeName(name), spec]),
  );

/** The same table, keyed the way the nodes actually arrive. */
export const BASE_NODE_FLAT: Record<string, string> = Object.fromEntries(
  Object.entries(AUTHORED_NODE_FLAT).map(([name, colour]) => [sanitizeNodeName(name), colour]),
);

/** The same table, keyed the way the nodes actually arrive. */
export const BASE_NODE_ATLAS: Record<string, BaseAtlasId> = Object.fromEntries(
  Object.entries(AUTHORED_NODE_ATLAS).map(([name, atlas]) => [sanitizeNodeName(name), atlas]),
);

/**
 * Where the base sits in our room.
 *
 * The capture is authored at roughly 0.116 m per unit against our 0.273 m, and its
 * desk runs along Z against a wall at X≈1. A quarter turn puts that wall on our back
 * wall — the one the Guangzhou window is cut into — and lands the desk under it.
 */

/**
 * Where the base sits.
 *
 * Nowhere in particular: it is the whole room now, so it keeps the coordinates it was
 * authored in, and the camera in `room3d.ts` is framed to those. The hook stays because
 * moving the room is a one-line change if the framing ever needs it.
 */
export const BASE_TRANSFORM = {
  scale: 1,
  rotationY: 0,
  position: [0, 0, 0] as const,
};

/**
 * Per-atlas exposure trim.
 *
 * The bakes are finished images and mostly want to be shown as they are. These only
 * even out the ones baked darker than the rest, so the chair, the books and the records
 * read as objects rather than as holes.
 */
export const BASE_ATLAS_EXPOSURE: Record<BaseAtlasId, number> = {
  env: 1.0,
  group1: 1.0,
  group2: 1.35,
  group3: 1.0,
  books: 1.15,
  camera: 1.2,
  vinyl: 1.1,
};

/**
 * Hotspots, resolved against the capture's own nodes.
 *
 * Each entry is the set of meshes that light up and focus together for one About chip.
 * Every id here also has to exist in `ROOM_OBJECTS`, and nothing else does — the room
 * is the desk study alone, so an interest with no object in it has no chip.
 */
const AUTHORED_HOTSPOT_NODES: Partial<Record<RoomObjectId, string[]>> = {
  "crt-monitor": ["screen", "screen.001", "macbook", "Cube.008", "Cylinder", "Curve"],
  camera: ["camera", "film", "film.001"],
  bookshelf: [
    "bookshelf",
    "bookshelf.001",
    ...Array.from({ length: 10 }, (_, i) => `book${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `book${i + 1} outer`),
  ],
  /*
   * The deck is not the capture's any more. `roomPlatter.ts` hides the machine that came
   * in the file and `room3d.ts` stands `about-room-deck` in its place, under `model` and
   * so findable by name exactly like a captured node — which is the whole reason it goes
   * there rather than beside it. The captured meshes are deliberately absent from this
   * list: hidden geometry still answers a raycast, so naming them here would leave an
   * invisible machine catching every click meant for the real one.
   */
  "joi-music-box": ["about-room-deck", "headphones"],
  /*
   * The board and its face. The face is the drawable surface — a single quad whose
   * atlas island `room3d` reads at load so the drawing can be laid over the bake in
   * the right place and the right way up.
   */
  whiteboard: ["whiteboard", "whiteboard face"],
};

/** Same lists, sanitized to the names `getObjectByName` will actually see. */
export const BASE_HOTSPOT_NODES: Partial<Record<RoomObjectId, string[]>> = Object.fromEntries(
  Object.entries(AUTHORED_HOTSPOT_NODES).map(([id, names]) => [id, (names ?? []).map(sanitizeNodeName)]),
) as Partial<Record<RoomObjectId, string[]>>;
