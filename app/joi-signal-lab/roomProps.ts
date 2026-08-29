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

/** One probe: where a prop (or one half of one) wants to stand, in room coordinates. */
export type RoomPropPlacement = {
  id: RoomPropId;
  /** For a prop with independently placed parts. */
  part?: "basketball" | "glove";
  x: number;
  z: number;
  minY: number;
  maxY: number;
  /** World point the prop should face (yaw only), e.g. Nick watches the screen. */
  faceTo?: [number, number, number];
  /** Where to stand if the probe finds nothing — props are never left unplaced. */
  fallbackY: number;
};

export type RoomPropsRig = {
  group: any;
  /** Idle life: breathing, tail, screen loop, ball physics. Called every frame. */
  update: (delta: number, timeMs: number) => void;
  /** A click landed on this prop. Returns the name for anyone keeping score. */
  poke: (id: RoomPropId) => void;
  /** Drop a prop (or one part of one) so its origin sits on a found surface point. */
  place: (
    id: RoomPropId,
    surfacePoint: any,
    surfaceNormal: any,
    part?: "basketball" | "glove",
    faceTo?: [number, number, number],
  ) => void;
  /** Hide a prop whose probe found no surface. */
  setVisible: (id: RoomPropId, on: boolean) => void;
  probeSpots: RoomPropPlacement[];
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
  /* Built to a Switch's real proportions: 239 × 102 × 13.9 mm at        */
  /* ~0.116 m per room unit is 2.06 × 0.88 × 0.12, lying flat.           */
  /* ------------------------------------------------------------------ */

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.42, metalness: 0.2 });
  // Joy-Con rails in the site's own pair — the reference silhouette, our colours.
  const railLeftMaterial = new THREE.MeshStandardMaterial({ color: 0x294f82, roughness: 0.5 });
  const railRightMaterial = new THREE.MeshStandardMaterial({ color: 0xed654a, roughness: 0.5 });
  const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5 });

  const body = new THREE.Mesh(track(new THREE.BoxGeometry(2.06, 0.12, 0.88), bodyMaterial), bodyMaterial);
  body.position.y = 0.06;
  const railLeft = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.155, 0.92), railLeftMaterial), railLeftMaterial);
  railLeft.position.set(-0.86, 0.078, 0);
  const railRight = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.155, 0.92), railRightMaterial), railRightMaterial);
  railRight.position.set(0.86, 0.078, 0);
  // The screen is a small canvas the idle loop repaints at ~8fps: a bouncing invader
  // and a score ticker. Deliberately not a video texture — no codec, works everywhere.
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 128;
  screenCanvas.height = 60;
  const screenCtx = screenCanvas.getContext("2d");
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.magFilter = THREE.NearestFilter;
  screenTexture.minFilter = THREE.NearestFilter;
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screenMesh = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.3, 0.6), screenMaterial),
    screenMaterial,
  );
  screenMesh.rotation.x = -Math.PI / 2;
  screenMesh.position.set(0, 0.121, 0);
  // Left rail: stick above, D-pad below. Right rail: four buttons in a diamond.
  const stick = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.11, 0.045, 16), bodyMaterial), bodyMaterial);
  stick.position.set(-0.86, 0.175, 0.22);
  const dpadBar = new THREE.Mesh(track(new THREE.BoxGeometry(0.2, 0.03, 0.07), buttonMaterial), buttonMaterial);
  dpadBar.position.set(-0.86, 0.17, -0.18);
  const dpadBarVertical = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.03, 0.2), buttonMaterial), buttonMaterial);
  dpadBarVertical.position.copy(dpadBar.position);
  const faceButtons: any[] = [];
  [
    [0.86, 0.15],
    [0.86, -0.15],
    [0.77, 0],
    [0.95, 0],
  ].forEach(([x, z]) => {
    const button = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 12), buttonMaterial), buttonMaterial);
    button.position.set(x, 0.175, z);
    faceButtons.push(button);
  });

  propGroups.handheld.add(
    body,
    railLeft,
    railRight,
    screenMesh,
    stick,
    dpadBar,
    dpadBarVertical,
    ...faceButtons,
  );
  nodesByProp.handheld = [propGroups.handheld];
  /** A touch of askew, because nobody places a console square to the desk edge. */
  const handheldYaw = 0.35;

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
  baseball.position.set(0, 0.62, 0.08);

  // The glove is one placement (desk), the basketball another (floor), so each gets
  // its own subgroup under the shared "balls" hotspot.
  const glove = new THREE.Group();
  glove.add(glovePalm, ...gloveStalls, gloveThumb, baseball);
  glove.rotation.y = 0.5;
  const basketballGroup = new THREE.Group();
  basketballGroup.add(basketball);
  propGroups.balls.add(basketballGroup, glove);
  nodesByProp.balls = [propGroups.balls];

  // The ball rolls a little when poked, then settles back into the pocket.
  let baseballSpin = 0;
  let baseballSpinRate = 0;

  /* ------------------------------------------------------------------ */

  /*
   * Placements read off the capture's real geometry (scripts/dev/inspect-room-glb.mjs):
   * the office chair stands at (10.42, -4.25), the desk surface sits near y 5.7, the
   * floor near y 0. The chair probe looks for the seat between seat and backrest bands;
   * the desk spots look between desk and shelf bands.
   */
  const probeSpots: RoomPropPlacement[] = [
    // Nick takes the chair and watches whoever the screen is for.
    { id: "cat", x: 10.42, z: -4.25, minY: 3.2, maxY: 5.6, faceTo: [3.07, 5.8, -4.06], fallbackY: 4.3 },
    // Desk surface, front-right quadrant, clear of the film's landing spot.
    { id: "handheld", x: 4.2, z: 0.4, minY: 4.5, maxY: 8.5, fallbackY: 5.72 },
    // The basketball lives on the floor beside the chair.
    { id: "balls", part: "basketball", x: 12.2, z: -6.5, minY: -0.5, maxY: 2.0, fallbackY: 0 },
    // The glove rests on the desk's near corner, between pen and camera.
    { id: "balls", part: "glove", x: 3.4, z: 2.0, minY: 4.5, maxY: 8.5, fallbackY: 5.72 },
  ];

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
      baseball.position.x = Math.sin(baseballSpin) * 0.1;
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
    place: (id, surfacePoint, surfaceNormal, part, faceTo) => {
      // A prop with parts moves just that part; the rest of the prop stays put.
      const target =
        part === "basketball" ? basketballGroup : part === "glove" ? glove : propGroups[id];
      target.position.copy(surfacePoint);
      // Stand the prop on the surface: origin at the contact patch, upright along the
      // surface normal, plus a small lift so nothing z-fights the bake.
      target.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal);
      target.position.addScaledVector(surfaceNormal, 0.02);
      if (faceTo) {
        // Yaw the prop towards a world point, applied after the upright alignment.
        const direction = new THREE.Vector3(faceTo[0], 0, faceTo[2])
          .sub(new THREE.Vector3(target.position.x, 0, target.position.z));
        if (direction.lengthSq() > 1e-6) {
          // The cat's nose points down local -Z; solve the yaw that aims it.
          const yaw = Math.atan2(-direction.x, -direction.z);
          const yawQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw,
          );
          target.quaternion.multiply(yawQuat);
        }
      } else if (id === "handheld") {
        target.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), handheldYaw),
        );
      }
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
