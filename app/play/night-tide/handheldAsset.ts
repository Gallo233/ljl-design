import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { GameButton } from "./games";

/** Socket coordinates shared with scripts/blender/build_handheld.py (glTF Y-up). */
export const HANDHELD = {
  url: "/models/pocket-nt.glb",
  width: 13.91,
  height: 13.91 / 1.82,
  depth: 1.25,
  screenWidth: 7.85,
  screenHeight: 7.85 * 9 / 16,
  screenY: 0.3,
  screenZ: 0.755,
} as const;

const BUTTONS: GameButton[] = [
  "up", "down", "left", "right", "x", "y", "a", "b",
  "select", "start", "l1", "l2", "r1", "r2",
];

export type HandheldAsset = {
  nodes: Record<string, any>;
  controls: Array<{ mesh: any; id: GameButton; restZ: number; axis: "z" | "y" }>;
  cartridgeLight: any;
  triangles: number;
  meshes: number;
};

function disposeTree(root: any) {
  const geometries = new Set<any>();
  const materials = new Set<any>();
  root.traverse((object: any) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material])
      .forEach((material: any) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

/** A fresh instance per renderer: no shared materials that another view can dispose. */
export function loadHandheldAsset(options: {
  onReady?: (asset: HandheldAsset) => void;
  onError?: () => void;
} = {}) {
  const group = new THREE.Group();
  group.name = "pocket-nt-blender";
  let disposed = false;
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const fail = () => {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(timeout);
    draco.dispose();
    disposeTree(group);
    group.clear();
    options.onError?.();
  };
  // A stalled download must hand control back to the existing playable flat screen.
  const timeout = window.setTimeout(fail, 20_000);
  loader.load(HANDHELD.url, (gltf: any) => {
    window.clearTimeout(timeout);
    if (disposed) {
      disposeTree(gltf.scene);
      return;
    }
    const nodes: Record<string, any> = {};
    const cartridgeMaterials = new Set<any>();
    let triangles = 0;
    let meshes = 0;
    gltf.scene.traverse((object: any) => {
      nodes[object.name] = object;
      if (!object.isMesh) return;
      meshes += 1;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material: any) => {
        material.envMapIntensity = 0.65;
        if (material.name === "Cartridge light") cartridgeMaterials.add(material);
      });
    });
    // Validate before exposing any partial machine to the caller.
    if (!nodes["screen-aperture"] || BUTTONS.some((id) => !nodes[`control-${id}`])) {
      disposeTree(gltf.scene);
      fail();
      return;
    }
    const controls = BUTTONS.map((id) => {
      const mesh = nodes[`control-${id}`];
      const axis = ["l1", "l2", "r1", "r2"].includes(id) ? "y" as const : "z" as const;
      // Multi-material glTF controls contain child meshes. Picking any child must
      // resolve to the same button; the entire cap and its lettering move together.
      mesh.traverse((part: any) => { part.userData.button = id; });
      return { mesh, id, axis, restZ: mesh.position[axis] };
    });
    // The DOM/game texture owns display pixels; the asset only defines the opening.
    nodes["screen-aperture"].visible = false;
    group.add(gltf.scene);
    draco.dispose();
    options.onReady?.({ nodes, controls, cartridgeLight: [...cartridgeMaterials][0], triangles, meshes });
  }, undefined, fail);
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(timeout);
      draco.dispose();
      disposeTree(group);
      group.clear();
    },
  };
}
