import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * The handheld, as it appears on reel frame 03.
 *
 * A second, much smaller model of the same machine `play/night-tide/console3d.ts` builds
 * at full size. They are deliberately separate: this one is seen from one angle at the
 * size of a thumbnail and needs no screen, no cartridges and no interaction, so it is
 * built out of primitives rather than shared with a rig that carries all three.
 */
export function buildHandheldModel() {
  const group = new THREE.Group();
  const geometries: any[] = [];
  const materials: any[] = [];
  const pressables: Record<string, any> = {};

  const mesh = (geometry: any, material: any, name: string, position: [number, number, number]) => {
    geometries.push(geometry);
    materials.push(material);
    const item = new THREE.Mesh(geometry, material);
    item.name = name;
    item.position.set(...position);
    group.add(item);
    return item;
  };

  const rounded = (width: number, height: number, depth: number, radius: number) => (
    new RoundedBoxGeometry(width, height, depth, 5, radius)
  );
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x171c24,
    roughness: 0.34,
    metalness: 0.66,
    clearcoat: 0.38,
    clearcoatRoughness: 0.34,
  });
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x424b58,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.42,
  });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x0e131a, roughness: 0.54, metalness: 0.44 });
  const blueControllerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00bfe8,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 0.68,
    clearcoatRoughness: 0.2,
  });
  const redControllerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff4058,
    roughness: 0.3,
    metalness: 0.18,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
  });
  const blueFaceMaterial = new THREE.MeshStandardMaterial({ color: 0x049fc1, roughness: 0.48, metalness: 0.18 });
  const redFaceMaterial = new THREE.MeshStandardMaterial({ color: 0xd92e45, roughness: 0.48, metalness: 0.18 });
  const bezelMaterial = new THREE.MeshStandardMaterial({ color: 0x030609, roughness: 0.4, metalness: 0.45 });
  const controlMaterial = new THREE.MeshPhysicalMaterial({ color: 0x11151b, roughness: 0.5, metalness: 0.52, clearcoat: 0.18 });
  const controlTopMaterial = new THREE.MeshStandardMaterial({ color: 0x252d37, roughness: 0.6, metalness: 0.34 });
  const darkInsetMaterial = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.9, metalness: 0.08 });
  const cyanMaterial = new THREE.MeshStandardMaterial({ color: 0x7ce9ff, emissive: 0x1f99ba, emissiveIntensity: 1.8, roughness: 0.24 });
  const amberMaterial = new THREE.MeshStandardMaterial({ color: 0xffa15f, emissive: 0x8c2b0e, emissiveIntensity: 1.45, roughness: 0.3 });

  mesh(rounded(4.86, 3.18, 0.66, 0.2), bodyMaterial, "console-core", [0, 0, 0]);
  mesh(rounded(4.62, 2.96, 0.16, 0.16), faceMaterial, "console-face", [0, 0, 0.41]);
  mesh(rounded(1.22, 3.22, 0.68, 0.3), blueControllerMaterial, "left-controller", [-3.04, 0, 0.01]);
  mesh(rounded(1.22, 3.22, 0.68, 0.3), redControllerMaterial, "right-controller", [3.04, 0, 0.01]);
  mesh(rounded(1.06, 3.02, 0.15, 0.25), blueFaceMaterial, "left-controller-face", [-3.04, 0, 0.42]);
  mesh(rounded(1.06, 3.02, 0.15, 0.25), redFaceMaterial, "right-controller-face", [3.04, 0, 0.42]);
  mesh(rounded(0.12, 2.86, 0.72, 0.05), edgeMaterial, "left-rail", [-2.42, 0, 0.01]);
  mesh(rounded(0.12, 2.86, 0.72, 0.05), edgeMaterial, "right-rail", [2.42, 0, 0.01]);
  mesh(rounded(4.36, 2.58, 0.18, 0.18), bezelMaterial, "screen-bezel", [0, 0.08, 0.53]);
  mesh(rounded(4.12, 2.34, 0.08, 0.12), darkInsetMaterial, "screen-inset", [0, 0.08, 0.62]);

  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x000102 });
  mesh(new THREE.PlaneGeometry(4.02, 2.26), screenMaterial, "screen", [0, 0.08, 0.67]);
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0b141a,
    transparent: true,
    opacity: 0.035,
    roughness: 0.08,
    metalness: 0,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  mesh(new THREE.PlaneGeometry(4.04, 2.28), glassMaterial, "screen-glass", [0, 0.08, 0.685]);

  const leftShoulder = mesh(rounded(0.98, 0.26, 0.72, 0.12), controlMaterial, "left-shoulder", [-3.04, 1.63, -0.02]);
  const rightShoulder = mesh(rounded(0.98, 0.26, 0.72, 0.12), controlMaterial, "right-shoulder", [3.04, 1.63, -0.02]);
  leftShoulder.rotation.z = -0.018;
  rightShoulder.rotation.z = 0.018;

  const leftStickBase = mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.17, 36), darkInsetMaterial, "left-stick-base", [-3.04, 0.72, 0.63]);
  leftStickBase.rotation.x = Math.PI / 2;
  const leftStick = mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.2, 36), controlTopMaterial, "left-stick", [-3.04, 0.72, 0.76]);
  leftStick.rotation.x = Math.PI / 2;
  const rightStickBase = mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.17, 36), darkInsetMaterial, "right-stick-base", [3.04, -0.72, 0.63]);
  rightStickBase.rotation.x = Math.PI / 2;
  const rightStick = mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.2, 36), controlTopMaterial, "right-stick", [3.04, -0.72, 0.76]);
  rightStick.rotation.x = Math.PI / 2;

  const dpadHorizontal = mesh(rounded(0.86, 0.29, 0.2, 0.09), controlMaterial, "dpad-horizontal", [-3.04, -0.58, 0.68]);
  const dpadVertical = mesh(rounded(0.29, 0.86, 0.2, 0.09), controlMaterial, "dpad-vertical", [-3.04, -0.58, 0.69]);
  pressables.up = dpadVertical;
  pressables.down = dpadVertical;
  pressables.left = dpadHorizontal;
  pressables.right = dpadHorizontal;

  const faceButtons = [
    ["y", 3.04, 1.0],
    ["x", 2.72, 0.68],
    ["b", 3.36, 0.68],
    ["a", 3.04, 0.36],
  ] as const;
  faceButtons.forEach(([name, x, y]) => {
    const button = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.16, 32), controlTopMaterial, `button-${name}`, [x, y, 0.72]);
    button.rotation.x = Math.PI / 2;
    pressables[name] = button;
  });
  pressables.select = mesh(rounded(0.52, 0.17, 0.13, 0.08), controlMaterial, "select", [-0.34, -1.18, 0.66]);
  pressables.start = mesh(rounded(0.52, 0.17, 0.13, 0.08), controlMaterial, "start", [0.34, -1.18, 0.66]);

  const ventPositions = [-0.24, -0.08, 0.08, 0.24];
  for (const offset of ventPositions) {
    const leftVent = mesh(rounded(0.08, 0.34, 0.08, 0.035), darkInsetMaterial, "left-vent", [-1.6 + offset, -1.3, 0.65]);
    leftVent.rotation.z = -0.32;
    const rightVent = mesh(rounded(0.08, 0.34, 0.08, 0.035), darkInsetMaterial, "right-vent", [1.6 + offset, -1.3, 0.65]);
    rightVent.rotation.z = -0.32;
  }
  mesh(rounded(0.2, 0.06, 0.06, 0.03), cyanMaterial, "cyan-status", [-3.04, -1.3, 0.69]);
  mesh(rounded(0.2, 0.06, 0.06, 0.03), amberMaterial, "amber-status", [3.04, -1.3, 0.69]);

  for (const x of [-3.34, 3.34]) {
    for (const y of [-1.24, 1.24]) {
      const fastener = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), darkInsetMaterial, "fastener", [x, y, 0.55]);
      fastener.rotation.x = Math.PI / 2;
    }
  }

  group.rotation.order = "YXZ";
  return {
    group,
    pressables,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      new Set(materials).forEach((material: any) => material.dispose?.());
    },
  };
}

/**
 * The stage: one canvas, one WebGL context, every fullscreen scene on the page.
 *
 * It renders the hero terminal into slot A and the film reel into slot B, blends
 * them by the same reveal the CSS layers used to cross-fade on, and puts the result
 * through `postfx.ts` — one pane of glass over both worlds instead of two canvases
 * under a stack of CSS approximations.
 *
 * The About room keeps its own small context on purpose. It is a panel widget in a
 * box, not a fullscreen layer that cross-fades with anything, so folding it in here
 * would buy a scissor rectangle and no seam.
 */
