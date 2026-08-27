import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { ROOM_OBJECTS, type RoomObjectId } from "./roomObjects";
import { createRecordRig, type RecordId, type RecordRig } from "./roomRecords";
import {
  BASE_ATLAS_EXPOSURE,
  BASE_ATLAS_IDS,
  BASE_HOTSPOT_NODES,
  BASE_NODE_ATLAS,
  BASE_NODE_UV,
  BASE_TRANSFORM,
  type BaseAtlasId,
  sanitizeNodeName,
} from "./roomBase";

/**
 * The About room is the desk study, and nothing else.
 *
 * One Draco-compressed GLB plus the seven baked colour atlases that go with it. The
 * capture carries no materials of its own — the original assigns them at runtime — so
 * the only thing this module adds is the mesh→atlas table from `roomBase.ts`, a camera,
 * and pointer routing. No shell, no props, no second bake, no grade: what renders is
 * what was baked.
 *
 * The scene is renderer-free because `FilmCanvas` draws it twice, into frame 05's 4:3
 * render target and across the full About stage.
 */

export type RoomScene = {
  scene: any;
  frameCamera: any;
  fullCamera: any;
  setFullAspect: (aspect: number) => void;
  update: (timeMs: number, pointer?: { x: number; y: number }) => void;
  raycastAt: (ndc: { x: number; y: number }) => RoomObjectId | null;
  setHover: (id: RoomObjectId | null) => void;
  focus: (id: RoomObjectId | null) => void;
  /**
   * Player mode: the camera leaves its seat at the desk and composes on the turntable,
   * close enough that the platter and the tonearm are the picture. Everything else in
   * the room keeps running behind it.
   */
  setPlayerMode: (on: boolean) => void;
  /** Drag the deck around while in player mode. Deltas are in normalised screen units. */
  orbitPlayer: (dx: number, dy: number) => void;
  resetPlayerOrbit: () => void;
  /**
   * Where the stylus sits. `null` parks the arm off the record; 0 is the outer groove
   * and 1 the run-out next to the label.
   */
  setTonearm: (progress: number | null) => void;
  /** 33⅓ or 45. The platter and the pitch of the music follow it together. */
  setPlatterRpm: (rpm: number) => void;
  /** Start carrying the record under the pointer, if there is one. */
  grabRecordAt: (ndc: { x: number; y: number }) => RecordId | null;
  /** Carry the held record to where the pointer is now. */
  moveRecordTo: (ndc: { x: number; y: number }) => void;
  /** Let go. Returns the record and whether it landed on the turntable. */
  releaseRecord: () => { id: RecordId; docked: boolean } | null;
  /** Turn the platter, or stop it. */
  setRecordSpinning: (spinning: boolean) => void;
  dispose: () => void;
};

const ASSET_VERSION = "desk-base-20260825-1";
const MODEL_URL = `/models/about-room-base.glb?v=${ASSET_VERSION}`;
const DRACO_DECODER_PATH = "/draco/";

const atlasUrl = (id: BaseAtlasId) =>
  `/models/about-room-base/light-day-${id}.webp?v=${ASSET_VERSION}`;

/**
 * Two vertex shaders, because the capture does not agree with itself about which UV set
 * carries the bake: most meshes use TEXCOORD_0, but the chair came in from another
 * source with its own texture UVs there and its atlas layout in TEXCOORD_1. `USE_UV1`
 * is what makes three declare that attribute for a ShaderMaterial.
 */
const BAKED_VERTEX_SHADER: Record<0 | 1, string> = {
  0: /* glsl */ `
    varying vec2 vBakeUv;
    void main() {
      vBakeUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  1: /* glsl */ `
    varying vec2 vBakeUv;
    void main() {
      vBakeUv = uv1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
};

/**
 * The display transform, and only that.
 *
 * The atlases are finished bakes: lighting, bounce and contact shadow are already in
 * the pixels. All that is left is decoding them to scene-linear, an exposure trim per
 * atlas, and a small toe lift so the darkest furniture keeps its form instead of
 * collapsing into silhouette once the page's post chain has had its turn.
 */
const BAKED_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D uBake;
  uniform float uExposure;
  uniform float uLift;
  varying vec2 vBakeUv;
  void main() {
    vec3 baked = max(texture2D(uBake, vBakeUv).rgb, vec3(0.0));
    gl_FragColor = vec4(baked * uExposure + uLift, 1.0);
  }
`;

/** A restrained toe lift, shared by every atlas. */
const BAKE_LIFT = 0.006;

/**
 * Framing.
 *
 * The desk runs along its wall from Z −13 to +3 with the chair pulled out at +X, so the
 * camera stands off that open corner at roughly seated eye height and looks back down
 * the desk. `FRAME_HOME` is the same view pulled in for the reel's 4:3 window.
 */
const FRAME_HOME = new THREE.Vector3(30.0, 15.0, 20.0);
const FULL_HOME = new THREE.Vector3(36.0, 17.5, 26.0);
const HOME_LOOK = new THREE.Vector3(4.2, 5.6, -4.4);
/** How close the camera pulls in when a chip focuses one object. */
const FOCUS_DISTANCE = 11.0;

/*
 * Player mode, all measured off the capture rather than eyeballed.
 *
 * The platter's centre is (4.98, 5.49, -9.40) and the tonearm's bearing is at
 * (3.97, 5.91, -11.35) with a 2.28-long arm. Those three numbers are what set the two
 * stylus angles below: with the bearing 2.20 from the platter centre, the law of
 * cosines puts the outer groove (1.35 from centre) at 19.2 degrees off the parked
 * angle and the run-out (0.50 from centre) at 41.6. The mesh's own origin happens to
 * sit on the bearing, within 0.017, so the arm swings correctly on its own Y axis and
 * needs no reparenting.
 */
const PLAYER_LOOK = new THREE.Vector3(4.92, 5.48, -9.55);
const PLAYER_RADIUS = 6.15;
const PLAYER_AZIMUTH = THREE.MathUtils.degToRad(50.7);
const PLAYER_ELEVATION = THREE.MathUtils.degToRad(41.9);
const PLAYER_FOV = 36;
/** How far a drag can swing the deck before it stops. */
const ORBIT_AZIMUTH_LIMIT = THREE.MathUtils.degToRad(62);
const ORBIT_ELEVATION_MIN = THREE.MathUtils.degToRad(14);
const ORBIT_ELEVATION_MAX = THREE.MathUtils.degToRad(72);
const TONEARM_OUTER = -0.335;
const TONEARM_INNER = -0.726;

export function createRoomScene(): RoomScene {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020810");

  // No lights: direct light, indirect bounce and contact shadow are all in the bake.
  // That keeps the reel target and the full About stage identical and costs no shadow
  // map on a phone.

  const frameCamera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 400);
  frameCamera.position.copy(FRAME_HOME);
  frameCamera.lookAt(HOME_LOOK);

  const fullCamera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  fullCamera.position.copy(FULL_HOME);
  fullCamera.lookAt(HOME_LOOK);

  const modelHost = new THREE.Group();
  scene.add(modelHost);

  const baseRoot = new THREE.Group();
  baseRoot.name = "about-room-base";
  baseRoot.rotation.y = BASE_TRANSFORM.rotationY;
  baseRoot.scale.setScalar(BASE_TRANSFORM.scale);
  baseRoot.position.set(...BASE_TRANSFORM.position);
  modelHost.add(baseRoot);

  let disposed = false;
  let loaded = false;
  let hovered: RoomObjectId | null = null;
  let focused: RoomObjectId | null = null;
  let fullAspect = 16 / 9;

  /** One node that lifts on hover, and the parent-space axis that is world "up" for it. */
  type PickableNode = { node: any; home: any; up: any };
  const pickables = new Map<RoomObjectId, { nodes: PickableNode[]; focus: any }>();
  const interactiveMeshes: any[] = [];
  const ownedTextures: any[] = [];
  let model: any = null;
  let records: RecordRig | null = null;

  const disposeObject = (root: any) => {
    const geometries = new Set<any>();
    const materials = new Set<any>();
    root.traverse((node: any) => {
      if (node.geometry) geometries.add(node.geometry);
      const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
      nodeMaterials.filter(Boolean).forEach((material: any) => materials.add(material));
    });
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
  };

  const textureLoader = new THREE.TextureLoader();
  const loadAtlas = async (id: BaseAtlasId) => {
    const texture = await textureLoader.loadAsync(atlasUrl(id));
    texture.name = `about-room-${id}`;
    // Display-referred WebP in, scene-linear out; the page's post chain owns the one and
    // only encode back to sRGB.
    texture.colorSpace = THREE.SRGBColorSpace;
    // GLB UVs use glTF's texture orientation, the opposite of TextureLoader's default.
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    ownedTextures.push(texture);
    return [id, texture] as const;
  };

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  Promise.all([loader.loadAsync(MODEL_URL), Promise.all(BASE_ATLAS_IDS.map(loadAtlas))])
    .then(([gltf, atlasEntries]: any[]) => {
      if (disposed) {
        disposeObject(gltf.scene);
        ownedTextures.forEach((texture) => texture.dispose());
        return;
      }
      const atlases = new Map<BaseAtlasId, any>(atlasEntries);

      // One material per atlas *and* UV set actually used, built on demand.
      const materials = new Map<string, any>();
      const materialFor = (id: BaseAtlasId, uvChannel: 0 | 1) => {
        const key = `${id}:${uvChannel}`;
        let material = materials.get(key);
        if (!material) {
          material = new THREE.ShaderMaterial({
            name: `About room · ${id}${uvChannel ? " · uv1" : ""}`,
            defines: uvChannel === 1 ? { USE_UV1: "" } : {},
            uniforms: {
              uBake: { value: atlases.get(id) },
              uExposure: { value: BASE_ATLAS_EXPOSURE[id] },
              uLift: { value: BAKE_LIFT },
            },
            vertexShader: BAKED_VERTEX_SHADER[uvChannel],
            fragmentShader: BAKED_FRAGMENT_SHADER,
          });
          material.toneMapped = false;
          materials.set(key, material);
        }
        return material;
      };

      model = gltf.scene;
      model.name = "about-room-desk";
      const placeholders = new Set<any>();
      const unmapped = new Set<string>();
      model.traverse((node: any) => {
        if (!node.isMesh) return;
        node.frustumCulled = true;
        node.castShadow = false;
        node.receiveShadow = false;
        const previous = Array.isArray(node.material) ? node.material : [node.material];
        previous.filter(Boolean).forEach((material: any) => placeholders.add(material));
        const atlas = BASE_NODE_ATLAS[node.name];
        if (!atlas) unmapped.add(node.name);
        node.material = materialFor(atlas ?? "group1", BASE_NODE_UV[node.name] ?? 0);
      });
      placeholders.forEach((material) => material.dispose());
      if (unmapped.size > 0 && process.env.NODE_ENV !== "production") {
        console.warn(`[about-room] meshes with no atlas mapping: ${[...unmapped].join(", ")}`);
      }

      baseRoot.add(model);
      baseRoot.updateMatrixWorld(true);

      const worldUp = new THREE.Vector3(0, 1, 0);
      Object.entries(BASE_HOTSPOT_NODES).forEach(([id, names]) => {
        const nodes = (names ?? []).map((name) => model.getObjectByName(name)).filter(Boolean);
        if (nodes.length === 0) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[about-room] hotspot "${id}" matched no nodes`);
          }
          return;
        }
        const bounds = new THREE.Box3();
        nodes.forEach((node: any) => bounds.expandByObject(node));
        pickables.set(id as RoomObjectId, {
          nodes: nodes.map((node: any) => {
            const up = worldUp.clone();
            if (node.parent) {
              node.parent.worldToLocal(up.add(node.parent.getWorldPosition(new THREE.Vector3())));
            }
            return { node, home: node.position.clone(), up: up.normalize() };
          }),
          focus: bounds.getCenter(new THREE.Vector3()),
        });
        nodes.forEach((node: any) =>
          node.traverse((child: any) => {
            child.userData.roomObject = id;
            if (child.isMesh) interactiveMeshes.push(child);
          }),
        );
      });

      for (const object of ROOM_OBJECTS) {
        if (!pickables.has(object.id) && process.env.NODE_ENV !== "production") {
          console.warn(`[about-room] no geometry bound to hotspot: ${object.id}`);
        }
      }

      records = createRecordRig(model);
      if (!records && process.env.NODE_ENV !== "production") {
        console.warn("[about-room] no turntable found; records are not draggable");
      }

      tonearm = model.getObjectByName(sanitizeNodeName("turntable_needle")) ?? null;
      if (!tonearm && process.env.NODE_ENV !== "production") {
        console.warn("[about-room] no tonearm found; the arm will not drop");
      }

      loaded = true;
    })
    .catch((error: unknown) => {
      ownedTextures.forEach((texture) => texture.dispose());
      console.error("[about-room] GLB or atlas load failed.", error);
    })
    .finally(() => dracoLoader.dispose());

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const lookCurrent = HOME_LOOK.clone();
  const focusPoint = HOME_LOOK.clone();
  const responsiveHome = FULL_HOME.clone();
  const cameraTarget = new THREE.Vector3();
  const cameraHome = new THREE.Vector3();
  const focusHome = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const liftStep = new THREE.Vector3();
  let focusAmount = 0;
  let lastFrameMs = 0;
  let playerMode = false;
  let playerAmount = 0;
  let orbitAzimuth = PLAYER_AZIMUTH;
  let orbitElevation = PLAYER_ELEVATION;
  let tonearmTarget: number | null = null;
  let tonearmAngle = 0;
  let tonearm: any = null;
  const playerHome = new THREE.Vector3();
  const baseHome = new THREE.Vector3();

  const updateResponsiveHome = () => {
    const portraitPullback = fullAspect < 1 ? THREE.MathUtils.lerp(1.42, 1.14, fullAspect) : 1;
    responsiveHome.copy(HOME_LOOK).add(
      FULL_HOME.clone().sub(HOME_LOOK).multiplyScalar(portraitPullback),
    );
  };
  updateResponsiveHome();

  const update = (timeMs: number, pointer?: { x: number; y: number }) => {
    const t = timeMs * 0.001;
    // The scene is driven from a timestamp rather than its own clock, so the record rig
    // gets its delta from the gap between calls — clamped, because a backgrounded tab
    // comes back with a gap long enough to spin a record through several turns at once.
    // Clamped at both ends. The ceiling is for a backgrounded tab coming back with a
    // gap long enough to spin the platter through several turns at once; the floor is
    // because a timestamp that goes backwards makes this negative, and a negative delta
    // runs the platter's rpm easing the wrong way until it diverges to NaN — at which
    // point the record's quaternion is NaN and the record simply stops being drawn.
    const delta = lastFrameMs
      ? Math.max(0, Math.min((timeMs - lastFrameMs) * 0.001, 0.05))
      : 0;
    lastFrameMs = timeMs;
    records?.update(delta);

    pickables.forEach((entry, id) => {
      const lift = hovered === id && !records?.held() ? 0.28 : 0;
      entry.nodes.forEach(({ node, home, up }) => {
        liftStep.copy(home).addScaledVector(up, lift).sub(node.position);
        node.position.addScaledVector(liftStep, reducedMotion ? 1 : 0.14);
      });
    });

    const nextFocus = focused ? pickables.get(focused)?.focus : null;
    if (nextFocus) focusPoint.copy(nextFocus);
    focusAmount += ((nextFocus ? 1 : 0) - focusAmount) * (reducedMotion ? 1 : 0.075);
    cameraTarget.copy(nextFocus ?? HOME_LOOK);
    lookCurrent.lerp(cameraTarget, reducedMotion ? 1 : 0.075);

    cameraDirection.copy(responsiveHome).sub(HOME_LOOK).normalize();
    focusHome.copy(focusPoint).addScaledVector(cameraDirection, FOCUS_DISTANCE);
    cameraHome.copy(responsiveHome).lerp(focusHome, focusAmount * 0.58);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;
    baseHome.set(
      cameraHome.x + px * 1.4,
      cameraHome.y + py * 0.8,
      cameraHome.z - px * 1.1,
    );

    // Player mode rides on top of the ordinary room camera rather than replacing it, so
    // entering and leaving is one blend and the room never cuts.
    playerAmount += ((playerMode ? 1 : 0) - playerAmount) * (reducedMotion ? 1 : 0.09);
    if (playerAmount > 0.001) {
      const cosE = Math.cos(orbitElevation);
      playerHome.set(
        PLAYER_LOOK.x + Math.cos(orbitAzimuth) * cosE * PLAYER_RADIUS,
        PLAYER_LOOK.y + Math.sin(orbitElevation) * PLAYER_RADIUS,
        PLAYER_LOOK.z + Math.sin(orbitAzimuth) * cosE * PLAYER_RADIUS,
      );
      baseHome.lerp(playerHome, playerAmount);
      lookCurrent.lerp(PLAYER_LOOK, playerAmount);
      const fov = THREE.MathUtils.lerp(fullAspect < 1 ? 38 : 30, PLAYER_FOV, playerAmount);
      if (Math.abs(fullCamera.fov - fov) > 0.01) {
        fullCamera.fov = fov;
        fullCamera.updateProjectionMatrix();
      }
    }

    fullCamera.position.copy(baseHome);
    fullCamera.lookAt(lookCurrent);

    // The arm parks itself when nothing is playing and tracks inward while it is. The
    // ease is the same everywhere else in this room: a fixed fraction per frame, or an
    // instant snap when the reader has asked for less motion.
    const armTarget = tonearmTarget === null
      ? 0
      : THREE.MathUtils.lerp(TONEARM_OUTER, TONEARM_INNER, THREE.MathUtils.clamp(tonearmTarget, 0, 1));
    tonearmAngle += (armTarget - tonearmAngle) * (reducedMotion ? 1 : 0.06);
    if (tonearm) tonearm.rotation.y = tonearmAngle;

    if (!reducedMotion) {
      frameCamera.position.set(
        FRAME_HOME.x + Math.sin(t * 0.18) * 0.4,
        FRAME_HOME.y + Math.sin(t * 0.14) * 0.18,
        FRAME_HOME.z + Math.cos(t * 0.18) * 0.4,
      );
      frameCamera.lookAt(HOME_LOOK);
    }
  };

  return {
    scene,
    frameCamera,
    fullCamera,
    setFullAspect: (aspect) => {
      fullAspect = Math.max(0.45, aspect);
      fullCamera.aspect = fullAspect;
      fullCamera.fov = fullAspect < 1 ? 38 : 30;
      fullCamera.updateProjectionMatrix();
      updateResponsiveHome();
    },
    update,
    raycastAt: (ndc) => {
      if (!loaded || interactiveMeshes.length === 0) return null;
      // `update` moves the camera with `lookAt`, which leaves `matrixWorld` stale until
      // something renders. Picking must not depend on having been rendered first.
      fullCamera.updateMatrixWorld();
      pointerNdc.set(ndc.x, ndc.y);
      raycaster.setFromCamera(pointerNdc, fullCamera);
      const hit = raycaster.intersectObjects(interactiveMeshes, false)[0]?.object;
      return (hit?.userData.roomObject as RoomObjectId | undefined) ?? null;
    },
    setHover: (id) => { hovered = id; },
    focus: (id) => { focused = id; },
    setPlayerMode: (on) => { playerMode = on; },
    orbitPlayer: (dx, dy) => {
      orbitAzimuth = THREE.MathUtils.clamp(
        orbitAzimuth + dx * 2.4,
        PLAYER_AZIMUTH - ORBIT_AZIMUTH_LIMIT,
        PLAYER_AZIMUTH + ORBIT_AZIMUTH_LIMIT,
      );
      orbitElevation = THREE.MathUtils.clamp(
        orbitElevation + dy * 1.6,
        ORBIT_ELEVATION_MIN,
        ORBIT_ELEVATION_MAX,
      );
    },
    resetPlayerOrbit: () => {
      orbitAzimuth = PLAYER_AZIMUTH;
      orbitElevation = PLAYER_ELEVATION;
    },
    setTonearm: (progress) => { tonearmTarget = progress; },
    setPlatterRpm: (rpm) => records?.setRpm(rpm),

    grabRecordAt: (ndc) => {
      if (!loaded || !records) return null;
      fullCamera.updateMatrixWorld();
      pointerNdc.set(ndc.x, ndc.y);
      raycaster.setFromCamera(pointerNdc, fullCamera);
      const hit = raycaster.intersectObjects(records.pickables, false)[0]?.object;
      const id = hit ? records.recordFor(hit) : null;
      if (id) records.grab(id, fullCamera);
      return id;
    },
    moveRecordTo: (ndc) => {
      if (!records?.held()) return;
      fullCamera.updateMatrixWorld();
      pointerNdc.set(ndc.x, ndc.y);
      raycaster.setFromCamera(pointerNdc, fullCamera);
      records.moveTo(raycaster.ray, fullCamera);
    },
    releaseRecord: () => records?.release() ?? null,
    setRecordSpinning: (spinning) => records?.setSpinning(spinning),
    dispose: () => {
      disposed = true;
      if (model) disposeObject(model);
      ownedTextures.forEach((texture) => texture.dispose());
      scene.clear();
      pickables.clear();
      interactiveMeshes.length = 0;
    },
  };
}
