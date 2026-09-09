import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as THREE from "three";

// Exercise the actual TypeScript helper without adding a test runner or emitting files.
const source = readFileSync(new URL("../../app/play/night-tide/screenProjection.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
  .outputText.replace('from "three"', `from "${import.meta.resolve("three")}"`);
const { createScreenProjection } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const width = 7.85, height = width * 9 / 16;
const project = createScreenProjection(width, height, .3, .755, 800);
let samples = 0, maxError = 0;
for (const [vw, vh] of [[339, 300], [1142.140625, 532.796875], [1760, 760]]) {
  const camera = new THREE.PerspectiveCamera(26, vw / vh, .1, 200);
  camera.position.set(2.4138, 1.1, Math.max(22, 13 / Math.tan(13 * Math.PI / 180) / camera.aspect));
  camera.lookAt(2.4138, -.15, 0); camera.updateMatrixWorld();
  for (const [rx, ry] of [[0, 0], [-.035, .055], [.035, -.055]]) {
    const model = new THREE.Object3D(); model.rotation.set(rx, ry, 0); model.updateMatrixWorld();
    const css = project(camera, model.matrixWorld, vw, vh);
    const matrix = new THREE.Matrix4().fromArray(css.slice(9, -1).split(",").map(Number));
    assert(Math.abs(matrix.determinant()) > 1e-10, "DOM transform must remain invertible for iframe input");
    for (const zoom of [.8, 1, 1.25, 1.5, 2]) {
      for (const [px, py] of [[0, 0], [800, 0], [800, 450], [0, 450], [400, 225]]) {
        const actual = new THREE.Vector3(px, py, 0).applyMatrix4(matrix);
        const ndc = new THREE.Vector3(-width / 2 + px * width / 800, .3 + height / 2 - py * width / 800, .755)
          .applyMatrix4(model.matrixWorld).project(camera);
        const error = Math.hypot((actual.x - (ndc.x + 1) * vw / 2) * zoom, (actual.y - (1 - ndc.y) * vh / 2) * zoom);
        maxError = Math.max(maxError, error);
        assert(error < 1e-8, `Projection mismatch: ${error}px`);
        samples += 1;
      }
    }
  }
}
console.log(JSON.stringify({ samples, maxError, passed: true }, null, 2));
