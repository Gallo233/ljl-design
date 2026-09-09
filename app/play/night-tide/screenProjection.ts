import * as THREE from "three";

/**
 * Project a live DOM display with the exact WebGL camera matrix. The resulting CSS
 * homography maps local display pixels straight into canvas CSS pixels, avoiding a
 * second CSS perspective camera (and its browser-zoom / transform-origin offsets).
 */
export function createScreenProjection(width: number, height: number, y: number, z: number, pixelsWide: number) {
  const plane = new THREE.Matrix4().set(
    width / pixelsWide, 0, 0, -width / 2,
    0, -width / pixelsWide, 0, y + height / 2,
    0, 0, 1, z,
    0, 0, 0, 1,
  );
  const viewport = new THREE.Matrix4();
  const projected = new THREE.Matrix4();
  return (camera: any, modelWorld: any, viewportWidth: number, viewportHeight: number) => {
    viewport.set(
      viewportWidth / 2, 0, 0, viewportWidth / 2,
      0, -viewportHeight / 2, 0, viewportHeight / 2,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    projected.copy(viewport).multiply(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse).multiply(modelWorld).multiply(plane);
    const e = projected.elements;
    const denominator = e[15];
    // Flatten only output depth, preserving the perspective divide in the last row.
    // A nonzero Z column keeps the CSS matrix invertible and the element interactive.
    return `matrix3d(${e[0] / denominator},${e[1] / denominator},0,${e[3] / denominator},` +
      `${e[4] / denominator},${e[5] / denominator},0,${e[7] / denominator},` +
      `0,0,1,0,${e[12] / denominator},${e[13] / denominator},0,1)`;
  };
}
