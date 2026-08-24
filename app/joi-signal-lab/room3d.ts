import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RoomObjectId } from "./roomObjects";

/**
 * The room — a cartoon night-time desk corner, built the way `console3d.ts` builds the
 * handheld: primitives, canvas-drawn textures, no external assets except the two wall
 * prints (real photos already in `public/media/`).
 *
 * One build, two consumers:
 * - the film reel renders it into frame 05's 768×576 target with `frameCamera`;
 * - the About panel mounts an interactive instance with `fullCamera`, raycasting
 *   against the objects registered in `roomObjects.ts`.
 *
 * No renderer lives here. Consumers bring their own (`renderer.render(scene, camera)`),
 * which is what lets the future single-renderer merge absorb this scene unchanged.
 *
 * The face rule: nothing in this scene depicts the author. The room is the field;
 * the person is on the About panel next to it.
 */

export type RoomScene = {
  scene: any;
  frameCamera: any;
  fullCamera: any;
  setFullAspect: (aspect: number) => void;
  /** Advance idle motion (cat tail, cursor blink, lamp breath, camera drift). */
  update: (timeMs: number, pointer?: { x: number; y: number }) => void;
  /** Which object sits under this NDC point, seen through `fullCamera`. */
  raycastAt: (ndc: { x: number; y: number }) => RoomObjectId | null;
  setHover: (id: RoomObjectId | null) => void;
  /** Dolly the full camera's attention toward one object (null to release). */
  focus: (id: RoomObjectId | null) => void;
  dispose: () => void;
};

const PALETTE = {
  wallBack: "#262638",
  wallSide: "#211f31",
  floor: "#1d1a2b",
  rug: "#322a4a",
  wood: "#8a6a52",
  woodDark: "#6d523f",
  plastic: "#e8e2d6",
  coral: "#ee795c",
  blue: "#5b8ebe",
  sage: "#9fbf9a",
  cream: "#f1dfda",
  dark: "#33323f",
  cat: "#4d4c5c",
};

export function createRoomScene(): RoomScene {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#141225");

  // Three-step toon ramp: the whole room shades in flat pools, which is what reads
  // "cartoon" against the CRT world's continuous gradients.
  const ramp = new THREE.DataTexture(
    new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]),
    3,
    1,
  );
  ramp.needsUpdate = true;
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;

  const materials: any[] = [];
  const geometries: any[] = [];
  const textures: any[] = [ramp];

  const toon = (color: string) => {
    const material = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    materials.push(material);
    return material;
  };
  const keep = <T,>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  // ── lights: one warm pool (lamp), one cool wash (window), a floor of ambient ──
  scene.add(new THREE.AmbientLight(0x8d95c9, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb8e8, 0.75);
  moon.position.set(3.2, 4.6, 2.4);
  scene.add(moon);
  const lampLight = new THREE.PointLight(0xffb45e, 14, 7.5, 2);
  lampLight.position.set(-1.62, 2.35, -0.95);
  scene.add(lampLight);
  const screenLight = new THREE.PointLight(0x6fd8e0, 3.2, 3.4, 2);
  screenLight.position.set(-1.05, 1.95, -0.7);
  scene.add(screenLight);

  // ── shell: floor, two walls, rug ──────────────────────────────────────────
  const shell = new THREE.Group();
  scene.add(shell);

  const floor = new THREE.Mesh(keep(new THREE.BoxGeometry(7.4, 0.18, 5.4)), toon(PALETTE.floor));
  floor.position.set(0.6, -0.09, 0.1);
  shell.add(floor);

  const backWall = new THREE.Mesh(keep(new THREE.BoxGeometry(7.4, 4.4, 0.16)), toon(PALETTE.wallBack));
  backWall.position.set(0.6, 2.2, -2.28);
  shell.add(backWall);

  const sideWall = new THREE.Mesh(keep(new THREE.BoxGeometry(0.16, 4.4, 5.4)), toon(PALETTE.wallSide));
  sideWall.position.set(-3.08, 2.2, 0.1);
  shell.add(sideWall);

  const rug = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.7, 1.7, 0.04, 40)), toon(PALETTE.rug));
  rug.position.set(0.7, 0.02, 0.35);
  shell.add(rug);

  // ── desk ──────────────────────────────────────────────────────────────────
  const desk = new THREE.Group();
  scene.add(desk);
  const deskTop = new THREE.Mesh(keep(new RoundedBoxGeometry(3.8, 0.14, 1.5, 3, 0.05)), toon(PALETTE.wood));
  deskTop.position.set(-0.6, 1.46, -1.32);
  desk.add(deskTop);
  for (const [lx, lz] of [[-2.3, -0.78], [-2.3, -1.86], [1.1, -0.78], [1.1, -1.86]] as const) {
    const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.05, 1.4, 14)), toon(PALETTE.woodDark));
    leg.position.set(lx, 0.7, lz);
    desk.add(leg);
  }

  // ── chair, back to the reader — somebody just stepped away ────────────────
  const chair = new THREE.Group();
  const chairSeat = new THREE.Mesh(keep(new RoundedBoxGeometry(0.8, 0.12, 0.74, 3, 0.06)), toon(PALETTE.coral));
  chairSeat.position.y = 0.82;
  const chairBack = new THREE.Mesh(keep(new RoundedBoxGeometry(0.74, 0.9, 0.1, 3, 0.05)), toon(PALETTE.coral));
  chairBack.position.set(0, 1.34, 0.35);
  chairBack.rotation.x = 0.1;
  const chairPole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12)), toon(PALETTE.dark));
  chairPole.position.y = 0.55;
  const chairFoot = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.34, 0.38, 0.07, 20)), toon(PALETTE.dark));
  chairFoot.position.y = 0.28;
  chair.add(chairSeat, chairBack, chairPole, chairFoot);
  chair.position.set(0.05, 0, -0.35);
  chair.rotation.y = -0.4;
  scene.add(chair);

  /* ── pickable objects ──────────────────────────────────────────────────────
   * Each object is one Group tagged with its id; the registry in roomObjects.ts is
   * the contract. Hover lifts the group; focus dollies the full camera toward it.
   */
  const pickables = new Map<RoomObjectId, { group: any; home: any; lift: number }>();
  const registerPick = (id: RoomObjectId, group: any, lift = 0.07) => {
    group.traverse((node: any) => { node.userData.roomObject = id; });
    pickables.set(id, { group, home: group.position.clone(), lift });
    scene.add(group);
  };

  // CRT monitor — the JOI9000's little cousin, screen drawn on canvas.
  const crt = new THREE.Group();
  const crtBody = new THREE.Mesh(keep(new RoundedBoxGeometry(1.06, 0.84, 0.72, 4, 0.08)), toon(PALETTE.plastic));
  crtBody.position.y = 0.52;
  const crtFoot = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 20)), toon(PALETTE.plastic));
  crtFoot.position.y = 0.06;
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 128;
  screenCanvas.height = 96;
  const screenContext = screenCanvas.getContext("2d")!;
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.magFilter = THREE.NearestFilter;
  textures.push(screenTexture);
  const drawScreen = (cursorOn: boolean) => {
    screenContext.fillStyle = "#0b2430";
    screenContext.fillRect(0, 0, 128, 96);
    screenContext.fillStyle = "#134a54";
    for (let y = 0; y < 96; y += 4) screenContext.fillRect(0, y, 128, 1);
    screenContext.fillStyle = "#6fd8e0";
    screenContext.font = "600 13px monospace";
    screenContext.fillText("JOI9000", 10, 22);
    screenContext.fillStyle = "#3f8f9a";
    screenContext.fillRect(10, 34, 74, 5);
    screenContext.fillRect(10, 46, 52, 5);
    screenContext.fillRect(10, 58, 88, 5);
    if (cursorOn) {
      screenContext.fillStyle = "#ee795c";
      screenContext.fillRect(10, 72, 12, 9);
    }
    screenTexture.needsUpdate = true;
  };
  drawScreen(true);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  materials.push(screenMaterial);
  const crtScreen = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.8, 0.6)), screenMaterial);
  crtScreen.position.set(0, 0.54, 0.37);
  crt.add(crtBody, crtFoot, crtScreen);
  crt.position.set(-1.06, 1.53, -1.5);
  crt.rotation.y = 0.16;
  registerPick("crt-monitor", crt);

  // Tablet + pen, flat on the desk where a hand left them.
  const tablet = new THREE.Group();
  const tabletBody = new THREE.Mesh(keep(new RoundedBoxGeometry(0.74, 0.035, 0.52, 3, 0.015)), toon(PALETTE.dark));
  const tabletFace = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.64, 0.42)), toon("#cfd8e8"));
  tabletFace.rotation.x = -Math.PI / 2;
  tabletFace.position.y = 0.022;
  const pen = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 10)), toon(PALETTE.cream));
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.position.set(0.24, 0.03, 0.32);
  tablet.add(tabletBody, tabletFace, pen);
  tablet.position.set(0.16, 1.55, -1.14);
  tablet.rotation.y = -0.22;
  registerPick("tablet-pen", tablet, 0.05);

  // The handheld's cameo — a toy-scale echo of /play/night-tide.
  const handheld = new THREE.Group();
  const handheldBody = new THREE.Mesh(keep(new RoundedBoxGeometry(0.5, 0.24, 0.06, 3, 0.03)), toon(PALETTE.plastic));
  const handheldScreen = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.26, 0.16)), toon("#0f3c46"));
  handheldScreen.position.z = 0.035;
  const handheldKeyA = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10)), toon(PALETTE.coral));
  handheldKeyA.rotation.x = Math.PI / 2;
  handheldKeyA.position.set(0.18, 0.03, 0.035);
  const handheldKeyB = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10)), toon(PALETTE.sage));
  handheldKeyB.rotation.x = Math.PI / 2;
  handheldKeyB.position.set(0.13, -0.04, 0.035);
  handheld.add(handheldBody, handheldScreen, handheldKeyA, handheldKeyB);
  handheld.position.set(0.98, 1.58, -1.35);
  handheld.rotation.set(-1.1, 0.35, 0.1);
  registerPick("handheld", handheld, 0.05);

  // Headphones on a stand at the desk's end.
  const phones = new THREE.Group();
  const phonesPole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 12)), toon(PALETTE.dark));
  phonesPole.position.y = 0.3;
  const phonesFoot = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 18)), toon(PALETTE.dark));
  phonesFoot.position.y = 0.025;
  const band = new THREE.Mesh(keep(new THREE.TorusGeometry(0.21, 0.035, 12, 28, Math.PI)), toon(PALETTE.coral));
  band.position.y = 0.62;
  const cupLeft = new THREE.Mesh(keep(new THREE.SphereGeometry(0.085, 18, 14)), toon(PALETTE.coral));
  cupLeft.scale.set(1, 1.2, 0.7);
  cupLeft.position.set(-0.21, 0.6, 0);
  const cupRight = cupLeft.clone();
  cupRight.position.x = 0.21;
  phones.add(phonesPole, phonesFoot, band, cupLeft, cupRight);
  phones.position.set(-2.06, 1.53, -1.12);
  phones.rotation.y = 0.5;
  registerPick("headphones", phones);

  // Camera on the wall shelf.
  const shelf = new THREE.Mesh(keep(new RoundedBoxGeometry(1.7, 0.08, 0.5, 3, 0.03)), toon(PALETTE.woodDark));
  shelf.position.set(1.55, 2.86, -2.0);
  scene.add(shelf);
  const cameraBody = new THREE.Group();
  const camBox = new THREE.Mesh(keep(new RoundedBoxGeometry(0.36, 0.24, 0.2, 3, 0.04)), toon(PALETTE.dark));
  const camLens = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.085, 0.095, 0.14, 20)), toon(PALETTE.cream));
  camLens.rotation.x = Math.PI / 2;
  camLens.position.z = 0.16;
  const camDial = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12)), toon(PALETTE.coral));
  camDial.position.set(0.12, 0.145, 0);
  cameraBody.add(camBox, camLens, camDial);
  cameraBody.position.set(1.32, 3.02, -1.98);
  cameraBody.rotation.y = -0.5;
  registerPick("camera", cameraBody, 0.05);

  // The cat, on the rug, tail live.
  const cat = new THREE.Group();
  const catBody = new THREE.Mesh(keep(new THREE.SphereGeometry(0.34, 20, 16)), toon(PALETTE.cat));
  catBody.scale.set(1, 0.82, 0.78);
  catBody.position.y = 0.28;
  const catHead = new THREE.Mesh(keep(new THREE.SphereGeometry(0.19, 18, 14)), toon(PALETTE.cat));
  catHead.position.set(0, 0.62, 0.14);
  const earGeometry = keep(new THREE.ConeGeometry(0.07, 0.12, 4));
  const earLeft = new THREE.Mesh(earGeometry, toon(PALETTE.cat));
  earLeft.position.set(-0.1, 0.78, 0.12);
  earLeft.rotation.z = 0.2;
  const earRight = new THREE.Mesh(earGeometry, toon(PALETTE.cat));
  earRight.position.set(0.1, 0.78, 0.12);
  earRight.rotation.z = -0.2;
  const chest = new THREE.Mesh(keep(new THREE.SphereGeometry(0.15, 14, 12)), toon(PALETTE.cream));
  chest.scale.set(0.8, 1, 0.6);
  chest.position.set(0, 0.34, 0.2);
  const tail = new THREE.Mesh(keep(new THREE.TorusGeometry(0.22, 0.045, 10, 20, Math.PI * 0.85)), toon(PALETTE.cat));
  tail.position.set(0.26, 0.26, -0.16);
  tail.rotation.set(0.4, 0.6, 1.2);
  cat.add(catBody, catHead, earLeft, earRight, chest, tail);
  cat.position.set(1.65, 0.04, 0.45);
  cat.rotation.y = -0.7;
  registerPick("cat-figure", cat, 0.06);

  // Books, stacked with the casual misalignment of actually-read books.
  const books = new THREE.Group();
  const spines = [PALETTE.coral, PALETTE.blue, PALETTE.cream, PALETTE.sage];
  spines.forEach((spine, index) => {
    const book = new THREE.Mesh(keep(new RoundedBoxGeometry(0.52 - index * 0.03, 0.075, 0.38, 2, 0.02)), toon(spine));
    book.position.y = 0.04 + index * 0.078;
    book.rotation.y = (index % 2 === 0 ? 1 : -1) * (0.1 + index * 0.06);
    books.add(book);
  });
  books.position.set(-2.62, 1.53, -1.62);
  registerPick("bookstack", books, 0.05);

  // The window — Guangzhou at night, tower and all, drawn once.
  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = 256;
  nightCanvas.height = 320;
  {
    const c = nightCanvas.getContext("2d")!;
    const sky = c.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, "#0c1230");
    sky.addColorStop(0.7, "#1b2248");
    sky.addColorStop(1, "#33254e");
    c.fillStyle = sky;
    c.fillRect(0, 0, 256, 320);
    // moon
    c.fillStyle = "#e8ecf8";
    c.beginPath();
    c.arc(200, 52, 17, 0, Math.PI * 2);
    c.fill();
    // skyline blocks
    for (let i = 0; i < 12; i += 1) {
      const bw = 18 + ((i * 37) % 22);
      const bh = 50 + ((i * 53) % 90);
      const bx = i * 21;
      c.fillStyle = "#121a38";
      c.fillRect(bx, 320 - bh, bw, bh);
      c.fillStyle = "rgba(255, 196, 120, 0.85)";
      for (let w = 0; w < 6; w += 1) {
        if ((i * 7 + w * 3) % 4 === 0) c.fillRect(bx + 4 + (w % 3) * 6, 320 - bh + 8 + Math.floor(w / 3) * 14, 3, 5);
      }
    }
    // 小蛮腰 — the Canton Tower silhouette with its waist.
    c.strokeStyle = "#ee795c";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(74, 320);
    c.quadraticCurveTo(88, 200, 79, 150);
    c.moveTo(94, 320);
    c.quadraticCurveTo(80, 200, 87, 150);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(83, 150);
    c.lineTo(83, 116);
    c.stroke();
    c.fillStyle = "rgba(238, 121, 92, 0.5)";
    c.beginPath();
    c.ellipse(83, 152, 8, 4, 0, 0, Math.PI * 2);
    c.fill();
  }
  const nightTexture = new THREE.CanvasTexture(nightCanvas);
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  textures.push(nightTexture);
  const windowGroup = new THREE.Group();
  const nightMaterial = new THREE.MeshBasicMaterial({ map: nightTexture });
  materials.push(nightMaterial);
  const windowGlass = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.5, 1.9)), nightMaterial);
  const windowFrame = new THREE.Mesh(keep(new RoundedBoxGeometry(1.7, 2.1, 0.1, 2, 0.03)), toon(PALETTE.plastic));
  windowFrame.position.z = -0.04;
  const mullionV = new THREE.Mesh(keep(new THREE.BoxGeometry(0.05, 1.9, 0.05)), toon(PALETTE.plastic));
  mullionV.position.z = 0.02;
  const mullionH = new THREE.Mesh(keep(new THREE.BoxGeometry(1.5, 0.05, 0.05)), toon(PALETTE.plastic));
  mullionH.position.set(0, 0.32, 0.02);
  windowGroup.add(windowFrame, windowGlass, mullionV, mullionH);
  windowGroup.position.set(2.6, 2.6, -2.17);
  registerPick("window", windowGroup, 0);

  // ── wall prints: the two real photos, framed ──────────────────────────────
  const printLoader = new THREE.TextureLoader();
  const addPrint = (src: string, x: number, y: number, w: number, h: number, tilt: number) => {
    const frameMesh = new THREE.Mesh(keep(new RoundedBoxGeometry(w + 0.1, h + 0.1, 0.05, 2, 0.02)), toon(PALETTE.cream));
    frameMesh.position.set(x, y, -2.17);
    frameMesh.rotation.z = tilt;
    scene.add(frameMesh);
    const printTexture = printLoader.load(src);
    printTexture.colorSpace = THREE.SRGBColorSpace;
    textures.push(printTexture);
    const printMaterial = new THREE.MeshBasicMaterial({ map: printTexture });
    materials.push(printMaterial);
    const photo = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), printMaterial);
    photo.position.set(x, y, -2.135);
    photo.rotation.z = tilt;
    scene.add(photo);
  };
  addPrint("/media/gallo-mountain.jpg", -1.3, 3.15, 0.72, 0.5, 0.02);
  addPrint("/media/cat-observation.jpg", -0.42, 3.05, 0.5, 0.62, -0.03);

  // ── desk lamp (not pickable — it is lighting, not an interest) ────────────
  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.14, 0.17, 0.06, 18)), toon(PALETTE.dark));
  const lampArmA = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10)), toon(PALETTE.dark));
  lampArmA.position.set(0.08, 0.3, 0);
  lampArmA.rotation.z = -0.3;
  const lampArmB = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 10)), toon(PALETTE.dark));
  lampArmB.position.set(0.34, 0.68, 0);
  lampArmB.rotation.z = 0.85;
  const lampShade = new THREE.Mesh(keep(new THREE.ConeGeometry(0.17, 0.22, 20, 1, true)), toon(PALETTE.coral));
  lampShade.position.set(0.56, 0.78, 0);
  lampShade.rotation.z = 0.6;
  lamp.add(lampBase, lampArmA, lampArmB, lampShade);
  lamp.position.set(-2.25, 1.53, -1.7);
  scene.add(lamp);

  // ── cameras ───────────────────────────────────────────────────────────────
  const frameCamera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 40);
  frameCamera.position.set(2.7, 3.1, 4.9);
  frameCamera.lookAt(-0.3, 1.35, -1.0);

  const fullCamera = new THREE.PerspectiveCamera(32, 4 / 3, 0.1, 40);
  const FULL_HOME = new THREE.Vector3(2.35, 2.75, 4.45);
  const FULL_LOOK = new THREE.Vector3(-0.25, 1.3, -0.9);
  fullCamera.position.copy(FULL_HOME);
  fullCamera.lookAt(FULL_LOOK);

  // ── interaction state ─────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndcVector = new THREE.Vector2();
  let hovered: RoomObjectId | null = null;
  let focused: RoomObjectId | null = null;
  const focusPoint = new THREE.Vector3();
  let focusAmount = 0;
  const lookCurrent = FULL_LOOK.clone();
  const worldCenter = new THREE.Vector3();

  let lastBlink = 0;
  let cursorOn = true;

  const update = (timeMs: number, pointer?: { x: number; y: number }) => {
    const t = timeMs * 0.001;

    if (!reducedMotion) {
      // The frame camera breathes — the establishing shot is alive, not a still.
      frameCamera.position.x = 2.7 + Math.sin(t * 0.24) * 0.16;
      frameCamera.position.y = 3.1 + Math.sin(t * 0.31) * 0.08;
      frameCamera.lookAt(-0.3, 1.35, -1.0);
      // Cat tail; lamp breath.
      tail.rotation.y = 0.6 + Math.sin(t * 1.8) * 0.35;
      lampLight.intensity = 14 + Math.sin(t * 2.3) * 0.7;
    }

    // Cursor blink is state, not decoration — it runs under reduced motion too,
    // just slower.
    const blinkPeriod = reducedMotion ? 1600 : 640;
    if (timeMs - lastBlink > blinkPeriod) {
      lastBlink = timeMs;
      cursorOn = !cursorOn;
      drawScreen(cursorOn);
    }

    // Hover lift.
    pickables.forEach((entry, id) => {
      const targetY = entry.home.y + (hovered === id ? entry.lift : 0);
      entry.group.position.y += (targetY - entry.group.position.y) * 0.18;
      const targetScale = hovered === id ? 1.05 : 1;
      entry.group.scale.x += (targetScale - entry.group.scale.x) * 0.18;
      entry.group.scale.y += (targetScale - entry.group.scale.y) * 0.18;
      entry.group.scale.z += (targetScale - entry.group.scale.z) * 0.18;
    });

    // Full camera: pointer parallax + focus dolly.
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;
    const focusTargetAmount = focused ? 1 : 0;
    focusAmount += (focusTargetAmount - focusAmount) * (reducedMotion ? 1 : 0.08);
    const lookTarget = focused ? focusPoint : FULL_LOOK;
    lookCurrent.lerp(lookTarget, reducedMotion ? 1 : 0.09);
    fullCamera.position.x = FULL_HOME.x + px * 0.28 - focusAmount * (FULL_HOME.x - lookCurrent.x) * 0.22;
    fullCamera.position.y = FULL_HOME.y + py * 0.18 - focusAmount * (FULL_HOME.y - lookCurrent.y) * 0.22;
    fullCamera.position.z = FULL_HOME.z - focusAmount * (FULL_HOME.z - lookCurrent.z) * 0.22;
    fullCamera.lookAt(lookCurrent);
  };

  return {
    scene,
    frameCamera,
    fullCamera,
    setFullAspect: (aspect: number) => {
      fullCamera.aspect = aspect;
      fullCamera.updateProjectionMatrix();
    },
    update,
    raycastAt: (ndc) => {
      ndcVector.set(ndc.x, ndc.y);
      raycaster.setFromCamera(ndcVector, fullCamera);
      const hits = raycaster.intersectObjects(
        [...pickables.values()].map((entry) => entry.group),
        true,
      );
      return (hits[0]?.object?.userData?.roomObject as RoomObjectId) ?? null;
    },
    setHover: (id) => { hovered = id; },
    focus: (id) => {
      focused = id;
      if (id) {
        const entry = pickables.get(id);
        if (entry) {
          entry.group.getWorldPosition(worldCenter);
          focusPoint.copy(worldCenter);
        }
      }
    },
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      new Set(materials).forEach((material: any) => material.dispose?.());
      textures.forEach((texture) => texture.dispose?.());
    },
  };
}
