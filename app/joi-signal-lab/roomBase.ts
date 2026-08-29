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
 * The chair came into the original scene from a different source than the desk did and
 * kept its own texture UVs in slot 0; its bake was packed into slot 1. Sampling slot 0
 * paints the atlas's whole packing layout across the seat, which is unmistakable.
 */
const AUTHORED_NODE_UV: Record<string, 0 | 1> = {
  "top chair": 1,
  "top chair.002": 1,
};

export const BASE_NODE_UV: Record<string, 0 | 1> = Object.fromEntries(
  Object.entries(AUTHORED_NODE_UV).map(([name, channel]) => [sanitizeNodeName(name), channel]),
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
  poster: ["poster.001", "poster.002"],
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
};

/** Same lists, sanitized to the names `getObjectByName` will actually see. */
export const BASE_HOTSPOT_NODES: Partial<Record<RoomObjectId, string[]>> = Object.fromEntries(
  Object.entries(AUTHORED_HOTSPOT_NODES).map(([id, names]) => [id, (names ?? []).map(sanitizeNodeName)]),
) as Partial<Record<RoomObjectId, string[]>>;
