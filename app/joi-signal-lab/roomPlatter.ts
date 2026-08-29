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

/** The captured machine. Every mesh of it, including the lid standing open. */
const RETIRED_DECK_NODES = [
  "turntable body 1",
  "turntable body 2",
  "turntable body 3",
  "turntable buttons 1",
  "turntable_needle",
  "turntable cover",
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
