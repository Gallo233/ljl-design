/** Verify the authored GLB's integration contract without a renderer or a dev server. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

const bytes = readFileSync(new URL("../../public/models/pocket-nt.glb", import.meta.url));
assert.equal(bytes.toString("utf8", 0, 4), "glTF");
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
assert(bytes.length < 1_000_000, "Keep the handheld download below 1 MB");
assert(gltf.extensionsRequired.includes("KHR_draco_mesh_compression"));
assert(!gltf.images?.length, "This material-only asset must not acquire external textures");
const nodes = new Map(gltf.nodes.map((node) => [node.name, node]));
const controls = ["up", "down", "left", "right", "x", "y", "a", "b", "select", "start", "l1", "l2", "r1", "r2"];
for (const id of controls) {
  const node = nodes.get(`control-${id}`);
  assert(node, `Missing articulated control: ${id}`);
  assert.equal(node.extras.button, id);
  assert(node.translation.every(Number.isFinite));
  // Web code animates the root's local Y/Z. Rotated/scaled control roots break that.
  assert(!node.rotation || Math.abs(node.rotation[3] - 1) < 1e-5);
  assert(!node.scale || node.scale.every((scale) => Math.abs(scale - 1) < 1e-5));
}

const screen = nodes.get("screen-aperture");
const bounds = new THREE.Box3();
for (const primitive of gltf.meshes[screen.mesh].primitives) {
  const accessor = gltf.accessors[primitive.attributes.POSITION];
  bounds.union(new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max)));
}
bounds.translate(new THREE.Vector3(...screen.translation));
const size = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
assert(Math.abs(size.x - 7.85) < .002);
assert(Math.abs(size.y - 7.85 * 9 / 16) < .002);
assert(Math.abs(center.x) < .001 && Math.abs(center.y - .3) < .001);
assert(bounds.max.z < .755 && .755 - bounds.max.z < .025, "DOM screen must sit just in front of the aperture");
assert(gltf.materials.some((material) => material.name === "Cartridge light"));
assert(nodes.has("cartridge-assembly"));
const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
const triangles = primitives.reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0);
assert(triangles < 200_000, "Keep the web mesh within its mobile geometry budget");
assert(primitives.length < 80, "Join static surfaces by assembly/material before export");
console.log(JSON.stringify({ bytes: bytes.length, triangles, primitives: primitives.length, controls: controls.length, screen: { size, center }, passed: true }, null, 2));
