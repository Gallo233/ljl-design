import * as THREE from "three";
import {
  DECK_PALETTE,
  controlDecal,
  deckSurface,
  namePlate,
  platterMetal,
  recordLabel,
  slipmatFelt,
  speedDecal,
  vinylFace,
} from "./roomTurntableTextures";
import {
  blankSurfaceTexture,
  createSurfaceMaterial,
  screenColor,
  type SurfaceOptions,
} from "./roomSurface";

/**
 * The deck, built in code and dropped onto the desk in place of the captured one.
 *
 * The room's own turntable came in with the capture: six meshes, a lid, and a record
 * whose label bakes to a green blob at the distance player mode frames it from. It was
 * fine as furniture and thin as a subject, and player mode makes it the subject. This
 * is the machine that stands there now — plinth, platter, a tonearm that solves its own
 * tracking angle, and controls that are real objects rather than printed shapes.
 *
 * Geometry and the arm solver are adapted from a code-built turntable study; the finish
 * is ours. `roomTurntableTextures.ts` carries the palette note, and `roomSurface.ts`
 * carries the shading model — this machine is where it was written, and the basketball
 * standing on the floor now shares it.
 */

const TAU = Math.PI * 2;

/** The pilot lamp, dark and lit. Held here so `update` allocates nothing. */
const PILOT_DARK = "#3a2a18";
const PILOT_LIT = "#ffb257";

export type DeckControlId = "volume" | "tone" | "start" | "speed";

export type DeckRecordSide = {
  id?: string;
  title: string;
  artist: string;
  color: string;
  artwork?: string | null;
};

/** Everything this rig allocated, so `dispose` can hand it all back. */
type Owned = { geometries: Set<any>; materials: Set<any>; textures: Set<any> };

/** As the shared surface takes it, except the deck paints its maps on canvases. */
type DeckSurfaceOptions = Omit<SurfaceOptions, "map"> & { map?: HTMLCanvasElement };

export type DeckRig = {
  /**
   * Add this to the room. It is authored with the deck top at y = 0, and it is also
   * the About hotspot's single node — the machine lifts and focuses as one object,
   * where the capture's deck was six meshes that had to be lifted in formation.
   */
  group: any;
  /** Every mesh belonging to a control, tagged in `userData.deckControl`. */
  controlNodes: any[];
  /**
   * The three measurements the room needs to stand this machine where the captured one
   * stood, all in the group's own unscaled space. Exported rather than copied into
   * `room3d.ts` so the placement arithmetic reads against the model that defines them.
   */
  anchors: {
    /** Platter centre, on the deck plane. */
    platterCentre: any;
    /** The underside of the feet — what the table takes the weight on. */
    bottomY: number;
    /** The playing surface of the record. */
    recordTopY: number;
    /** Radius of the pressing, which is what sets the scale. */
    recordRadius: number;
  };
  setSpinning: (spinning: boolean) => void;
  /** 33⅓ or 45. The platter eases between them rather than jumping. */
  setRpm: (rpm: number) => void;
  /**
   * Where the stylus sits. `null` parks the arm off the record; 0 is the outer groove
   * and 1 the run-out. The arm lifts, swings and sets down on its own.
   */
  setTonearm: (progress: number | null) => void;
  /** Swap the label on the record for whichever side is playing. */
  setLabel: (side: DeckRecordSide) => void;
  /** Keep the physical knobs in step with the site-wide audio state. */
  setControlValue: (control: "volume" | "tone" | "speed", value: number) => void;
  /** The cap physically travels when the START / STOP control is pressed. */
  pressStart: () => void;
  /** A small scale lift is the hover affordance inherited from the GLM study. */
  setControlHover: (control: DeckControlId | null) => void;
  /** Lights the pilot lamp while the motor is running. */
  update: (delta: number) => void;
  dispose: () => void;
};

export function createRoomTurntable(): DeckRig {
  const owned: Owned = { geometries: new Set(), materials: new Set(), textures: new Set() };

  const canvasTexture = (canvas: HTMLCanvasElement) => {
    const texture = new THREE.CanvasTexture(canvas);
    // Deliberately no `colorSpace`: sampled raw, to sit in the same space as the bake.
    texture.anisotropy = 8;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    owned.textures.add(texture);
    return texture;
  };

  const blank = blankSurfaceTexture();

  /**
   * The machine's surfaces are painted on canvases, so this is the one place that turns
   * a canvas into a texture and hands both the material and the texture to `owned`.
   * The shading itself is `roomSurface.ts`, shared with the basketball.
   */
  function createSurface({ map, ...options }: DeckSurfaceOptions = {}) {
    const material = createSurfaceMaterial({
      ...options,
      map: map ? canvasTexture(map) : undefined,
    });
    owned.materials.add(material);
    return material;
  }

  const mesh = (geometry: any, material: any) => {
    owned.geometries.add(geometry);
    return new THREE.Mesh(geometry, material);
  };
  const place = (node: any, x: number, y: number, z: number) => {
    node.position.set(x, y, z);
    return node;
  };

  /* ------------------------------------------------------------------ */
  /* Materials                                                           */
  /* ------------------------------------------------------------------ */
  const mat = {
    body: createSurface({
      color: DECK_PALETTE.cream,
      map: deckSurface(),
      gloss: 26,
      specular: 0.14,
      rim: 0.05,
    }),
    bodyEdge: createSurface({ color: DECK_PALETTE.creamShade, gloss: 22, specular: 0.1 }),
    cream: createSurface({ color: DECK_PALETTE.creamLit, gloss: 24, specular: 0.14 }),
    plinth: createSurface({ color: DECK_PALETTE.ink, gloss: 24, specular: 0.1, rim: 0.05 }),
    aluminium: createSurface({
      color: DECK_PALETTE.steelLit,
      map: platterMetal(),
      metal: 0.9,
      gloss: 30,
      specular: 0.3,
      env: 0.5,
      rim: 0.1,
    }),
    chrome: createSurface({
      color: DECK_PALETTE.steelLit,
      metal: 1,
      gloss: 90,
      specular: 0.7,
      env: 0.85,
      rim: 0.16,
    }),
    steel: createSurface({
      color: DECK_PALETTE.steel,
      metal: 0.85,
      gloss: 40,
      specular: 0.34,
      env: 0.45,
      rim: 0.1,
    }),
    darkMetal: createSurface({
      color: DECK_PALETTE.inkSoft,
      metal: 0.7,
      gloss: 34,
      specular: 0.22,
      env: 0.24,
      rim: 0.08,
    }),
    inkGloss: createSurface({ color: DECK_PALETTE.ink, gloss: 60, specular: 0.34, rim: 0.12 }),
    inkMatte: createSurface({ color: "#1b1815", gloss: 14, specular: 0.06, rim: 0.04 }),
    coral: createSurface({ color: DECK_PALETTE.coral, gloss: 22, specular: 0.16, rim: 0.06 }),
    felt: createSurface({ color: "#ffffff", map: slipmatFelt(), gloss: 8, specular: 0.03, rim: 0.03 }),
    vinyl: createSurface({
      color: "#ffffff",
      map: vinylFace(),
      gloss: 46,
      specular: 0.3,
      env: 0.12,
      rim: 0.14,
    }),
    plate: createSurface({ color: "#ffffff", map: namePlate(), gloss: 24, specular: 0.12 }),
  };

  /** The record's label, swapped whenever the side changes. */
  const labelMaterial = createSurface({ color: "#ffffff", gloss: 10, specular: 0.05, rim: 0.03 });
  labelMaterial.uniforms.uHasMap.value = 1;

  const group = new THREE.Group();
  group.name = "about-room-deck";

  const controlNodes: any[] = [];
  const controlGroups = new Map<DeckControlId, any>();

  const add = (node: any, { control }: { control?: DeckControlId } = {}) => {
    group.add(node);
    if (control) {
      controlGroups.set(control, node);
      node.traverse((child: any) => {
        child.userData.deckControl = control;
        if (child.isMesh) controlNodes.push(child);
      });
    }
    return node;
  };

  /* ------------------------------------------------------------------ */
  /* Plinth                                                              */
  /* ------------------------------------------------------------------ */
  const PLATTER_POS = new THREE.Vector3(-0.45, 0, -0.1);
  /** Underside of the rubber feet. Keep in step with the foot cylinders below. */
  const FOOT_BOTTOM_Y = -0.79;

  {
    const W = 4.7;
    const D = 3.3;
    const R = 0.16;
    const shape = new THREE.Shape();
    shape.moveTo(-2.19, -D / 2);
    shape.lineTo(W / 2 - R, -D / 2);
    shape.quadraticCurveTo(W / 2, -D / 2, W / 2, -1.49);
    shape.lineTo(W / 2, D / 2 - R);
    shape.quadraticCurveTo(W / 2, D / 2, W / 2 - R, D / 2);
    shape.lineTo(-2.19, D / 2);
    shape.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - R);
    shape.lineTo(-W / 2, -1.49);
    shape.quadraticCurveTo(-W / 2, -D / 2, -2.19, -D / 2);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 4,
      curveSegments: 12,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.45, 0);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 0.22, uv.getY(i) * 0.22);
    add(mesh(geometry, mat.body));

    // The ink base the cream body stands on. It is what keeps a light machine from
    // floating off a near-white table, and it ties the deck to the room's dark half.
    const baseShape = new THREE.Shape();
    const bw = W + 0.16;
    const bd = D + 0.16;
    baseShape.moveTo(-bw / 2, -bd / 2);
    baseShape.lineTo(bw / 2, -bd / 2);
    baseShape.lineTo(bw / 2, bd / 2);
    baseShape.lineTo(-bw / 2, bd / 2);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    baseGeo.rotateX(-Math.PI / 2);
    baseGeo.translate(0, -0.63, 0);
    add(mesh(baseGeo, mat.plinth));
  }

  // Feet.
  ([
    [-2, -1.32],
    [2, -1.32],
    [-2, 1.32],
    [2, 1.32],
  ] as const).forEach(([x, z]) => {
    add(place(mesh(new THREE.CylinderGeometry(0.14, 0.175, 0.16, 28), mat.inkMatte), x, -0.71, z));
    const washer = place(
      mesh(new THREE.TorusGeometry(0.165, 0.016, 10, 28), mat.darkMetal),
      x,
      -0.775,
      z,
    );
    washer.rotation.x = Math.PI / 2;
    add(washer);
  });

  // Rear vents and the lid hinges they sit between.
  [-1.35, 1.35].forEach((x) => {
    add(place(mesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), mat.inkMatte), x, 0.025, -1.56));
    const pin = place(
      mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 16), mat.darkMetal),
      x,
      0.062,
      -1.585,
    );
    pin.rotation.z = Math.PI / 2;
    add(pin);
  });

  // The back panel: pilot lamps, a bolt, the power inlet and its cord.
  {
    const strip = mesh(new THREE.PlaneGeometry(1, 0.26), mat.inkMatte);
    strip.rotation.y = Math.PI;
    strip.position.set(0.65, -0.26, -1.664);
    add(strip);

    const socket = place(
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 18), mat.chrome),
      0.45,
      -0.24,
      -1.69,
    );
    socket.rotation.x = Math.PI / 2;
    add(socket);

    const bolt = place(
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), mat.steel),
      0.88,
      -0.24,
      -1.685,
    );
    bolt.rotation.x = Math.PI / 2;
    add(bolt);

    const jack = place(
      mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.09, 14), mat.inkMatte),
      1.1,
      -0.3,
      -1.7,
    );
    jack.rotation.x = Math.PI / 2;
    add(jack);

    const cord = mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(1.1, -0.3, -1.74),
          new THREE.Vector3(1.12, -0.42, -1.93),
          new THREE.Vector3(1.16, -0.66, -2.08),
          new THREE.Vector3(1.22, -0.76, -2.28),
        ]),
        24,
        0.02,
        10,
      ),
      mat.inkMatte,
    );
    add(cord);
  }

  // The shadow the platter throws onto the deck, which no light here can draw.
  {
    const halo = mesh(
      new THREE.RingGeometry(1.36, 1.56, 96),
      createSurface({ color: "#0f0d0b", opacity: 0.42, transparent: true, depthWrite: false, unlit: true }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(PLATTER_POS.x, 0.0018, PLATTER_POS.z);
    add(halo);
  }

  /* ------------------------------------------------------------------ */
  /* Platter                                                             */
  /* ------------------------------------------------------------------ */
  const platter = new THREE.Group();
  platter.position.copy(PLATTER_POS);
  add(platter);
  {
    const rim = mesh(new THREE.CylinderGeometry(1.42, 1.38, 0.1, 96), mat.aluminium);
    rim.position.y = 0.05;
    platter.add(rim);

    const trim = mesh(new THREE.TorusGeometry(1.415, 0.01, 8, 120), mat.chrome);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.098;
    platter.add(trim);

    // Stroboscope dots around the rim.
    const dotGeometry = new THREE.SphereGeometry(0.0115, 8, 8);
    owned.geometries.add(dotGeometry);
    const dots = new THREE.InstancedMesh(dotGeometry, mat.darkMetal, 80);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 0.5);
    for (let i = 0; i < 80; i += 1) {
      const a = (i / 80) * TAU;
      quaternion.setFromEuler(new THREE.Euler(0, -a, 0));
      matrix.compose(new THREE.Vector3(Math.cos(a) * 1.412, 0.055, Math.sin(a) * 1.412), quaternion, scale);
      dots.setMatrixAt(i, matrix);
    }
    platter.add(dots);

    const slipmat = mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.022, 96), mat.felt);
    slipmat.position.y = 0.111;
    platter.add(slipmat);
  }

  /** The record. Turns with the platter; its label is swapped per side. */
  const disc = new THREE.Group();
  platter.add(disc);

  const RECORD_RADIUS = 1.36;
  const RECORD_TOP_Y = 0.148;
  const recordFace = mesh(new THREE.CylinderGeometry(RECORD_RADIUS, 1.352, 0.026, 128), mat.vinyl);
  recordFace.position.y = RECORD_TOP_Y - 0.013;
  disc.add(recordFace);

  {
    const edge = mesh(new THREE.TorusGeometry(1.352, 0.012, 8, 140), mat.inkGloss);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.14;
    disc.add(edge);
  }

  const labelDisc = mesh(new THREE.CircleGeometry(0.435, 64), labelMaterial);
  labelDisc.rotation.x = -Math.PI / 2;
  labelDisc.position.y = 0.1496;
  disc.add(labelDisc);

  // Spindle.
  {
    const pin = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.1, 20), mat.chrome);
    pin.position.y = 0.17;
    platter.add(pin);
    const cap = mesh(new THREE.SphereGeometry(0.021, 16, 12), mat.chrome);
    cap.position.y = 0.219;
    cap.scale.y = 0.55;
    platter.add(cap);
  }

  // The 45 adapter, parked on the deck where one always is.
  {
    const pad = mesh(
      new THREE.CircleGeometry(0.135, 40),
      createSurface({ color: "#0f0d0b", opacity: 0.36, transparent: true, depthWrite: false, unlit: true }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(-1.15, 0.0022, 1.38);
    add(pad);
    add(place(mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.042, 40), mat.aluminium), -1.15, 0.023, 1.38));
    const ring = place(mesh(new THREE.TorusGeometry(0.098, 0.008, 8, 40), mat.steel), -1.15, 0.045, 1.38);
    ring.rotation.x = Math.PI / 2;
    add(ring);
    add(place(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.046, 24), mat.inkMatte), -1.15, 0.024, 1.38));
  }

  /* ------------------------------------------------------------------ */
  /* Tonearm                                                             */
  /* ------------------------------------------------------------------ */
  const ARM = { pivot: new THREE.Vector3(1.55, 0, -0.85), length: 2.05, bearingY: 0.3 };

  const armBase = new THREE.Group();
  armBase.position.copy(ARM.pivot);
  add(armBase);

  /** Yaw: swings the stylus across the record. */
  const armLift = new THREE.Group();
  armLift.position.y = ARM.bearingY;
  armBase.add(armLift);

  /** Pitch: raises the stylus off the groove. */
  const armTube = new THREE.Group();
  armLift.add(armTube);

  /** The cue lever, up while the arm is off the record. */
  const armLever = new THREE.Group();

  {
    const foot = mesh(new THREE.CylinderGeometry(0.22, 0.235, 0.035, 44), mat.aluminium);
    foot.position.y = 0.0175;
    armBase.add(foot);
    const hub = mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.06, 40), mat.darkMetal);
    hub.position.y = 0.062;
    armBase.add(hub);
    const collar = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 28), mat.steel);
    collar.position.y = 0.105;
    armBase.add(collar);
    const post = mesh(new THREE.CylinderGeometry(0.05, 0.055, ARM.bearingY - 0.09, 24), mat.chrome);
    post.position.y = (ARM.bearingY + 0.09) / 2;
    armBase.add(post);

    const gimbal = mesh(new THREE.TorusGeometry(0.088, 0.013, 10, 36), mat.darkMetal);
    gimbal.rotation.y = Math.PI / 2;
    armLift.add(gimbal);

    const axle = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 18), mat.darkMetal);
    axle.rotation.z = Math.PI / 2;
    armTube.add(axle);
    [-0.105, 0.105].forEach((x) => {
      const cap = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 14), mat.chrome);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = x;
      armTube.add(cap);
    });

    for (let i = 0; i < 4; i += 1) {
      const screw = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10), mat.steel);
      const a = (i / 4) * TAU + 0.4;
      screw.position.set(Math.cos(a) * 0.185, 0.038, Math.sin(a) * 0.185);
      armBase.add(screw);
    }

    armLever.position.set(0.2, 0.095, 0.1);
    armBase.add(armLever);
    armLever.add(mesh(new THREE.BoxGeometry(0.045, 0.03, 0.045), mat.darkMetal));
    const stem = mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.15, 10), mat.steel);
    stem.rotation.x = 1.15;
    stem.position.set(0, 0.045, 0.055);
    armLever.add(stem);
    const knobBall = mesh(new THREE.SphereGeometry(0.02, 12, 10), mat.inkGloss);
    knobBall.position.set(0, 0.075, 0.115);
    armLever.add(knobBall);
    armLever.rotation.x = 0.55;

    // The lift bar, and the post that holds it up. The bar came across from the study
    // floating at height, which reads at this distance — the camera gets close enough to
    // see that nothing is under it.
    const liftBar = mesh(new THREE.BoxGeometry(0.05, 0.022, 0.17), mat.inkMatte);
    liftBar.position.set(-0.02, 0.175, -0.3);
    liftBar.rotation.y = 0.35;
    armBase.add(liftBar);
    const liftPost = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.175, 14), mat.steel);
    liftPost.position.set(-0.02, 0.088, -0.3);
    armBase.add(liftPost);

    // The S-tube. A straight arm would be easier and would not track.
    const tubePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.08),
      new THREE.Vector3(0.02, 0, -0.45),
      new THREE.Vector3(0.09, -0.01, -1.05),
      new THREE.Vector3(-0.02, -0.03, -1.65),
      new THREE.Vector3(-0.1, -0.045, -ARM.length + 0.09),
    ]);
    armTube.add(mesh(new THREE.TubeGeometry(tubePath, 48, 0.024, 12), mat.chrome));

    const tailPiece = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 14), mat.darkMetal);
    tailPiece.rotation.x = Math.PI / 2;
    tailPiece.position.set(0, 0.002, 0.2);
    armTube.add(tailPiece);
    const tailCollar = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 16), mat.steel);
    tailCollar.rotation.x = Math.PI / 2;
    tailCollar.position.set(0, 0, 0.06);
    armTube.add(tailCollar);

    // Headshell, cartridge and stylus.
    const head = new THREE.Group();
    head.position.set(-0.115, -0.052, -ARM.length + 0.055);
    head.rotation.y = 0.32;
    armTube.add(head);
    const fingerLift = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 14), mat.darkMetal);
    fingerLift.rotation.x = Math.PI / 2;
    fingerLift.position.set(0, 0.01, 0.1);
    head.add(fingerLift);
    head.add(mesh(new THREE.BoxGeometry(0.085, 0.022, 0.19), mat.inkGloss));
    const clip = mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 20, 2.4), mat.chrome);
    clip.rotation.set(0, 0.4, 1.1);
    clip.position.set(0.055, 0.008, -0.055);
    head.add(clip);
    const cartridge = mesh(new THREE.BoxGeometry(0.066, 0.048, 0.11), mat.inkMatte);
    cartridge.position.set(0, -0.034, -0.025);
    head.add(cartridge);
    // The machine's one accent, where a cartridge keeps its one accent.
    const facePad = mesh(new THREE.BoxGeometry(0.052, 0.034, 0.008), mat.coral);
    facePad.position.set(0, -0.036, -0.082);
    head.add(facePad);
    const cantilever = mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.055, 8), mat.steel);
    cantilever.rotation.x = Math.PI / 2 - 0.5;
    cantilever.position.set(0, -0.066, -0.07);
    head.add(cantilever);
    const stylus = mesh(new THREE.ConeGeometry(0.007, 0.024, 8), mat.chrome);
    stylus.rotation.x = Math.PI;
    stylus.position.set(0, -0.081, -0.084);
    head.add(stylus);
    head.add(
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.01, 0.012, 0.075),
            new THREE.Vector3(0.02, 0.03, 0.02),
            new THREE.Vector3(0.005, 0.005, -0.02),
          ]),
          12,
          0.005,
          6,
        ),
        mat.inkMatte,
      ),
    );

    // Counterweight.
    const barrel = mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.11, 32), mat.darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.002, 0.36);
    armTube.add(barrel);
    const barrelTrim = mesh(new THREE.TorusGeometry(0.083, 0.007, 8, 40), mat.inkGloss);
    barrelTrim.position.set(0, 0.002, 0.36);
    armTube.add(barrelTrim);
    const barrelEnd = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 24), mat.steel);
    barrelEnd.rotation.x = Math.PI / 2;
    barrelEnd.position.set(0, 0.002, 0.285);
    armTube.add(barrelEnd);
    const gauge = mesh(new THREE.BoxGeometry(0.008, 0.01, 0.048), mat.cream);
    gauge.position.set(0, 0.058, 0.285);
    armTube.add(gauge);

    // Anti-skate and the cueing lever.
    const skate = mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.035, 20), mat.steel);
    skate.position.set(0.17, 0.1, 0.16);
    armBase.add(skate);
    const skateLine = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.024), mat.darkMetal);
    skateLine.position.set(0.17, 0.12, 0.145);
    armBase.add(skateLine);
    const pillar = mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.25, 16), mat.inkMatte);
    pillar.position.set(-0.26, 0.125, 0.55);
    armBase.add(pillar);
    const handle = mesh(new THREE.BoxGeometry(0.075, 0.022, 0.05), mat.inkMatte);
    handle.position.set(-0.26, 0.262, 0.55);
    armBase.add(handle);
    [-0.034, 0.034].forEach((dx) => {
      const prong = mesh(new THREE.BoxGeometry(0.012, 0.06, 0.05), mat.inkMatte);
      prong.position.set(-0.26 + dx, 0.3, 0.55);
      armBase.add(prong);
    });

    // The arm rest the stylus parks over.
    const restPost = mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.2, 16), mat.steel);
    restPost.position.set(-0.1, 0.1, 0.86);
    armBase.add(restPost);
    const restCradle = mesh(new THREE.BoxGeometry(0.11, 0.03, 0.05), mat.inkMatte);
    restCradle.position.set(-0.1, 0.212, 0.86);
    armBase.add(restCradle);
  }

  /**
   * The angle that puts the stylus `radius` from the platter centre.
   *
   * Swept rather than solved in closed form: the bearing sits off the platter, so the
   * stylus traces a circle about the bearing and the radius it lands at is not linear in
   * the angle. Sweeping the bearing circle for the closest hit is exact enough at 0.002
   * radians and runs three times, at build.
   */
  function armAngleFor(radius: number) {
    const dx = ARM.pivot.x - PLATTER_POS.x;
    const dz = ARM.pivot.z - PLATTER_POS.z;
    let best = 0;
    let bestError = Infinity;
    for (let a = 1.2; a < 3.3; a += 0.002) {
      const px = dx - ARM.length * Math.sin(a);
      const pz = dz - ARM.length * Math.cos(a);
      const error = Math.abs(Math.hypot(px, pz) - radius);
      if (error < bestError && a > 1.9) {
        bestError = error;
        best = a;
      }
    }
    return best;
  }

  const REST_ANGLE = 2.72;
  const LEADIN_ANGLE = armAngleFor(1.27);
  const RUNOUT_ANGLE = armAngleFor(0.62);
  const ELEV_UP = 0.055;
  const ELEV_DOWN = -0.0065;
  armLift.rotation.y = REST_ANGLE;
  armTube.rotation.x = ELEV_UP;

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */
  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  owned.materials.add(hitMaterial);

  function addHitZone(parent: any, radius: number, height = 0.25) {
    const zone = mesh(new THREE.CylinderGeometry(radius, radius, height, 24), hitMaterial);
    zone.position.y = height / 2;
    zone.userData.deckHitZone = true;
    parent.add(zone);
  }

  function makeKnob(radius = 0.14, height = 0.12) {
    const knob = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(radius, radius * 1.04, height, 40), mat.inkMatte);
    body.position.y = height / 2;
    knob.add(body);
    const cap = mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, 0.012, 32), mat.steel);
    cap.position.y = height + 0.005;
    knob.add(cap);
    for (let i = 0; i < 24; i += 1) {
      const ridge = mesh(new THREE.BoxGeometry(0.012, height * 0.8, 0.014), mat.inkGloss);
      const a = (i / 24) * TAU;
      ridge.position.set(Math.cos(a) * radius, height / 2, Math.sin(a) * radius);
      ridge.rotation.y = -a;
      knob.add(ridge);
    }
    const skirt = mesh(new THREE.CylinderGeometry(radius * 1.16, radius * 1.22, 0.018, 40), mat.steel);
    skirt.position.y = 0.009;
    knob.add(skirt);
    const marker = mesh(new THREE.BoxGeometry(0.014, 0.008, radius * 0.55), mat.cream);
    marker.position.set(0, height + 0.012, -radius * 0.42);
    knob.add(marker);
    // The visible cap is intentionally small; the invisible hit cylinder gives a mouse
    // or finger a forgiving target without changing the photographed proportions.
    addHitZone(knob, radius * 1.55, Math.max(0.25, height * 1.8));
    return knob;
  }

  const volumeKnob = makeKnob();
  volumeKnob.position.set(1.28, 0, 0.98);
  add(volumeKnob, { control: "volume" });

  const toneKnob = makeKnob();
  toneKnob.position.set(1.92, 0, 0.98);
  add(toneKnob, { control: "tone" });

  const startButton = new THREE.Group();
  let startCap: any = null;
  startButton.position.set(1.94, 0, 0.3);
  {
    const base = mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.03, 32), mat.steel);
    base.position.y = 0.015;
    startButton.add(base);
    startCap = mesh(new THREE.CylinderGeometry(0.072, 0.078, 0.075, 32), mat.inkGloss);
    startCap.position.y = 0.062;
    startCap.name = "deck-start-cap";
    startButton.add(startCap);
    addHitZone(startButton, 0.16, 0.22);
  }
  add(startButton, { control: "start" });

  /** The pilot lamp. Brightens with the motor rather than switching. */
  const pilotMaterial = createSurface({ color: PILOT_DARK, gloss: 30, specular: 0.2, rim: 0.1 });
  const pilotDark = screenColor(PILOT_DARK);
  const pilotLit = screenColor(PILOT_LIT);
  const pilot = mesh(new THREE.SphereGeometry(0.02, 14, 14), pilotMaterial);
  pilot.position.set(1.94, 0.012, 0.7);
  pilot.scale.y = 0.5;
  add(pilot);
  {
    const bezel = place(mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 20), mat.chrome), 1.94, 0.008, 0.7);
    bezel.rotation.x = Math.PI / 2;
    add(bezel);
  }

  const speedKnob = new THREE.Group();
  speedKnob.position.set(-1.58, 0, 1.1);
  {
    const base = mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.016, 32), mat.steel);
    base.position.y = 0.008;
    speedKnob.add(base);
    const body = mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.11, 32), mat.aluminium);
    body.position.y = 0.055;
    speedKnob.add(body);
    const marker = mesh(new THREE.BoxGeometry(0.012, 0.006, 0.07), mat.coral);
    marker.position.set(0, 0.113, -0.035);
    speedKnob.add(marker);
    addHitZone(speedKnob, 0.18, 0.23);
  }
  add(speedKnob, { control: "speed" });

  /** A label printed flat on the deck. */
  function addDecal(source: HTMLCanvasElement, width: number, x: number, z: number) {
    const height = (width * source.height) / source.width;
    const decal = mesh(
      new THREE.PlaneGeometry(width, height),
      createSurface({ color: "#ffffff", map: source, transparent: true, depthWrite: false, unlit: true }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(x, 0.0032, z);
    group.add(decal);
    return decal;
  }

  addDecal(controlDecal("VOLUME", ["MIN", "MAX"]), 0.62, 1.28, 0.93);
  addDecal(controlDecal("TONE", ["LO", "HI"]), 0.62, 1.92, 0.93);
  addDecal(controlDecal("START / STOP"), 0.56, 1.94, 0.555);
  addDecal(speedDecal(), 0.14, -1.86, 1.1);

  // The nameplate on the front edge.
  {
    const plate = mesh(new THREE.PlaneGeometry(1.5, 0.44), mat.plate);
    plate.position.set(0.12, -0.245, 1.664);
    add(plate);
  }

  // Deck screws.
  ([
    [-2.2, -1.5],
    [2.2, -1.5],
    [-2.2, 1.5],
    [2.2, 1.5],
  ] as const).forEach(([x, z]) => {
    add(place(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), mat.steel), x, 0.004, z));
  });

  /* ------------------------------------------------------------------ */
  /* Lid                                                                 */
  /* ------------------------------------------------------------------ */
  /*
   * The captured machine stood with its lid open, and that open plane is half the
   * silhouette in the framing player mode composes. Dropping the machine without
   * replacing the lid would not read as a better deck, it would read as a deck with
   * something missing — so this is here, in smoked acrylic rather than black plastic.
   */
  {
    const lid = new THREE.Group();
    lid.position.set(0, 0.06, -1.62);
    // Smoked, and it has to stay smoked. The pane is the largest single surface on the
    // machine and it sits between the camera and everything worth looking at, so a bright
    // one does not read as a lid — it reads as a sheet of paper standing in the shot.
    const smoked = createSurface({
      color: "#241f18",
      gloss: 120,
      specular: 0.22,
      rim: 0.28,
      opacity: 0.5,
      transparent: true,
      depthWrite: false,
    });
    const pane = mesh(new THREE.BoxGeometry(4.66, 3.2, 0.035), smoked);
    pane.position.set(0, 1.6, 0);
    lid.add(pane);

    const frameMaterial = mat.inkMatte;
    ([
      [0, 3.2, 4.66, 0.09],
      [0, 0.02, 4.66, 0.09],
    ] as const).forEach(([x, y, w, h]) => {
      const bar = mesh(new THREE.BoxGeometry(w, h, 0.055), frameMaterial);
      bar.position.set(x, y, 0);
      lid.add(bar);
    });
    ([-2.33, 2.33] as const).forEach((x) => {
      const bar = mesh(new THREE.BoxGeometry(0.09, 3.2, 0.055), frameMaterial);
      bar.position.set(x, 1.6, 0);
      lid.add(bar);
    });

    // Open, and leaning back the way a sprung hinge holds one.
    lid.rotation.x = -0.30;
    add(lid);
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  const PLATTER_RPM = { lp: 33 + 1 / 3, single: 45 };
  let spinning = false;
  let targetRpm = PLATTER_RPM.lp;
  let currentRpm = PLATTER_RPM.lp;
  let spinRate = 0;
  let spinAngle = 0;

  let armTarget: number | null = null;
  let armYaw = REST_ANGLE;
  let armYawGoal = REST_ANGLE;
  /** 0 on the record, 1 clear of it. The arm never swings while it is down. */
  let lift = 1;

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sideKey = (side: DeckRecordSide) => side.id ?? `${side.title}\n${side.artist}`;
  let activeSide: DeckRecordSide | null = null;
  let pendingSide: DeckRecordSide | null = null;
  let pendingArtwork: HTMLImageElement | null = null;
  let artworkRequest = 0;
  let swapping = false;
  let swapElapsed = 0;
  let swapLabelApplied = false;
  let rigDisposed = false;

  const applyLabelTexture = (side: DeckRecordSide, artwork: HTMLImageElement | null = null) => {
    const previous = labelMaterial.uniforms.uMap.value;
    labelMaterial.uniforms.uMap.value = canvasTexture(recordLabel({ ...side, artwork }));
    if (previous && previous !== blank) {
      owned.textures.delete(previous);
      previous.dispose();
    }
  };

  const prepareArtwork = (side: DeckRecordSide) => {
    artworkRequest += 1;
    const request = artworkRequest;
    pendingArtwork = null;
    if (!side.artwork) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      if (rigDisposed || request !== artworkRequest) return;
      pendingArtwork = image;
      // Provider metadata often arrives after the initial text label. In that case the
      // record is already down, so the photograph can be printed in place without
      // replaying the whole lift/drop sequence.
      if ((!swapping || swapLabelApplied) && activeSide && sideKey(activeSide) === sideKey(side)) {
        applyLabelTexture(side, image);
      }
    };
    image.onerror = () => {
      if (request === artworkRequest) pendingArtwork = null;
    };
    image.src = side.artwork;
  };

  const setLabel = (side: DeckRecordSide) => {
    const sameSide = activeSide && sideKey(activeSide) === sideKey(side);
    if (!activeSide || sameSide || reducedMotion) {
      activeSide = side;
      pendingSide = null;
      swapping = false;
      swapElapsed = 0;
      disc.position.y = 0;
      disc.rotation.z = 0;
      prepareArtwork(side);
      applyLabelTexture(side);
      return;
    }

    // The source animation parks the arm, stops the motor, lifts the pressing, swaps
    // the label at the top and lets it land with a small bounce. Keep those beats and
    // timings even though this deck is embedded in the larger room renderer.
    pendingSide = side;
    prepareArtwork(side);
    swapping = true;
    swapElapsed = 0;
    swapLabelApplied = false;
  };
  applyLabelTexture({ title: "Side A", artist: "Gallo", color: DECK_PALETTE.coral });

  let volumeGoal = 0.8;
  let toneGoal = 0.5;
  let speedRotationGoal = 0;
  let startPressElapsed = -1;
  let hoveredControl: DeckControlId | null = null;

  const rpmToRadians = (rpm: number) => (rpm * TAU) / 60;
  const spinQuaternion = new THREE.Quaternion();
  const spinAxis = new THREE.Vector3(0, 1, 0);

  const update = (delta: number) => {
    if (swapping) {
      swapElapsed += delta;
      if (swapElapsed >= 0.55 && swapElapsed < 1.25) {
        const t = THREE.MathUtils.clamp((swapElapsed - 0.55) / 0.7, 0, 1);
        const eased = t * t;
        disc.position.y = 1.15 * eased;
        disc.rotation.z = 0.1 * eased;
      } else if (swapElapsed >= 1.25) {
        disc.position.y = 1.15;
        disc.rotation.z = 0.1;
      }

      if (!swapLabelApplied && swapElapsed >= 1.3 && pendingSide) {
        activeSide = pendingSide;
        applyLabelTexture(activeSide, pendingArtwork);
        swapLabelApplied = true;
      }

      if (swapElapsed >= 1.35) {
        const t = THREE.MathUtils.clamp((swapElapsed - 1.35) / 0.55, 0, 1);
        disc.rotation.z = 0.1 * (1 - (1 - (1 - t) * (1 - t)));
      }
      if (swapElapsed >= 1.4) {
        const t = THREE.MathUtils.clamp((swapElapsed - 1.4) / 0.75, 0, 1);
        // Robert Penner's bounce-out, inverted so the record drops from 1.15 to zero.
        let bounce: number;
        if (t < 1 / 2.75) bounce = 7.5625 * t * t;
        else if (t < 2 / 2.75) {
          const u = t - 1.5 / 2.75;
          bounce = 7.5625 * u * u + 0.75;
        } else if (t < 2.5 / 2.75) {
          const u = t - 2.25 / 2.75;
          bounce = 7.5625 * u * u + 0.9375;
        } else {
          const u = t - 2.625 / 2.75;
          bounce = 7.5625 * u * u + 0.984375;
        }
        disc.position.y = 1.15 * (1 - bounce);
      }
      if (swapElapsed >= 2.15) {
        disc.position.y = 0;
        disc.rotation.z = 0;
        swapping = false;
        swapElapsed = 0;
        pendingSide = null;
      }
    }

    // A real platter takes a moment to reach speed, and the eye notices when it does not.
    currentRpm += (targetRpm - currentRpm) * Math.min(1, delta * 4);
    const motorRunning = spinning && !swapping;
    const wanted = motorRunning ? rpmToRadians(currentRpm) : 0;
    spinRate += (wanted - spinRate) * Math.min(1, delta * (motorRunning ? 1.6 : 2.4));
    spinAngle = (spinAngle + spinRate * delta) % TAU;
    spinQuaternion.setFromAxisAngle(spinAxis, spinAngle);
    platter.quaternion.copy(spinQuaternion);

    // The arm lifts before it swings and sets down after, which is the whole reason the
    // motion reads as a machine rather than as a needle sliding across a record.
    const effectiveArmTarget = swapping ? null : armTarget;
    const goal = effectiveArmTarget === null
      ? REST_ANGLE
      : LEADIN_ANGLE + (RUNOUT_ANGLE - LEADIN_ANGLE) * THREE.MathUtils.clamp(effectiveArmTarget, 0, 1);
    armYawGoal = goal;
    // The GLM study writes the progress angle every playing frame. Preserve that
    // continuous inward crawl while the stylus is down; only a real jump — cueing,
    // parking or seeking — earns the lift / swing / drop sequence.
    const onRecord = effectiveArmTarget !== null;
    const wantsLift = !onRecord || Math.abs(armYawGoal - armYaw) > 0.035;
    lift += ((wantsLift ? 1 : 0) - lift) * (reducedMotion ? 1 : Math.min(1, delta * 5));
    if (!wantsLift) {
      // Tracking is supposed to happen on the groove. The old branch only allowed yaw
      // while `lift > .6`, so once the needle had landed it could never move again.
      armYaw += (armYawGoal - armYaw) * (reducedMotion ? 1 : Math.min(1, delta * 7));
    } else if (lift > 0.6 || reducedMotion) {
      // A large move still waits until the stylus is clear of the pressing.
      armYaw += (armYawGoal - armYaw) * (reducedMotion ? 1 : Math.min(1, delta * 2.4));
    }
    armLift.rotation.y = armYaw;
    armTube.rotation.x = THREE.MathUtils.lerp(ELEV_DOWN, ELEV_UP, lift);
    armLever.rotation.x = 0.55 * lift;

    volumeKnob.rotation.y += (-(volumeGoal - 0.5) * 4.2 - volumeKnob.rotation.y)
      * (reducedMotion ? 1 : Math.min(1, delta * 12));
    toneKnob.rotation.y += (-(toneGoal - 0.5) * 4.2 - toneKnob.rotation.y)
      * (reducedMotion ? 1 : Math.min(1, delta * 12));
    speedKnob.rotation.y += (speedRotationGoal - speedKnob.rotation.y)
      * (reducedMotion ? 1 : Math.min(1, delta * 9));

    if (startPressElapsed >= 0) {
      startPressElapsed += delta;
      if (startPressElapsed < 0.08) {
        startCap.position.y = THREE.MathUtils.lerp(0.062, 0.045, startPressElapsed / 0.08);
      } else if (startPressElapsed < 0.3) {
        const t = (startPressElapsed - 0.08) / 0.22;
        startCap.position.y = THREE.MathUtils.lerp(0.045, 0.062, 1 - (1 - t) * (1 - t));
      } else {
        startCap.position.y = 0.062;
        startPressElapsed = -1;
      }
    }
    controlGroups.forEach((controlGroup, id) => {
      const wantedScale = hoveredControl === id ? 1.045 : 1;
      const nextScale = THREE.MathUtils.lerp(
        controlGroup.scale.x,
        wantedScale,
        reducedMotion ? 1 : Math.min(1, delta * 14),
      );
      controlGroup.scale.setScalar(nextScale);
    });

    // The lamp comes up with the motor rather than switching with the button.
    const glow = THREE.MathUtils.clamp(Math.abs(spinRate) / rpmToRadians(PLATTER_RPM.lp), 0, 1);
    pilotMaterial.uniforms.uColor.value.copy(pilotDark).lerp(pilotLit, glow);
    pilotMaterial.uniforms.uSpecular.value = 0.2 + glow * 0.6;
  };

  return {
    group,
    controlNodes,
    anchors: {
      platterCentre: PLATTER_POS.clone(),
      bottomY: FOOT_BOTTOM_Y,
      recordTopY: RECORD_TOP_Y,
      recordRadius: RECORD_RADIUS,
    },
    setSpinning: (next) => { spinning = next; },
    setRpm: (rpm) => {
      targetRpm = rpm > 39 ? PLATTER_RPM.single : PLATTER_RPM.lp;
      speedRotationGoal = rpm > 39 ? -0.9 : 0;
    },
    setTonearm: (progress) => { armTarget = progress; },
    setLabel,
    setControlValue: (control, value) => {
      if (control === "volume") volumeGoal = THREE.MathUtils.clamp(value, 0, 1);
      else if (control === "tone") toneGoal = THREE.MathUtils.clamp(value, 0, 1);
      else speedRotationGoal = value > 39 ? -0.9 : 0;
    },
    pressStart: () => { startPressElapsed = 0; },
    setControlHover: (control) => { hoveredControl = control; },
    update,
    dispose: () => {
      rigDisposed = true;
      artworkRequest += 1;
      group.clear();
      owned.geometries.forEach((geometry) => geometry.dispose());
      owned.materials.forEach((material) => material.dispose());
      owned.textures.forEach((texture) => texture.dispose());
      owned.geometries.clear();
      owned.materials.clear();
      owned.textures.clear();
      controlNodes.length = 0;
    },
  };
}
