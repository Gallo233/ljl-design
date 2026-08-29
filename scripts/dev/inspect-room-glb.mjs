import * as THREE from "three";
import { readFileSync } from "node:fs";

/**
 * Dump the capture's real node transforms by parsing the GLB's JSON chunk directly —
 * no Draco decoding needed, because node TRS data is plain JSON. Feeds prop
 * placement and orbit framing with numbers instead of guesses.
 */

const glb = readFileSync("public/models/about-room-base.glb");
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));

const sanitize = (name) => (name ?? "").replace(/\s/g, "_").replace(/[[\].:/]/g, "");

// Node index → world matrix, walking the scene graph from its roots.
const world = new Map();
const scratch = {
  t: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  s: new THREE.Vector3(),
  m: new THREE.Matrix4(),
  parent: new THREE.Matrix4(),
};

const walk = (index, parentMatrix) => {
  const node = json.nodes[index];
  scratch.t.fromArray(node.translation ?? [0, 0, 0]);
  scratch.q.fromArray(node.rotation ?? [0, 0, 0, 1]);
  scratch.s.fromArray(node.scale ?? [1, 1, 1]);
  scratch.m.compose(scratch.t, scratch.q, scratch.s);
  const matrix = new THREE.Matrix4().multiplyMatrices(parentMatrix, scratch.m);
  world.set(index, { node, matrix });
  for (const child of node.children ?? []) walk(child, matrix);
};
for (const root of json.scenes[json.scene ?? 0].nodes) walk(root, new THREE.Matrix4());

const positionOf = (index) => {
  const entry = world.get(index);
  if (!entry) return null;
  return new THREE.Vector3().setFromMatrixPosition(entry.matrix);
};

const wanted = [
  "top chair", "top chair.002", "bottom chair",
  "macbook", "screen", "screen.001", "Cube.008", "Cylinder", "Curve",
  "desk lamp", "desk lamp.001", "Lamphead_Circle.007", "Lamp_stand_Circle.006",
  "camera", "film", "film.001",
  "bookshelf", "bookshelf.001",
  "poster.001", "poster.002",
  "turntable body 1", "headphones",
  "guitar", "whiteboard", "whiteboard face", "pen",
  ...Array.from({ length: 10 }, (_, i) => `book${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `book${i + 1} outer`),
];

// name → node indices (names are unique here, but stay safe)
const byName = new Map();
for (const [index, entry] of world) {
  const key = sanitize(entry.node.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(index);
}

const lines = [];
for (const name of wanted) {
  const indices = byName.get(sanitize(name));
  if (!indices) {
    lines.push(`MISSING  ${name}`);
    continue;
  }
  const parts = indices.map((index) => {
    const p = positionOf(index);
    return p ? `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})` : "(?)";
  });
  const node = world.get(indices[0]).node;
  lines.push(
    `${name.padEnd(24)} ${parts.join(" ")}${node.mesh !== undefined ? `  [mesh:${node.mesh}]` : ""}`,
  );
}

// Meshes the books/screens use, for node→mesh sanity.
lines.push(`meshes=${json.meshes.length}, nodes=${json.nodes.length}`);

console.log(lines.join("\n"));
