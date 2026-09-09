/** Verify the real Blender badge geometry and skill's material/plane contract.
 * Run after the project-local pipeline: node scripts/dev/verify-holo-badge.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const project = path.resolve(process.argv[3] ?? 'assets/3d/holo-badge-original');
const file = path.resolve(process.argv[2] ?? 'public/models/holo-badge-original.glb');
const data = fs.readFileSync(file);
assert.equal(data.toString('ascii', 0, 4), 'glTF', 'Actual GLB header');
assert.equal(data.readUInt32LE(4), 2);
const jsonLength = data.readUInt32LE(12);
const gltf = JSON.parse(data.toString('utf8', 20, 20 + jsonLength).trim());
const roles = new Set(gltf.materials.map(m => m.name));
for (const role of ['web_front', 'web_edge', 'web_back', 'web_gold']) assert(roles.has(role), `Missing ${role}`);
assert(gltf.meshes.length >= 3, 'Must export physical core plus separate edge geometry');
let positions = 0, triangles = 0;
const extrema = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  const p = gltf.accessors[primitive.attributes.POSITION];
  positions += p.count;
  triangles += gltf.accessors[primitive.indices].count / 3;
  assert(p.count > 2);
  if (gltf.materials[primitive.material].name === 'web_front') {
    for (let k = 0; k < 3; k++) { extrema[k] = Math.min(extrema[k], p.min[k]); extrema[k + 3] = Math.max(extrema[k + 3], p.max[k]); }
  }
}
assert(positions > 400, 'Rounded, die-cut mesh should not be a four-vertex screenshot plane');
assert(triangles > 400);
const dims = extrema.slice(3).map((v, k) => v - extrema[k]).sort((a, b) => a - b);
assert(Math.abs(dims[1] - 6.3) < .02);
assert(Math.abs(dims[2] - 6.3 * 268 / 190) < .02);
const blend = JSON.parse(fs.readFileSync(path.join(project, 'verification.json'), 'utf8'));
for (const [name, plane] of Object.entries(blend.planes)) {
  assert.deepEqual(plane.rotation_degrees, [90, 0, 0], `${name}: keep X=90 unapplied`);
}
for (const [name, image] of Object.entries(blend.images)) assert(image.packed, `${name} not packed`);
assert.equal(blend.parameters['主体缩放'], 1.25);
assert.equal(blend.parameters['主体深度'], .4);
assert.equal(blend.parameters['背景深度'], -.25);
assert(blend.throughSlot?.centerOpen, 'Hanging slot must pass through the solid card');
assert(blend.throughSlot?.faceSolid, 'Card face must remain a real mesh around slot');
assert(blend.compositor?.connected, 'High quality glare must feed the compositor output');
assert.equal(blend.subjectEmissionBlack, true);
assert.equal(blend.materialHasSubjectAlphaMix, true);
const report = { file, bytes: data.length, meshes: gltf.meshes.length, positions, triangles, roles: [...roles], dimensions: dims, throughSlot: blend.throughSlot };
console.log(JSON.stringify(report, null, 2));
