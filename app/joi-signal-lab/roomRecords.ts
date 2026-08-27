import * as THREE from "three";
import { sanitizeNodeName } from "./roomBase";

/**
 * The record on the turntable, and the platter it turns on.
 *
 * The capture already contains four pressings: three hanging on the wall and a fourth
 * lying on the platter. That fourth one is the whole trick — it is a measurement of
 * where a record sits when it is playing, so docking is not a pose anyone had to
 * invent. A wall record is carried to the platter, turns flat on the way, and lands on
 * the pose the fourth record was authored at; the fourth then steps aside until the
 * platter is empty again.
 *
 * Each record is two meshes — the pressing and its label — so both are attached to one
 * group and the group is the thing that moves. `attach` rather than `add`, because the
 * meshes arrive with their own world transforms and reparenting must not move them.
 */

export type RecordId = "record-1" | "record-2" | "record-3";

export const RECORD_IDS: RecordId[] = ["record-1", "record-2", "record-3"];

/** Wall records, top to bottom, and the mix each one plays. */
const RECORD_NODES: Record<RecordId, { disk: string; label: string }> = {
  "record-1": { disk: "Vinyl 1", label: "Vinyl face 1" },
  "record-2": { disk: "Vinyl 2", label: "Vinyl face 2" },
  "record-3": { disk: "Vinyl 3", label: "Vinyl face 3" },
};

/** The pressing the capture left on the platter; it stands in for an empty deck. */
const PLATTER_NODES = { disk: "Vinyl 4", label: "Vinyl face 4" };

/** Revolutions per minute to radians per second. */
const rpmToRadians = (rpm: number) => (rpm * 2 * Math.PI) / 60;
/** The two speeds a deck like this actually has. */
export const PLATTER_RPM = { lp: 33 + 1 / 3, single: 45 } as const;

/** How close to the platter centre a release has to land to count as docking. */
const DOCK_RADIUS = 3.4;

/** A wall record's disc faces the room; on the platter it faces up. */
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

type Record3D = {
  id: RecordId;
  group: any;
  homePosition: any;
  homeQuaternion: any;
  /** Where the record is settling to, kept apart from the platter spin. */
  settle: any;
  meshes: any[];
};

export type RecordRig = {
  /** Meshes a pointer can grab, for the room's raycaster. */
  pickables: any[];
  /** Which record a hit mesh belongs to, or null. */
  recordFor: (object: any) => RecordId | null;
  grab: (id: RecordId, camera: any) => void;
  /** Carry the held record along the view ray, easing onto the deck as it nears it. */
  moveTo: (ray: any, camera: any) => void;
  /** Let go. Returns the record and whether it landed on the platter. */
  release: () => { id: RecordId; docked: boolean } | null;
  held: () => RecordId | null;
  docked: () => RecordId | null;
  setSpinning: (spinning: boolean) => void;
  /** 33⅓ or 45. The platter eases between them rather than jumping. */
  setRpm: (rpm: number) => void;
  update: (delta: number) => void;
};

export function createRecordRig(model: any): RecordRig | null {
  // Everything below converts between the capture's world space and its local space, and
  // both `worldToLocal` and `attach` read `model.matrixWorld` to do it. At this point in
  // the load that matrix has not necessarily been computed, and a stale one silently
  // yields a platter centre several units from the platter — which is how the record
  // ended up parked outside the frustum, culled, and apparently deleted.
  model.updateMatrixWorld(true);

  const platterDisk = model.getObjectByName(sanitizeNodeName(PLATTER_NODES.disk));
  const platterLabel = model.getObjectByName(sanitizeNodeName(PLATTER_NODES.label));
  if (!platterDisk) return null;

  const platterCentre = new THREE.Box3().setFromObject(platterDisk).getCenter(new THREE.Vector3());
  model.worldToLocal(platterCentre);

  const records: Record3D[] = [];
  const pickables: any[] = [];
  const byMesh = new Map<any, RecordId>();

  /*
   * The three wall pressings are retired. In the close framing the deck is played at
   * they hung off the top edge of the shot — visible only if the window was tall enough
   * to catch them, which read as three records floating in the nav rather than as three
   * records on a wall. Choosing a side now happens on the console's shelf, so carrying
   * one across the desk no longer had a job either.
   *
   * They are hidden rather than deleted: the geometry is baked into the capture and its
   * lightmap, so removing the meshes would leave holes in the wall behind them.
   */
  for (const id of RECORD_IDS) {
    const names = RECORD_NODES[id];
    const disk = model.getObjectByName(sanitizeNodeName(names.disk));
    const label = model.getObjectByName(sanitizeNodeName(names.label));
    [disk, label].forEach((node: any) => { if (node) node.visible = false; });
  }

  const byId = new Map(records.map((record) => [record.id, record]));
  let heldId: RecordId | null = null;
  let dockedId: RecordId | null = null;
  let grabDistance = 0;
  /** How near the last carry ray passed the platter, in world units. */
  let platterMiss = Infinity;
  let spinning = false;
  let targetRpm: number = PLATTER_RPM.lp;
  // A real platter takes a moment to come up to speed, and the ear notices when it does
  // not: switching 33 to 45 is a glide, not a jump.
  let currentRpm = PLATTER_RPM.lp;
  let spinAngle = 0;

  /** Where each record is heading, and how far along it is. */
  const targetPosition = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const spinQuaternion = new THREE.Quaternion();
  const worldUp = new THREE.Vector3(0, 1, 0);

  const setPlatterVisible = (visible: boolean) => {
    platterDisk.visible = visible;
    if (platterLabel) platterLabel.visible = visible;
  };

  /*
   * Spinning the record in place, without touching the scene graph.
   *
   * The first attempt reparented the two pressing meshes under a group at the platter's
   * centre, which meant converting that centre from world space into the capture's local
   * space — and the capture's own matrix is not current this early in the load, so the
   * group landed several units away, took the record outside the frustum, and the record
   * simply stopped being drawn. Every fix for that was another space conversion with the
   * same failure mode.
   *
   * None of it was necessary: each pressing's geometry is already centred on its own
   * origin (bounding sphere at 0,0,0), so the record turns correctly by rotating about
   * its own axis. Post-multiplying the rest pose applies the rotation in local space, and
   * no world/local conversion is involved anywhere.
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

  const goalFor = (record: Record3D) => {
    if (record.id === heldId) return null;
    if (record.id === dockedId) {
      targetPosition.copy(platterCentre);
      targetQuaternion.copy(FLAT);
    } else {
      targetPosition.copy(record.homePosition);
      targetQuaternion.copy(record.homeQuaternion);
    }
    return true;
  };

  return {
    pickables,
    recordFor: (object: any) => byMesh.get(object) ?? null,

    grab: (id, camera) => {
      const record = byId.get(id);
      if (!record) return;
      heldId = id;
      if (dockedId === id) {
        dockedId = null;
        setPlatterVisible(true);
      }
      const world = record.group.getWorldPosition(new THREE.Vector3());
      grabDistance = camera.position.distanceTo(world);
      platterMiss = Infinity;
      // A held record draws over the desk it is being carried across.
      record.meshes.forEach((mesh: any) => { mesh.renderOrder = 2; });
    },

    moveTo: (ray, camera) => {
      const record = heldId ? byId.get(heldId) : null;
      if (!record) return;

      // What decides a drop is whether the pointer is over the deck, not whether the
      // record has been dragged to the deck's exact depth — carrying at a fixed
      // distance from the camera is what a hand does, and the ray's closest approach to
      // the platter is what the eye reads as "over it". So that miss distance drives
      // both the landing test and the carry: the record eases onto the deck's own depth
      // and turns flat as the miss closes, and arrives already lying the right way.
      const platterWorld = model.localToWorld(platterCentre.clone());
      platterMiss = ray.distanceToPoint(platterWorld);
      const nearness = 1 - THREE.MathUtils.clamp(platterMiss / (DOCK_RADIUS * 2), 0, 1);
      const distance = THREE.MathUtils.lerp(
        grabDistance,
        camera.position.distanceTo(platterWorld),
        nearness,
      );

      const world = camera.position.clone().addScaledVector(ray.direction, distance);
      record.group.position.copy(model.worldToLocal(world));
      record.settle.copy(record.homeQuaternion).slerp(FLAT, nearness);
      record.group.quaternion.copy(record.settle);
    },

    release: () => {
      const record = heldId ? byId.get(heldId) : null;
      heldId = null;
      if (!record) return null;
      record.meshes.forEach((mesh: any) => { mesh.renderOrder = 0; });
      const landed = platterMiss <= DOCK_RADIUS;
      platterMiss = Infinity;
      if (landed) {
        // One record on the deck at a time; whatever was there goes back to the wall.
        dockedId = record.id;
        spinAngle = 0;
        setPlatterVisible(false);
      }
      return { id: record.id, docked: landed };
    },

    held: () => heldId,
    docked: () => dockedId,
    setSpinning: (next) => { spinning = next; },
    setRpm: (rpm) => { targetRpm = rpm; },

    update: (delta) => {
      currentRpm += (targetRpm - currentRpm) * Math.max(0, Math.min(1, delta * 3.2));
      if (spinning) spinAngle += rpmToRadians(currentRpm) * delta;
      // The record on the platter turns whenever the deck is playing, whether or not
      // anything was ever carried to it — which is what the console does.
      platterParts.forEach(({ mesh, axis, rest }) => {
        spinQuaternion.setFromAxisAngle(axis, spinAngle);
        mesh.quaternion.copy(rest).multiply(spinQuaternion);
      });
      records.forEach((record) => {
        if (!goalFor(record)) return;
        record.group.position.lerp(targetPosition, 0.16);
        // The settle rotation and the platter spin are kept apart on purpose: composing
        // them into one quaternion and easing that would make each frame ease away from
        // the spin it just applied, and the record would judder instead of turning.
        record.settle.slerp(targetQuaternion, 0.16);
        if (record.id === dockedId) {
          spinQuaternion.setFromAxisAngle(worldUp, spinAngle);
          record.group.quaternion.copy(record.settle).premultiply(spinQuaternion);
        } else {
          record.group.quaternion.copy(record.settle);
        }
      });
    },
  };
}
