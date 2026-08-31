import * as THREE from "three";
import { sanitizeNodeName } from "./roomBase";

/**
 * Retiring the capture's own deck, and the records that came with it.
 *
 * The capture contains a turntable and four pressings: three hanging on the wall and a
 * fourth lying on the platter. All of it is out of the shot now, for two different
 * reasons that arrived at different times.
 *
 * **The wall pressings** went first. There used to be a rig here for carrying one across
 * the desk and docking it — grab, carry along the view ray, turn flat as it neared the
 * deck, land on the pose the fourth record was authored at. In the close framing the
 * deck is played at they hung off the top edge of the shot, visible only if the window
 * happened to be tall enough to catch them, which read as three records floating in the
 * nav rather than as three records on a wall. Choosing a side happens on the console's
 * shelf now, so carrying one across the desk had no job left either.
 *
 * **The machine itself** went second, and is replaced rather than merely hidden:
 * `roomTurntable.ts` builds a deck in code and stands it in the same place. The captured
 * one was fine as furniture and thin as a subject, and player mode makes it the subject —
 * a plinth, a lid, four printed shapes for controls, and a record whose baked label reads
 * as a green blob from half a metre away.
 *
 * Everything here is hidden rather than deleted. The geometry is baked into the capture
 * and its lightmap, so removing the meshes would leave holes in the wall and the table
 * behind them. Which is why this module still knows their names: hiding them *is* the
 * retirement, and dropping these loops would put all of it back.
 */

/** The wall pressings, and the one the capture left on the platter. */
const RETIRED_RECORD_NODES = [
  { disk: "Vinyl 1", label: "Vinyl face 1" },
  { disk: "Vinyl 2", label: "Vinyl face 2" },
  { disk: "Vinyl 3", label: "Vinyl face 3" },
  { disk: "Vinyl 4", label: "Vinyl face 4" },
];

/**
 * The captured machine. Every mesh of it, including the lid standing open.
 *
 * The three POWER_DIAL nodes are here because they were missed the first time, and the
 * way they failed is worth keeping: they are the captured deck's power dial and speed
 * light, they do not carry "turntable" in their names, and they are small. Left visible
 * they ended up sealed inside the replacement's plinth with only their tips clear of its
 * top face — two little glass nubs on the case that read as a modelling mistake rather
 * than as the previous machine still being in the room.
 */
const RETIRED_DECK_NODES = [
  "turntable body 1",
  "turntable body 2",
  "turntable body 3",
  "turntable buttons 1",
  "turntable_needle",
  "turntable cover",
  "POWER_DIAL_SPEED_LIGHT_GLASS_Circle",
  "POWER_DIAL_SPEED_LIGHT_GLASS_Circle.105",
  "POWER_DIAL_SPEED_LIGHT_LIGHT_Circle.109",
];

/**
 * What the captured deck occupied, measured off the meshes on the way out.
 *
 * The replacement is placed from these rather than from constants copied into the
 * source, so the two machines cannot drift apart when either the capture or the model
 * changes. `recordRadius` sets the scale — a listener knows how big a twelve-inch record
 * is, and gets it wrong nowhere else — and `tableY` is what the feet stand on.
 */
export type CapturedDeckSlot = {
  /** Centre of the platter, in the capture's own coordinates. */
  centre: any;
  /** The lowest point of the plinth: the table surface it rests on. */
  tableY: number;
  /** Radius of the pressing that was on the platter. */
  recordRadius: number;
};

/**
 * Hide the captured deck and its records, and report the slot they leave behind.
 *
 * Returns `null` when the capture does not contain the deck at all, which is the signal
 * that something upstream has changed and the replacement should not be stood up blind.
 */
export function retireCapturedDeck(model: any): CapturedDeckSlot | null {
  const hide = (name: string) => {
    const node = model.getObjectByName(sanitizeNodeName(name));
    if (node) node.visible = false;
    return node;
  };

  const record = model.getObjectByName(sanitizeNodeName("Vinyl 4"));
  const plinth = model.getObjectByName(sanitizeNodeName("turntable body 1"));
  if (!record || !plinth) return null;

  const recordBounds = new THREE.Box3().setFromObject(record);
  const plinthBounds = new THREE.Box3().setFromObject(plinth);
  const recordSize = recordBounds.getSize(new THREE.Vector3());
  const centre = recordBounds.getCenter(new THREE.Vector3());

  for (const names of RETIRED_RECORD_NODES) {
    hide(names.disk);
    hide(names.label);
  }
  RETIRED_DECK_NODES.forEach(hide);

  return {
    centre,
    tableY: plinthBounds.min.y,
    recordRadius: Math.max(recordSize.x, recordSize.z) / 2,
  };
}

/**
 * Props that share the desk surface with the deck.
 *
 * Only the ones the machine can physically reach: the shelved books and the wall
 * pressings are nowhere near it, and testing every mesh in the capture against the deck
 * on load costs more than it finds.
 */
const DESK_PROPS = [
  "headphones",
  "macbook",
  "StackOfPaper_blinn2_0",
  "camera",
  "film",
  "film.001",
  "pen",
];

/** Anything below this is inside the capture's own tolerance and left alone. */
const CONTACT_EPSILON = 0.004;

/**
 * Sit a captured prop back down on whatever is under it.
 *
 * The capture leaves most of its props a few millimetres clear of the desk, which reads
 * as nothing. The headphones are the one that goes the other way: they are authored
 * ~8mm *into* the table, and at the framing the deck is played at, the near earcup is
 * visibly buried in the surface.
 *
 * Only penetration is corrected, and only vertically. A prop that floats is not wrong
 * enough to be worth moving, and a horizontal correction would be: the room's lighting
 * is baked into the desk atlas, so a prop that slides leaves its own contact shadow
 * behind it.
 */
export function seatPropsOnDesk(model: any): Array<{ name: string; lift: number }> {
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const seated: Array<{ name: string; lift: number }> = [];

  for (const authored of DESK_PROPS) {
    const node = model.getObjectByName(sanitizeNodeName(authored));
    if (!node || !node.visible) continue;

    const box = new THREE.Box3().setFromObject(node);
    const centre = box.getCenter(new THREE.Vector3());
    raycaster.set(new THREE.Vector3(centre.x, box.max.y + 1, centre.z), down);

    // The prop's own geometry is the first thing the ray meets. Skip it and take the
    // first surface underneath that belongs to something else.
    const surface = raycaster.intersectObject(model, true).find((hit: any) => {
      let walker: any = hit.object;
      while (walker) {
        if (walker === node) return false;
        walker = walker.parent;
      }
      return hit.object.visible;
    });
    if (!surface) continue;

    const lift = surface.point.y - box.min.y;
    if (lift <= CONTACT_EPSILON) continue;

    const world = node.getWorldPosition(new THREE.Vector3());
    world.y += lift;
    node.position.copy(node.parent.worldToLocal(world));
    node.updateMatrixWorld(true);
    seated.push({ name: authored, lift });
  }

  return seated;
}

/**
 * Back the replacement deck out of anything it grew into.
 *
 * The deck's scale comes from the record rather than from the plinth, so the machine
 * standing in the slot is larger than the one that left it — wider and deeper — and it
 * reaches into clearance the capture had. The headphones are the casualty: the captured
 * plinth stopped ~21mm short of them, and the replacement's front edge crosses ~18mm
 * past that, straight through the near earcup.
 *
 * The deck moves rather than the prop, for the same reason `seatPropsOnDesk` only moves
 * vertically: the props carry baked contact shadows and the deck carries none. Depth is
 * the axis with room — the machine spans most of the desk's width, and the space it can
 * give back is behind it.
 */
export function clearDeckOfDeskProps(
  model: any,
  deckGroup: any,
  margin: number,
): { shift: number; against: string[] } | null {
  deckGroup.updateWorldMatrix(true, true);
  const deckBox = new THREE.Box3().setFromObject(deckGroup);

  let back = 0;
  let forward = 0;
  const against: string[] = [];

  for (const authored of DESK_PROPS) {
    const node = model.getObjectByName(sanitizeNodeName(authored));
    if (!node || !node.visible) continue;
    const box = new THREE.Box3().setFromObject(node);
    if (!deckBox.intersectsBox(box)) continue;
    against.push(authored);
    // Which side the prop is on decides which way the deck gives way.
    if (box.getCenter(new THREE.Vector3()).z > deckBox.getCenter(new THREE.Vector3()).z) {
      back = Math.min(back, box.min.z - margin - deckBox.max.z);
    } else {
      forward = Math.max(forward, box.max.z + margin - deckBox.min.z);
    }
  }

  if (against.length === 0) return null;
  // A prop on each side would mean the machine no longer fits between them; say so
  // rather than shunting it into the other one.
  if (back < 0 && forward > 0) return { shift: 0, against };

  const shift = back < 0 ? back : forward;
  if (shift === 0) return { shift: 0, against };

  const world = deckGroup.getWorldPosition(new THREE.Vector3());
  world.z += shift;
  deckGroup.position.copy(deckGroup.parent.worldToLocal(world));
  deckGroup.updateMatrixWorld(true);
  return { shift, against };
}
