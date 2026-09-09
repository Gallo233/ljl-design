import * as THREE from "three";
import { HANDHELD, loadHandheldAsset } from "../play/night-tide/handheldAsset";

/** Reel frame 03 uses the actual Blender machine at thumbnail scale. */
export function buildHandheldModel() {
  const group = new THREE.Group();
  group.rotation.order = "YXZ";
  // Preserve the reel's established camera; the asset is authored in game-room units.
  // If the asset fails, the drawn GAME CENTER display remains a readable reel frame.
  const model = loadHandheldAsset();
  model.group.scale.setScalar(0.47);
  group.add(model.group);

  // A drawn standby display; the game room replaces this with live CSS3D DOM.
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 432;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#eaf0e8";
  c.fillRect(0, 0, 768, 432);
  c.fillStyle = "#62766c";
  c.font = "500 18px ui-monospace, monospace";
  c.textAlign = "center";
  c.fillText("J O I  /  P O C K E T - N T", 384, 90);
  c.fillStyle = "#334c40";
  c.font = "500 64px ui-monospace, monospace";
  c.fillText("PRESS PLAY", 384, 222);
  c.fillStyle = "#84998b";
  c.font = "16px ui-monospace, monospace";
  c.fillText("5 CARTRIDGES  /  GAME CENTER", 384, 312);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(HANDHELD.screenWidth, HANDHELD.screenHeight);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const screen = new THREE.Mesh(geometry, material);
  screen.position.set(0, HANDHELD.screenY, HANDHELD.screenZ);
  // The screen has its own scale wrapper so asynchronous imported-node discovery
  // and disposal never mistake it for part of the glTF hierarchy.
  const display = new THREE.Group();
  display.scale.setScalar(0.47);
  display.add(screen);
  group.add(display);

  return {
    group,
    dispose() {
      model.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
