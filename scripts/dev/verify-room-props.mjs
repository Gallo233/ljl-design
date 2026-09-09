import fs from 'node:fs';
import assert from 'node:assert/strict';
const bytes=fs.readFileSync('public/models/about-room-props.glb');
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
for(const name of ['about-room-baseball','about-room-basketball','about-room-macbook'])assert(gltf.nodes.some(n=>n.name===name),`Missing ${name}`);
let triangles=0;for(const mesh of gltf.meshes)for(const p of mesh.primitives){
  triangles+=gltf.accessors[p.indices].count/3;
  assert(p.attributes.NORMAL!==undefined,'Missing geometric normals');
  assert(p.attributes.COLOR_0!==undefined,'Missing Blender baked contact AO');
}
// The higher-detail glove, separate basketball panels and 216 stitch legs use an
// explicit web budget; the prior coarse asset's 150k ceiling no longer fits them.
assert(bytes.length<1.5*1024*1024,'Room props exceed 1.5 MiB');
assert(triangles<280000,'Room props exceed triangle budget');
for(const name of ['basketball','baseball']) {
  const png=fs.readFileSync(`public/models/room-props/${name}-shadow.png`);
  assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
  assert.equal(png[25],6,'Shadow must retain RGBA transparency');
}
console.log(JSON.stringify({bytes:bytes.length,triangles,meshes:gltf.meshes.length,materials:gltf.materials.length,bakedAO:true,shadowMasks:2},null,2));
