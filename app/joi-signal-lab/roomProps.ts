import * as THREE from "three";

/**
 * The props that make the desk study Gallo's room: Nick the cat, the Night Tide
 * handheld, and the after-hours balls.
 *
 * The base room renders baked atlases through light-ignoring shader materials, so a
 * standard-material prop would read as a silhouette unless something lights it. This
 * module adds one small rig — ambient plus a warm key — and the lights only ever reach
 * standard materials, which means the bake stays untouched and the props get modelling
 * without a single extra shadow map on the base scene.
 *
 * Placement is probing, not hardcoding: each prop names the spot it wants (a seat, a
 * patch of floor, a run of desk) and `placeAt` drops it on whatever up-facing surface
 * the capture actually has there, so a re-capture moves the props instead of
 * suspending them.
 */

export type RoomPropId = "cat" | "handheld" | "balls";

export type RoomPropsRig = {
  group: any;
  /** Idle life: breathing, tail, screen loop, ball physics. Called every frame. */
  update: (delta: number, timeMs: number) => void;
  /** A click landed on this prop. Returns the name for anyone keeping score. */
  poke: (id: RoomPropId) => void;
  /** Drop a prop group so its origin sits on a found surface point. */
  place: (id: RoomPropId, surfacePoint: any, surfaceNormal: any) => void;
  /** Hide a prop whose probe found no surface. */
  setVisible: (id: RoomPropId, on: boolean) => void;
  /** Where to probe for each prop's surface, in room coordinates. */
  probeSpots: Record<RoomPropId, { x: number; z: number; minY: number; maxY: number }>;
  nodesByProp: Record<RoomPropId, any[]>;
  dispose: () => void;
};

const createCanvasTexture = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export function createRoomProps(): RoomPropsRig {
  const group = new THREE.Group();
  group.name = "about-room-props";
  const owned: { geometry: any; material: any }[] = [];
  const track = (geometry: any, material: any) => {
    owned.push({ geometry, material });
    return geometry;
  };

  // Light rig: only the props answer it. Warm key from the window side, cool fill low.
  const ambient = new THREE.AmbientLight(0xfff4e0, 0.55);
  const key = new THREE.DirectionalLight(0xffe8c4, 1.15);
  key.position.set(6, 12, 8);
  const fill = new THREE.DirectionalLight(0x9db8d8, 0.35);
  fill.position.set(-8, 6, -4);
  group.add(ambient, key, fill);

  const propGroups: Record<RoomPropId, any> = {
    cat: new THREE.Group(),
    handheld: new THREE.Group(),
    balls: new THREE.Group(),
  };
  Object.values(propGroups).forEach((prop) => group.add(prop));
  propGroups.cat.name = "prop-nick";
  propGroups.handheld.name = "prop-handheld";
  propGroups.balls.name = "prop-balls";

  const nodesByProp: Record<RoomPropId, any[]> = { cat: [], handheld: [], balls: [] };

  /* ------------------------------------------------------------------ */
  /* Nick — black tabby, yellow eyes, transform-level life only.         */
  /* ------------------------------------------------------------------ */

  const fur = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.62, metalness: 0.05 });
  const furDark = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.7 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xe6b93a });

  const catBody = new THREE.Mesh(track(new THREE.SphereGeometry(1.15, 20, 16), fur), fur);
  catBody.scale.set(1.35, 0.95, 1.0);
  catBody.position.y = 1.05;
  const catHead = new THREE.Group();
  catHead.name = "nick-head";
  catHead.position.set(0, 1.72, -1.28);
  const catSkull = new THREE.Mesh(track(new THREE.SphereGeometry(0.78, 20, 16), fur), fur);
  const catEarLeft = new THREE.Mesh(track(new THREE.ConeGeometry(0.26, 0.52, 8), furDark), furDark);
  catEarLeft.position.set(-0.4, 0.72, 0);
  const catEarRight = catEarLeft.clone();
  catEarRight.position.x = 0.4;
  const catEyeLeft = new THREE.Mesh(track(new THREE.SphereGeometry(0.115, 10, 8), eyeMaterial), eyeMaterial);
  catEyeLeft.position.set(-0.28, 0.08, -0.66);
  const catEyeRight = catEyeLeft.clone();
  catEyeRight.position.x = 0.28;
  const catNose = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 8, 6), furDark), furDark);
  catNose.position.set(0, -0.14, -0.76);
  catHead.add(catSkull, catEarLeft, catEarRight, catEyeLeft, catEyeRight, catNose);

  // The tail is a chain of beads the idle loop swings — no skinning, no rig, and it
  // still reads as a tail because the beads share one radius profile.
  const tailBeads: any[] = [];
  for (let i = 0; i < 6; i += 1) {
    const radius = 0.17 - i * 0.014;
    const bead = new THREE.Mesh(track(new THREE.SphereGeometry(radius, 10, 8), fur), fur);
    tailBeads.push(bead);
    propGroups.cat.add(bead);
  }

  const catHaunchLeft = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 14, 12), fur), fur);
  catHaunchLeft.position.set(-0.78, 0.62, 0.62);
  const catHaunchRight = catHaunchLeft.clone();
  catHaunchRight.position.x = 0.78;
  const catPaws = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.34, 0.9, 6, 12), fur), fur);
  catPaws.rotation.z = Math.PI / 2;
  catPaws.position.set(0, 0.3, -0.75);

  propGroups.cat.add(catBody, catHead, catHaunchLeft, catHaunchRight, catPaws);
  nodesByProp.cat = [propGroups.cat];

  // Poke state: a head lift with a blink, then back to loaf.
  let catLift = 0;
  let catLiftTarget = 0;
  let blinkTimer = 2 + Math.random() * 3;
  let blink = 0;

  /* ------------------------------------------------------------------ */
  /* The handheld — Night Tide's fourth cartridge never shipped.         */
  /* ------------------------------------------------------------------ */

  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x232c3a, roughness: 0.45, metalness: 0.25 });
  const bezelMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.35 });
  const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5 });

  const shell = new THREE.Mesh(track(new THREE.BoxGeometry(2.15, 0.62, 1.0), shellMaterial), shellMaterial);
  shell.position.y = 0.31;
  const screenBezel = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 0.1, 0.82), bezelMaterial), bezelMaterial);
  screenBezel.position.set(-0.28, 0.66, 0);
  // The screen is a small canvas the idle loop repaints at ~8fps: a bouncing invader
  // and a score ticker. Deliberately not a video texture — no codec, works everywhere.
  const SCREEN_LOGICAL = 64;
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = SCREEN_LOGICAL;
  screenCanvas.height = Math.round(SCREEN_LOGICAL * 0.72);
  const screenCtx = screenCanvas.getContext("2d");
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.magFilter = THREE.NearestFilter;
  screenTexture.minFilter = THREE.NearestFilter;
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screenMesh = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.18, 0.72), screenMaterial),
    screenMaterial,
  );
  screenMesh.rotation.x = -Math.PI / 2;
  screenMesh.position.set(-0.28, 0.72, 0);
  const dpad = new THREE.Mesh(track(new THREE.BoxGeometry(0.52, 0.1, 0.16), buttonMaterial), buttonMaterial);
  dpad.position.set(0.72, 0.64, -0.12);
  const dpadVertical = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.1, 0.52), buttonMaterial), buttonMaterial);
  dpadVertical.position.copy(dpad.position);
  const buttonA = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 14), buttonMaterial), buttonMaterial);
  buttonA.position.set(0.68, 0.64, 0.24);
  const buttonB = buttonA.clone();
  buttonB.position.set(0.94, 0.64, 0.06);

  propGroups.handheld.add(shell, screenBezel, screenMesh, dpad, dpadVertical, buttonA, buttonB);
  nodesByProp.handheld = [propGroups.handheld];

  let screenAccumulator = 0;
  let screenFrame = 0;
  const paintScreen = (frame: number) => {
    if (!screenCtx) return;
    const w = screenCanvas.width;
    const h = screenCanvas.height;
    screenCtx.fillStyle = "#0a0f0a";
    screenCtx.fillRect(0, 0, w, h);
    screenCtx.fillStyle = "#1d3320";
    for (let y = 0; y < h; y += 4) screenCtx.fillRect(0, y, w, 1);
    // Bouncing invader, two pixels of travel per frame, wrapping.
    const invaderX = (frame * 2) % (w + 12) - 6;
    const invaderY = 14 + Math.round(Math.sin(frame * 0.35) * 4);
    screenCtx.fillStyle = "#9fe870";
    const pixel = (x: number, y: number) => screenCtx.fillRect(x, y, 2, 2);
    const sprite = [
      [0, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ];
    sprite.forEach((row, dy) => row.forEach((on, dx) => on && pixel(invaderX + dx * 2, invaderY + dy * 2)));
    screenCtx.fillStyle = "#e8e4d4";
    screenCtx.font = "6px monospace";
    screenCtx.fillText(`HI ${String(2400 + (frame % 60) * 10).padStart(5, "0")}`, 4, 8);
    screenCtx.fillStyle = "#e0704a";
    screenCtx.fillRect(w - 10 - ((frame * 3) % (w - 20)), h - 4, 8, 2);
    screenTexture.needsUpdate = true;
  };
  paintScreen(0);

  /* ------------------------------------------------------------------ */
  /* After hours — basketball on the floor, baseball in its glove.       */
  /* ------------------------------------------------------------------ */

  const basketballTexture = createCanvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#c05a24";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#2a1408";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 128); ctx.lineTo(512, 128);
    ctx.moveTo(128, 0); ctx.bezierCurveTo(160, 88, 160, 168, 128, 256);
    ctx.moveTo(384, 0); ctx.bezierCurveTo(352, 88, 352, 168, 384, 256);
    ctx.stroke();
  });
  const basketballMaterial = new THREE.MeshStandardMaterial({ map: basketballTexture, roughness: 0.85 });
  const basketball = new THREE.Mesh(track(new THREE.SphereGeometry(0.98, 24, 18), basketballMaterial), basketballMaterial);
  basketball.position.set(0, 0.98, 0);
  basketball.castShadow = false;

  // Glove: a palm pocket (flattened sphere) with four finger stalls and a thumb —
  // readable at room distance without pretending to be a modelled catcher's mitt.
  const leather = new THREE.MeshStandardMaterial({ color: 0x7a4a28, roughness: 0.8 });
  const leatherDark = new THREE.MeshStandardMaterial({ color: 0x5c3319, roughness: 0.85 });
  const glovePalm = new THREE.Mesh(track(new THREE.SphereGeometry(1.05, 18, 14), leather), leather);
  glovePalm.scale.set(1.25, 0.55, 1.1);
  const gloveStalls: any[] = [];
  for (let i = 0; i < 4; i += 1) {
    const stall = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.17, 0.55, 5, 10), leatherDark), leatherDark);
    stall.rotation.x = Math.PI / 2.3;
    stall.position.set(-0.6 + i * 0.36, 0.42, -0.55);
    gloveStalls.push(stall);
  }
  const gloveThumb = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.2, 0.5, 5, 10), leatherDark), leatherDark);
  gloveThumb.rotation.set(Math.PI / 2.4, 0, 0.7);
  gloveThumb.position.set(-0.95, 0.3, 0.35);
  const baseballTexture = createCanvasTexture(128, 64, (ctx) => {
    ctx.fillStyle = "#e8e2d4";
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = "#b03a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 0); ctx.bezierCurveTo(44, 22, 44, 42, 24, 64);
    ctx.moveTo(104, 0); ctx.bezierCurveTo(84, 22, 84, 42, 104, 64);
    ctx.stroke();
  });
  const baseballMaterial = new THREE.MeshStandardMaterial({ map: baseballTexture, roughness: 0.7 });
  const baseball = new THREE.Mesh(track(new THREE.SphereGeometry(0.3, 16, 12), baseballMaterial), baseballMaterial);
  baseball.position.set(0, 0.62, 0.1);

  const glove = new THREE.Group();
  glove.add(glovePalm, ...gloveStalls, gloveThumb);
  glove.position.set(-1.6, 0, 0);
  glove.rotation.y = 0.5;
  propGroups.balls.add(basketball, glove, baseball);
  nodesByProp.balls = [propGroups.balls];

  // The ball rolls a little when poked, then settles back into the pocket.
  let baseballSpin = 0;
  let baseballSpinRate = 0;

  /* ------------------------------------------------------------------ */

  const probeSpots: RoomPropsRig["probeSpots"] = {
    // The chair is where the room says the person isn't; Nick disagrees.
    cat: { x: 9.2, z: -2.4, minY: 2.0, maxY: 6.5 },
    // Desk surface, short side nearest the reader, clear of the film's landing spot.
    handheld: { x: 4.1, z: 0.9, minY: 4.5, maxY: 8.5 },
    // Floor patch beside the chair.
    balls: { x: 10.5, z: -7.0, minY: -0.5, maxY: 2.0 },
  };

  const update = (delta: number, timeMs: number) => {
    const t = timeMs * 0.001;

    // Nick: breathing, blink, tail sway, and the poke lift.
    catLift += (catLiftTarget - catLift) * Math.min(1, delta * 6);
    const breath = 1 + Math.sin(t * 1.9) * 0.016;
    catBody.scale.set(1.35, 0.95 * breath, 1.0);
    catHead.rotation.x = -catLift * 0.5;
    catHead.position.y = 1.72 + catLift * 0.34;
    blinkTimer -= delta;
    if (blinkTimer <= 0) {
      blink = 0.14;
      blinkTimer = 2.5 + Math.random() * 3.5;
    }
    blink = Math.max(0, blink - delta);
    const eyeScale = blink > 0 ? Math.max(0.08, 1 - (blink / 0.14) * 1.4) : 1;
    catEyeLeft.scale.y = eyeScale;
    catEyeRight.scale.y = eyeScale;
    tailBeads.forEach((bead, index) => {
      const along = index / (tailBeads.length - 1);
      const sway = Math.sin(t * (catLiftTarget > 0 ? 5.2 : 2.1) + along * 2.4) * (0.16 + along * 0.5);
      bead.position.set(
        Math.sin(sway) * 0.9,
        0.42 + along * 0.62,
        1.28 + Math.cos(sway * 0.6) * along * 0.7,
      );
    });
    if (catLiftTarget > 0) {
      catLiftHold -= delta;
      if (catLiftHold <= 0) catLiftTarget = 0;
    }

    // Handheld screen loop at ~8fps.
    screenAccumulator += delta;
    if (screenAccumulator >= 0.125) {
      screenAccumulator = 0;
      screenFrame = (screenFrame + 1) % 4096;
      paintScreen(screenFrame);
    }

    // Baseball settling back into the pocket after a poke.
    if (baseballSpinRate > 0.01) {
      baseballSpin += baseballSpinRate * delta;
      baseballSpinRate *= Math.max(0, 1 - delta * 2.2);
      baseball.position.x = 0.1 + Math.sin(baseballSpin) * 0.12;
      baseball.rotation.z = baseballSpin * 0.5;
    }
    // Basketball bounce.
    if (ballVelocity !== 0 || ballHeight !== 0.98) {
      ballVelocity -= 14 * delta;
      ballHeight += ballVelocity * delta;
      if (ballHeight <= 0.98) {
        ballHeight = 0.98;
        ballVelocity = Math.abs(ballVelocity) > 1.6 ? Math.abs(ballVelocity) * 0.52 : 0;
      }
      basketball.position.y = ballHeight;
    }
  };

  let catLiftHold = 0;
  let ballVelocity = 0;
  let ballHeight = 0.98;

  return {
    group,
    update,
    poke: (id) => {
      if (id === "cat") {
        catLiftTarget = 1;
        catLiftHold = 1.25;
        blink = 0.1;
      } else if (id === "balls") {
        ballVelocity = 4.6;
        baseballSpinRate = 5.5;
      }
    },
    place: (id, surfacePoint, surfaceNormal) => {
      const prop = propGroups[id];
      prop.position.copy(surfacePoint);
      // Stand the prop on the surface: origin at the contact patch, upright along the
      // surface normal, plus a small lift so nothing z-fights the bake.
      prop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);
      prop.position.addScaledVector(surfaceNormal, 0.02);
    },
    setVisible: (id, on) => { propGroups[id].visible = on; },
    probeSpots,
    nodesByProp,
    dispose: () => {
      owned.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
      screenTexture.dispose();
      basketballTexture.dispose();
      baseballTexture.dispose();
      group.clear();
    },
  };
}
