import * as THREE from "three";
import { sanitizeNodeName } from "./roomBase";
import { createSurfaceMaterial } from "./roomSurface";

/**
 * The basketball that stands where the capture's guitar stood.
 *
 * The capture came with a guitar leaning in a stand at the open end of the desk. The
 * room is a portrait of its owner and that owner plays ball rather than guitar, so the
 * corner is a basketball now — built in code, like the deck, because a ball is eight
 * panels and a seam pattern and nothing a photograph would say better.
 *
 * ## Both meshes go, not just the guitar
 *
 * The stand is `polySurface7_standardSurface1_0.001`, which the capture does not name as
 * one. It was read off its own geometry rather than guessed: a 3.6 × 3.6 base on the
 * floor at y −1.61, a 0.34-wide pole, and a 1.3 × 1.2 cradle at y 4.75–5.66 — and the
 * guitar's neck sits at x 3.40–3.82, z 4.89–5.48, inside that cradle's footprint. It is
 * a guitar stand holding a guitar. Hiding only the guitar would leave the stand holding
 * nothing, which reads as a bug rather than as a room.
 *
 * ## Hidden, never deleted
 *
 * Same reason as `roomPlatter.ts`: the geometry is baked into the capture and its
 * lightmap. Hiding is the retirement; dropping these names would put the guitar back.
 * The floor's own bake carries no strong contact shadow under either mesh — the `env`
 * atlas is a soft gradient with one small mark elsewhere in the room — so nothing is
 * left behind on the floor when they go. The ball brings its own.
 */

/** The guitar, and the stand it leans in. */
const RETIRED_GUITAR_NODES = ["guitar", "polySurface7_standardSurface1_0.001"];

/** What the guitar corner occupied, measured off the meshes on the way out. */
export type GuitarSlot = {
  /** Centre of the stand's floor base, in the capture's own coordinates. */
  centre: any;
  /** The floor the stand takes its weight on. */
  floorY: number;
};

/**
 * Hide the guitar and its stand, and report the floor they leave behind.
 *
 * Returns `null` if the capture no longer has them, which is the signal not to build a
 * ball for a corner that is not there.
 */
export function retireCapturedGuitar(model: any): GuitarSlot | null {
  const stand = model.getObjectByName(sanitizeNodeName("polySurface7_standardSurface1_0.001"));
  const guitar = model.getObjectByName(sanitizeNodeName("guitar"));
  if (!stand || !guitar) return null;

  const standBounds = new THREE.Box3().setFromObject(stand);
  const centre = standBounds.getCenter(new THREE.Vector3());

  for (const name of RETIRED_GUITAR_NODES) {
    const node = model.getObjectByName(sanitizeNodeName(name));
    if (node) node.visible = false;
  }

  return { centre, floorY: standBounds.min.y };
}

/**
 * A size 7 ball against a twelve-inch record.
 *
 * The room is not to scale with itself — the capture's guitar is a third the size a
 * guitar would be beside its own desk — so the ball is sized off the one object in the
 * shot whose real dimension is exact and which a reader already knows: the pressing the
 * capture left on the platter. `roomTurntable.ts` sets the deck's scale the same way,
 * from the same record, which is what keeps the two code-built objects agreeing.
 */
const BALL_DIAMETER_M = 0.242;
const RECORD_DIAMETER_M = 0.305;
export const ballRadiusFromRecord = (recordRadius: number) =>
  recordRadius * (BALL_DIAMETER_M / RECORD_DIAMETER_M);

/**
 * The ball's own colours, as screen numbers.
 *
 * Not a photograph of leather: two oranges and a near-black, the same register the deck
 * is painted in. `roomSurface.ts` shades them.
 */
const LEATHER = "#c85f22";
const LEATHER_LIT = "#e07a35";
const LEATHER_SHADE = "#94400f";
const SEAM = "#171008";

/** Equirectangular, so `SphereGeometry`'s own UVs land it without a remap. */
const SKIN_WIDTH = 1024;
const SKIN_HEIGHT = 512;

/**
 * The skin: eight panels, and the pebbling that makes it rubber.
 *
 * The seam pattern is the real one, stated in the map's own coordinates. Two great
 * circles through the poles read as four evenly spaced vertical lines here — a meridian
 * pair half a turn apart is one circle — and the wavy seam that divides each lune in two
 * is a sine completing two cycles, so it crosses every vertical line at the same height
 * and the eight panels come out equal. Drawing it straight would give a beach ball.
 */
function ballSkin(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN_WIDTH;
  canvas.height = SKIN_HEIGHT;
  const context = canvas.getContext("2d")!;

  // Base leather, warmer along the top of the map so the ball is not one flat orange
  // before the shading model has said anything about it.
  const wash = context.createLinearGradient(0, 0, 0, SKIN_HEIGHT);
  wash.addColorStop(0, LEATHER_LIT);
  wash.addColorStop(0.55, LEATHER);
  wash.addColorStop(1, LEATHER_SHADE);
  context.fillStyle = wash;
  context.fillRect(0, 0, SKIN_WIDTH, SKIN_HEIGHT);

  /*
   * Pebbling. A fixed lattice with a jitter rather than `Math.random` over the whole
   * field: an even spacing is what a moulded ball has, and it also means the dimples do
   * not clump into blotches that read as dirt at the size this ball is on screen.
   */
  const step = 7;
  for (let y = step * 0.5; y < SKIN_HEIGHT; y += step) {
    // The map is stretched hardest at the poles, so thin the dots out towards them and
    // the density stays even on the sphere instead of turning solid at top and bottom.
    const latitude = y / SKIN_HEIGHT;
    const squeeze = Math.max(0.12, Math.sin(latitude * Math.PI));
    for (let x = step * 0.5; x < SKIN_WIDTH; x += step / squeeze) {
      const jx = x + Math.sin(x * 12.9898 + y * 78.233) * 1.6;
      const jy = y + Math.sin(x * 39.346 + y * 11.135) * 1.6;
      const shade = 0.5 + Math.sin(x * 4.1 + y * 7.7) * 0.5;
      context.fillStyle = shade > 0.5 ? "rgba(255,196,150,0.16)" : "rgba(60,24,6,0.20)";
      context.beginPath();
      context.arc(jx, jy, 1.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.strokeStyle = SEAM;
  context.lineCap = "round";
  context.lineJoin = "round";

  // Two great circles through the poles: four meridians, a quarter turn apart.
  context.lineWidth = 7;
  for (let i = 0; i < 4; i += 1) {
    const x = (SKIN_WIDTH / 4) * i + SKIN_WIDTH / 8;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, SKIN_HEIGHT);
    context.stroke();
  }

  // The wavy seam, two cycles around, crossing each meridian on the equator.
  context.lineWidth = 8;
  context.beginPath();
  for (let x = 0; x <= SKIN_WIDTH; x += 4) {
    const phase = (x / SKIN_WIDTH) * Math.PI * 4;
    const y = SKIN_HEIGHT * 0.5 + Math.sin(phase) * SKIN_HEIGHT * 0.17;
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  return canvas;
}

/** The mark the ball leaves on the floor, since the room has no lights to cast one. */
function contactShadow(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(0,0,0,0.30)");
  gradient.addColorStop(0.35, "rgba(0,0,0,0.14)");
  gradient.addColorStop(0.72, "rgba(0,0,0,0.03)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return canvas;
}

export type BallRig = {
  /**
   * Add this to the room. Authored with the ball resting on y = 0, so the caller only
   * has to know where the floor is.
   */
  group: any;
  dispose: () => void;
};

export function createRoomBasketball(radius: number): BallRig {
  const geometries: any[] = [];
  const materials: any[] = [];
  const textures: any[] = [];

  const texture = (canvas: HTMLCanvasElement) => {
    const made = new THREE.CanvasTexture(canvas);
    // Deliberately no `colorSpace`: sampled raw, to sit in the same space as the bake.
    made.anisotropy = 8;
    made.wrapS = THREE.RepeatWrapping;
    made.wrapT = THREE.ClampToEdgeWrapping;
    textures.push(made);
    return made;
  };

  const group = new THREE.Group();
  group.name = "about-room-ball-corner";

  const ballGeometry = new THREE.SphereGeometry(radius, 48, 32);
  const ballMaterial = createSurfaceMaterial({
    map: texture(ballSkin()),
    // Rubber, not leather polish: a wide, weak sheen and a little rim so the silhouette
    // does not go flat against the dark floor behind it.
    gloss: 9,
    specular: 0.1,
    rim: 0.1,
  });
  geometries.push(ballGeometry);
  materials.push(ballMaterial);
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  // The hotspot's node, so `BASE_HOTSPOT_NODES` can name it the way it names captured
  // meshes. It is the ball rather than the group on purpose: the hover affordance lifts
  // whatever it is given, and a ball that lifts off the floor while its shadow stays
  // where it was is the whole affordance. Lifting the group would carry the shadow up
  // with it.
  ball.name = "about-room-basketball";
  ball.position.y = radius;
  // A ball is never sitting square to the room. A quarter off both axes puts a seam
  // crossing towards the camera rather than a panel's blank middle.
  ball.rotation.set(0.32, 0.78, 0.12);
  group.add(ball);

  const shadowGeometry = new THREE.PlaneGeometry(radius * 3.1, radius * 3.1);
  const shadowMaterial = createSurfaceMaterial({
    map: texture(contactShadow()),
    color: "#000000",
    transparent: true,
    depthWrite: false,
    // A mark on the floor, not a surface of its own — shading it would lift it to grey.
    unlit: true,
  });
  geometries.push(shadowGeometry);
  materials.push(shadowMaterial);
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  // Clear of the floor by a hair, so it does not fight the bake for the same depth.
  shadow.position.y = radius * 0.01;
  shadow.renderOrder = 1;
  group.add(shadow);

  return {
    group,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((entry) => entry.dispose());
    },
  };
}
