import * as THREE from "three";
import { sanitizeNodeName } from "./roomBase";

/**
 * The platter, and the three pressings that are not on it.
 *
 * The capture contains four records: three hanging on the wall and a fourth lying on
 * the platter. There used to be a rig here for carrying a wall record across the desk
 * and docking it — grab, carry along the view ray, turn flat as it neared the deck,
 * land on the pose the fourth record was authored at.
 *
 * It is gone, and the three wall pressings are retired with it. In the close framing
 * the deck is played at, they hung off the top edge of the shot — visible only if the
 * window happened to be tall enough to catch them, which read as three records floating
 * in the nav rather than as three records on a wall. Choosing a side happens on the
 * console's shelf now, so carrying one across the desk had no job left either.
 *
 * They are hidden rather than deleted: the geometry is baked into the capture and its
 * lightmap, so removing the meshes would leave holes in the wall behind them. Which is
 * why this module still knows their names — hiding them is the retirement, and dropping
 * this loop would hang them back on the wall.
 *
 * What is left is the part that was always live: the record on the platter turns while
 * the deck plays, at whichever of the two speeds the console is set to.
 */

/** The wall pressings. Named here only so they can be kept out of the shot. */
const RETIRED_RECORD_NODES = [
  { disk: "Vinyl 1", label: "Vinyl face 1" },
  { disk: "Vinyl 2", label: "Vinyl face 2" },
  { disk: "Vinyl 3", label: "Vinyl face 3" },
];

/** The pressing the capture left on the platter. This is the one that turns. */
const PLATTER_NODES = { disk: "Vinyl 4", label: "Vinyl face 4" };

/** Revolutions per minute to radians per second. */
const rpmToRadians = (rpm: number) => (rpm * 2 * Math.PI) / 60;
/** The two speeds a deck like this actually has. */
export const PLATTER_RPM = { lp: 33 + 1 / 3, single: 45 } as const;

export type PlatterRig = {
  setSpinning: (spinning: boolean) => void;
  /** 33⅓ or 45. The platter eases between them rather than jumping. */
  setRpm: (rpm: number) => void;
  update: (delta: number) => void;
};

export function createPlatterRig(model: any): PlatterRig | null {
  const platterDisk = model.getObjectByName(sanitizeNodeName(PLATTER_NODES.disk));
  const platterLabel = model.getObjectByName(sanitizeNodeName(PLATTER_NODES.label));
  if (!platterDisk) return null;

  for (const names of RETIRED_RECORD_NODES) {
    const disk = model.getObjectByName(sanitizeNodeName(names.disk));
    const label = model.getObjectByName(sanitizeNodeName(names.label));
    [disk, label].forEach((node: any) => { if (node) node.visible = false; });
  }

  let spinning = false;
  let targetRpm: number = PLATTER_RPM.lp;
  // A real platter takes a moment to come up to speed, and the ear notices when it does
  // not: switching 33 to 45 is a glide, not a jump.
  let currentRpm = PLATTER_RPM.lp;
  let spinAngle = 0;
  const spinQuaternion = new THREE.Quaternion();

  /*
   * Spinning the record in place, without touching the scene graph.
   *
   * An earlier attempt reparented the pressing meshes under a group at the platter's
   * centre, which meant converting that centre from world space into the capture's local
   * space — and the capture's own matrix is not current this early in the load, so the
   * group landed several units away, took the record outside the frustum, and the record
   * simply stopped being drawn. Every fix for that was another space conversion with the
   * same failure mode.
   *
   * None of it was necessary: each pressing's geometry is already centred on its own
   * origin, so the record turns correctly by rotating about its own axis.
   * Post-multiplying the rest pose applies the rotation in local space, and no
   * world/local conversion happens anywhere.
   *
   * The axis is measured rather than assumed — it is the flat one, the shortest side of
   * the geometry's bounding box.
   */
  const spinAxisOf = (mesh: any) => {
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    if (size.x <= size.y && size.x <= size.z) return new THREE.Vector3(1, 0, 0);
    if (size.y <= size.x && size.y <= size.z) return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(0, 0, 1);
  };

  const platterParts = [platterDisk, platterLabel].filter(Boolean).map((mesh: any) => ({
    mesh,
    axis: spinAxisOf(mesh),
    rest: mesh.quaternion.clone(),
  }));

  return {
    setSpinning: (next) => { spinning = next; },
    setRpm: (rpm) => { targetRpm = rpm; },

    update: (delta) => {
      currentRpm += (targetRpm - currentRpm) * Math.max(0, Math.min(1, delta * 3.2));
      if (!spinning) return;
      spinAngle += rpmToRadians(currentRpm) * delta;
      platterParts.forEach(({ mesh, axis, rest }) => {
        spinQuaternion.setFromAxisAngle(axis, spinAngle);
        mesh.quaternion.copy(rest).multiply(spinQuaternion);
      });
    },
  };
}
