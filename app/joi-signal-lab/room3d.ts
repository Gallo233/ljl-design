import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { ROOM_OBJECTS, type RoomObjectId } from "./roomObjects";
import { boardSurface, ensureBoard, onBoardChange } from "./roomBoard";
import {
  clearDeckOfDeskProps,
  retireCapturedDeck,
  seatPropsOnDesk,
} from "./roomPlatter";
import {
  createRoomTurntable,
  type DeckControlId,
  type DeckRecordSide,
  type DeckRig,
} from "./roomTurntable";
import {
  BASE_ATLAS_EXPOSURE,
  BASE_ATLAS_IDS,
  BASE_HOTSPOT_NODES,
  BASE_NODE_ATLAS,
  BASE_NODE_FLAT,
  BASE_NODE_IMAGE,
  BASE_NODE_UV,
  BASE_TRANSFORM,
  sanitizeNodeName,
  type BaseAtlasId,
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
  /** Transparent scene containing only the selected negative during the hand-off. */
  handoffScene: any;
  frameCamera: any;
  fullCamera: any;
  setFullAspect: (aspect: number) => void;
  /**
   * Relay the selected reel frame into the room. The first part of the hand-off keeps
   * the negative pinned to the reel's focal plane; the second seats it inside the PC
   * display, completing the CRT → film → screen chain.
   */
  setFilmHandoff: (
    progress: number,
    projectIndex: number,
    sourcePose?: {
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      angle: number;
    },
  ) => void;
  update: (timeMs: number, pointer?: { x: number; y: number }) => void;
  raycastAt: (ndc: { x: number; y: number }) => RoomObjectId | null;
  /** Pick one of the four physical deck controls while its close-up camera owns the room. */
  raycastDeckControl: (ndc: { x: number; y: number }) => DeckControlId | null;
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
  /** Turn the platter, or stop it. */
  setPlatterSpinning: (spinning: boolean) => void;
  /**
   * Print the side that is playing onto the record's centre label. Safe to call before
   * the room has loaded — the last one asked for is applied when the deck is built.
   */
  setRecordLabel: (side: DeckRecordSide) => void;
  setDeckControlValue: (control: "volume" | "tone" | "speed", value: number) => void;
  pressDeckStart: () => void;
  setDeckControlHover: (control: DeckControlId | null) => void;
  dispose: () => void;
};

/** Shared uniform objects let the relay sample the exact sources the reel is showing. */
export type RoomFilmSources = {
  atlas: { value: any };
  joiVideo: { value: any };
  joiMapVideo: { value: any };
  joiVideoReady: { value: number };
  joiMapVideoReady: { value: number };
  nightTide: { value: any };
  room: { value: any };
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

/** The drawable quad in the capture, sanitized the way the loader renames it. */
const BOARD_FACE_NODE = sanitizeNodeName("whiteboard face");

/**
 * The whiteboard face: the bake, with the drawing laid over it.
 *
 * The drawing multiplies rather than replaces, so the board keeps the room's own light
 * and shadow across it and the ink reads as ink on a lit surface instead of as a bright
 * rectangle pasted into the wall. Where nothing has been drawn the alpha is zero and the
 * bake comes through untouched.
 *
 * The remap exists because the face's atlas island is turned a quarter: its `u` runs up
 * the wall and its `v` runs along it, and `v` grows in the direction the viewer reads as
 * left. Read off the quad's four corners rather than guessed — see the audit note.
 */
const BOARD_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D uBake;
  uniform sampler2D uDraw;
  uniform vec2 uBoardMin;
  uniform vec2 uBoardSize;
  uniform float uExposure;
  uniform float uLift;
  varying vec2 vBakeUv;
  void main() {
    vec3 surface = max(texture2D(uBake, vBakeUv).rgb, vec3(0.0)) * uExposure + uLift;
    vec2 board = (vBakeUv - uBoardMin) / uBoardSize;
    vec2 drawUv = vec2(1.0 - board.y, 1.0 - board.x);
    if (drawUv.x >= 0.0 && drawUv.x <= 1.0 && drawUv.y >= 0.0 && drawUv.y <= 1.0) {
      vec4 ink = texture2D(uDraw, drawUv);
      surface = mix(surface, surface * ink.rgb, ink.a);
    }
    gl_FragColor = vec4(surface, 1.0);
  }
`;

/**
 * A single physical frame of 35 mm stock.
 *
 * It intentionally shares the reel's texture uniforms rather than taking a screenshot:
 * moving Joi footage, the live handheld and the room target all survive the hand-off.
 * The card is rendered only by `fullCamera`, so sampling the room target here never feeds
 * the card back into frame 05's own render target.
 */
const FILM_HANDOFF_VERTEX_SHADER = /* glsl */ `
  uniform float uCurl;
  uniform float uTime;
  varying vec2 vFilmUv;
  varying vec3 vFilmWorldPosition;
  varying vec3 vFilmWorldNormal;
  void main() {
    vFilmUv = uv;
    vec3 bent = position;
    float arch = sin(uv.x * 3.14159265) * sin(uv.y * 3.14159265);
    float flutter = sin((uv.x * 2.1 + uv.y * 1.4) * 6.2831853 + uTime) * 0.045;
    bent.z += (arch + flutter) * uCurl;
    vec4 world = modelMatrix * vec4(bent, 1.0);
    vFilmWorldPosition = world.xyz;
    vFilmWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FILM_HANDOFF_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform sampler2D uJoiVideo;
  uniform sampler2D uJoiMapVideo;
  uniform sampler2D uNightTideMap;
  uniform sampler2D uRoomMap;
  uniform float uJoiVideoReady;
  uniform float uJoiMapVideoReady;
  uniform float uActiveFrame;
  uniform float uOpacity;
  uniform float uDock;
  uniform float uScreenAspect;
  varying vec2 vFilmUv;
  varying vec3 vFilmWorldPosition;
  varying vec3 vFilmWorldNormal;

  void main() {
    const float TEXTURE_COUNT = 6.0;
    const float BORDER_X = 0.030;
    const float BORDER_Y = 0.070;
    float frameIndex = floor(uActiveFrame + 0.5);
    vec2 filmContentUv = vec2(
      clamp((vFilmUv.x - BORDER_X) / (1.0 - BORDER_X * 2.0), 0.0, 1.0),
      clamp((vFilmUv.y - BORDER_Y) / (1.0 - BORDER_Y * 2.0), 0.0, 1.0)
    );
    // When the stock reaches the PC it stops being a 4:3 object laid over the panel.
    // Crop the 4:3 picture into the display's wider aspect, then let the geometry widen
    // to the measured screen rectangle. No stretch, letterbox or perforation survives.
    const float SOURCE_ASPECT = 1.3333333;
    vec2 screenUv = vFilmUv;
    if (uScreenAspect > SOURCE_ASPECT) {
      float visibleHeight = SOURCE_ASPECT / uScreenAspect;
      screenUv.y = 0.5 + (screenUv.y - 0.5) * visibleHeight;
    } else {
      float visibleWidth = uScreenAspect / SOURCE_ASPECT;
      screenUv.x = 0.5 + (screenUv.x - 0.5) * visibleWidth;
    }
    vec2 sampleUv = mix(filmContentUv, screenUv, uDock);
    vec2 atlasUv = vec2((frameIndex + sampleUv.x) / TEXTURE_COUNT, sampleUv.y);
    vec3 image;
    if (abs(frameIndex - 0.0) < 0.5) {
      image = mix(texture2D(uMap, atlasUv).rgb, texture2D(uJoiVideo, sampleUv).rgb, uJoiVideoReady);
    } else if (abs(frameIndex - 1.0) < 0.5) {
      vec2 mobileVideoUv = vec2(0.125 + sampleUv.x * 0.75, sampleUv.y);
      image = mix(texture2D(uMap, atlasUv).rgb, texture2D(uJoiMapVideo, mobileVideoUv).rgb, uJoiMapVideoReady);
    } else if (abs(frameIndex - 2.0) < 0.5) {
      image = texture2D(uNightTideMap, sampleUv).rgb;
    } else if (abs(frameIndex - 4.0) < 0.5) {
      image = texture2D(uRoomMap, sampleUv).rgb;
    } else {
      image = texture2D(uMap, atlasUv).rgb;
    }

    bool sideBorder = vFilmUv.x < BORDER_X || vFilmUv.x > 1.0 - BORDER_X;
    bool topBottom = vFilmUv.y < BORDER_Y || vFilmUv.y > 1.0 - BORDER_Y;
    vec3 filmColour = (sideBorder || topBottom) ? vec3(0.006, 0.008, 0.012) : image;
    vec3 colour = mix(filmColour, image, uDock);

    // The same sealed sprocket rail as the reel: holes belong inside the stock, never
    // cut through its outer edge. A little more spacing makes them legible once the
    // negative has become the picture held by the PC display.
    const float HOLE_SEAL = 0.016;
    const float HOLE_INNER = 0.060;
    const float HOLE_RADIUS = 0.34;
    float edgeBand = min(vFilmUv.y, 1.0 - vFilmUv.y);
    float holePhase = fract(vFilmUv.x * 15.0);
    float holeCentre = (HOLE_SEAL + HOLE_INNER) * 0.5;
    float holeHalf = (HOLE_INNER - HOLE_SEAL) * 0.5;
    vec2 holeLocal = vec2((holePhase - 0.5) * 2.0, (edgeBand - holeCentre) / holeHalf);
    vec2 holeQ = abs(holeLocal) - vec2(0.56, 1.0) + HOLE_RADIUS;
    float holeSdf = length(max(holeQ, 0.0)) + min(max(holeQ.x, holeQ.y), 0.0) - HOLE_RADIUS;
    float holeCoverage = holeSdf < 0.0 ? uDock : 1.0;

    vec3 toEye = normalize(cameraPosition - vFilmWorldPosition);
    float facing = abs(dot(normalize(vFilmWorldNormal), toEye));
    float sheen = pow(1.0 - facing, 2.4);
    colour += vec3(0.10, 0.16, 0.21) * sheen * 0.32 * (1.0 - uDock);
    colour = mix(
      colour,
      vec3(dot(colour, vec3(0.299, 0.587, 0.114))),
      0.035 * (1.0 - uDock)
    );
    gl_FragColor = vec4(colour, uOpacity * holeCoverage);
  }
`;

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
 * Player mode, measured off the capture rather than eyeballed.
 *
 * The fallback look point is the captured platter's centre. Once the procedural deck is
 * standing in the slot, its world bounds replace both the look point and the fit radius.
 * That keeps the complete plinth and its controls in frame instead of tuning one crop for
 * a single desktop screenshot and losing the right-hand controls on a narrow display.
 *
 * The pair of stylus angles that used to live here are gone with the mesh they described.
 * The captured tonearm was one rigid node swung between two hand-derived limits; the new
 * arm solves its own tracking angle from its bearing offset and its length, so `setTonearm`
 * hands it a progress and it works out where that is.
 */
const PLAYER_LOOK = new THREE.Vector3(4.92, 5.48, -9.55);
const PLAYER_MIN_RADIUS = 6.15;
const PLAYER_AZIMUTH = THREE.MathUtils.degToRad(50.7);
const PLAYER_ELEVATION = THREE.MathUtils.degToRad(29.5);
const PLAYER_FOV = 36;
/** How far a drag can swing the deck before it stops. */
const ORBIT_AZIMUTH_LIMIT = THREE.MathUtils.degToRad(62);
const ORBIT_ELEVATION_MIN = THREE.MathUtils.degToRad(14);
const ORBIT_ELEVATION_MAX = THREE.MathUtils.degToRad(72);

export function createRoomScene(filmSources?: RoomFilmSources): RoomScene {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020810");
  const handoffScene = new THREE.Scene();

  // No lights: direct light, indirect bounce and contact shadow are all in the bake.
  // That keeps the reel target and the full About stage identical and costs no shadow
  // map on a phone.

  const frameCamera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 400);
  frameCamera.position.copy(FRAME_HOME);
  frameCamera.lookAt(HOME_LOOK);

  const fullCamera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  fullCamera.position.copy(FULL_HOME);
  fullCamera.lookAt(HOME_LOOK);

  // A separate transparent scene keeps the selected negative above both source worlds.
  // It cannot recursively enter frame 05's room texture, and the room/reel can dissolve
  // beneath it without ever making the centre image readable twice.
  const filmHandoff = new THREE.Group();
  filmHandoff.name = "selected-film-handoff";
  filmHandoff.visible = false;
  let handoffMaterial: any = null;
  let handoffGeometry: any = null;
  if (filmSources) {
    handoffGeometry = new THREE.PlaneGeometry(4, 3, 12, 9);
    handoffMaterial = new THREE.ShaderMaterial({
      name: "Selected film handoff",
      uniforms: {
        uMap: filmSources.atlas,
        uJoiVideo: filmSources.joiVideo,
        uJoiMapVideo: filmSources.joiMapVideo,
        uJoiVideoReady: filmSources.joiVideoReady,
        uJoiMapVideoReady: filmSources.joiMapVideoReady,
        uNightTideMap: filmSources.nightTide,
        uRoomMap: filmSources.room,
        uActiveFrame: { value: 0 },
        uOpacity: { value: 1 },
        uDock: { value: 0 },
        uScreenAspect: { value: 4 / 3 },
        uCurl: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: FILM_HANDOFF_VERTEX_SHADER,
      fragmentShader: FILM_HANDOFF_FRAGMENT_SHADER,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      toneMapped: false,
    });
    const negative = new THREE.Mesh(handoffGeometry, handoffMaterial);
    negative.name = "selected-film-negative";
    negative.renderOrder = 1;
    filmHandoff.add(negative);
  }
  handoffScene.add(filmHandoff);

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
  let handoffProgress = 0;
  const handoffSourcePose = {
    centerX: 0,
    centerY: 0,
    width: 1.24,
    height: 0.94,
    angle: 0,
  };
  const handoffLanding = new THREE.Vector3(3.45, 5.8, -4.06);
  const handoffLandingQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, Math.PI / 2, 0),
  );
  let handoffEndScaleX = 0.63;
  let handoffEndScaleY = 0.56;
  let handoffScreenDistance = 3;
  let handoffTargetNode: any = null;
  const handoffTargetLocal = new THREE.Vector3();
  const handoffTargetNormalLocal = new THREE.Vector3(1, 0, 0);
  const handoffTargetUpLocal = new THREE.Vector3(0, 1, 0);
  const handoffTargetNormalWorld = new THREE.Vector3(1, 0, 0);
  const handoffTargetUpWorld = new THREE.Vector3(0, 1, 0);
  const handoffTargetRightWorld = new THREE.Vector3(0, 0, -1);
  const handoffTargetBasis = new THREE.Matrix4();

  const updateHandoffLanding = () => {
    if (!handoffTargetNode) return;
    handoffTargetNode.updateWorldMatrix(true, false);
    handoffLanding.copy(handoffTargetLocal).applyMatrix4(handoffTargetNode.matrixWorld);
    handoffTargetNormalWorld
      .copy(handoffTargetNormalLocal)
      .transformDirection(handoffTargetNode.matrixWorld);
    handoffTargetUpWorld
      .copy(handoffTargetUpLocal)
      .transformDirection(handoffTargetNode.matrixWorld);
    handoffTargetRightWorld
      .crossVectors(handoffTargetUpWorld, handoffTargetNormalWorld)
      .normalize();
    handoffTargetBasis.makeBasis(
      handoffTargetRightWorld,
      handoffTargetUpWorld,
      handoffTargetNormalWorld,
    );
    handoffLandingQuaternion.setFromRotationMatrix(handoffTargetBasis);
  };

  /** One node that lifts on hover, and the parent-space axis that is world "up" for it. */
  type PickableNode = { node: any; home: any; up: any };
  const pickables = new Map<RoomObjectId, { nodes: PickableNode[]; focus: any }>();
  const interactiveMeshes: any[] = [];
  const ownedTextures: any[] = [];
  let model: any = null;
  let deck: DeckRig | null = null;
  let boardTexture: any = null;
  let boardMaterial: any = null;
  let unbindBoard: (() => void) | null = null;
  const pictureMaterials = new Map<string, any>();

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

      /*
       * A stand-in for a mesh the capture never baked.
       *
       * The colour goes through the atlas shader on a 1x1 texture rather than into a
       * plain material, so it takes the same colour space, exposure and lift a sampled
       * texel would. That is the whole point: the chair has to sit in the same tonal
       * world as the objects around it, and matching that by eye against a lifted,
       * exposed bake is guesswork.
       */
      const flatMaterials = new Map<string, any>();
      const flatMaterialFor = (colour: string, id: BaseAtlasId) => {
        const key = `${colour}:${id}`;
        let material = flatMaterials.get(key);
        if (!material) {
          const rgb = new THREE.Color(colour);
          const texture = new THREE.DataTexture(
            new Uint8Array([
              Math.round(rgb.r * 255), Math.round(rgb.g * 255), Math.round(rgb.b * 255), 255,
            ]),
            1,
            1,
            THREE.RGBAFormat,
          );
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          material = new THREE.ShaderMaterial({
            name: `About room · ${id} · flat ${colour}`,
            uniforms: {
              uBake: { value: texture },
              uExposure: { value: BASE_ATLAS_EXPOSURE[id] },
              uLift: { value: BAKE_LIFT },
            },
            vertexShader: BAKED_VERTEX_SHADER[0],
            fragmentShader: BAKED_FRAGMENT_SHADER,
          });
          material.toneMapped = false;
          flatMaterials.set(key, material);
        }
        return material;
      };

      /*
       * Bind the drawable surface to the board's own quad.
       *
       * The bounds come from the mesh so the drawing lands exactly on the face however
       * the capture packed it, and the texture is left unflipped so canvas row 0 is the
       * top of the board rather than the bottom.
       */
      const bindBoard = (node: any) => {
        const uv = node.geometry?.attributes?.uv;
        if (!uv || uv.count === 0) return;
        let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
        for (let i = 0; i < uv.count; i += 1) {
          const u = uv.getX(i);
          const v = uv.getY(i);
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        const width = maxU - minU;
        const height = maxV - minV;
        if (!(width > 0.0001 && height > 0.0001)) return;

        boardTexture = new THREE.CanvasTexture(boardSurface());
        boardTexture.flipY = false;
        boardTexture.colorSpace = THREE.SRGBColorSpace;
        boardTexture.generateMipmaps = false;
        boardTexture.minFilter = THREE.LinearFilter;
        boardTexture.anisotropy = 4;

        const atlas = BASE_NODE_ATLAS[node.name] ?? "group3";
        boardMaterial = new THREE.ShaderMaterial({
          name: "About room · whiteboard",
          uniforms: {
            uBake: { value: atlases.get(atlas) },
            uDraw: { value: boardTexture },
            uBoardMin: { value: new THREE.Vector2(minU, minV) },
            uBoardSize: { value: new THREE.Vector2(width, height) },
            uExposure: { value: BASE_ATLAS_EXPOSURE[atlas] },
            uLift: { value: BAKE_LIFT },
          },
          vertexShader: BAKED_VERTEX_SHADER[0],
          fragmentShader: BOARD_FRAGMENT_SHADER,
        });
        boardMaterial.toneMapped = false;
        node.material = boardMaterial;

        const flag = () => { if (boardTexture) boardTexture.needsUpdate = true; };
        unbindBoard = onBoardChange(flag);
        void ensureBoard().then(flag);
      };

      /*
       * A picture, on a mesh that was authored to hold one.
       *
       * Shown as it is rather than multiplied into the bake: the sheet's UVs cover the
       * whole atlas, so there is no bake to read at those coordinates in the first
       * place. The print is dark, so an unlit surface still sits in the room.
       */
      const pictureLoader = new THREE.TextureLoader();
      const pictureMaterialFor = (spec: { url: string; mirrorU?: boolean }) => {
        let material = pictureMaterials.get(spec.url);
        if (!material) {
          const texture = pictureLoader.load(spec.url);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.anisotropy = 4;
          if (spec.mirrorU) {
            texture.repeat.x = -1;
            texture.offset.x = 1;
          }
          material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
          material.name = `About room · picture ${spec.url}`;
          pictureMaterials.set(spec.url, material);
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
        const picture = BASE_NODE_IMAGE[node.name];
        if (picture) {
          node.material = pictureMaterialFor(picture);
          return;
        }
        const flat = BASE_NODE_FLAT[node.name];
        if (node.name === BOARD_FACE_NODE) {
          bindBoard(node);
          if (boardMaterial) return;
        }
        node.material = flat
          ? flatMaterialFor(flat, atlas ?? "group1")
          : materialFor(atlas ?? "group1", BASE_NODE_UV[node.name] ?? 0);
      });
      placeholders.forEach((material) => material.dispose());
      if (unmapped.size > 0 && process.env.NODE_ENV !== "production") {
        console.warn(`[about-room] meshes with no atlas mapping: ${[...unmapped].join(", ")}`);
      }

      baseRoot.add(model);
      baseRoot.updateMatrixWorld(true);

      /*
       * The PC display is the final image container. Its mesh is authored in the YZ
       * plane, with X as surface depth, so the negative can inherit the exact physical
       * centre and orientation instead of aiming at a guessed screen-space rectangle.
       * During docking the physical 4:3 negative is cropped and widened into this
       * measured rectangle. The bezel therefore becomes the final mask instead of
       * leaving a smaller film card floating over the computer.
       */
      const capturedScreen = model.getObjectByName(sanitizeNodeName("screen.001"));
      if (capturedScreen?.geometry) {
        capturedScreen.geometry.computeBoundingBox();
        const screenBounds = capturedScreen.geometry.boundingBox;
        if (screenBounds) {
          handoffTargetNode = capturedScreen;
          const positions = capturedScreen.geometry.getAttribute("position");
          const normals = capturedScreen.geometry.getAttribute("normal");
          handoffTargetNormalLocal.set(0, 0, 0);
          for (let index = 0; normals && index < normals.count; index += 1) {
            handoffTargetNormalLocal.add(
              new THREE.Vector3(normals.getX(index), normals.getY(index), normals.getZ(index)),
            );
          }
          handoffTargetNormalLocal.normalize();

          // `screen.001` is the twelve-vertex luminous face. It is tilted inside
          // the laptop node, so the shell's Y/Z bounding box is not its plane. Build
          // the same normal/up/right basis the geometry actually uses.
          const rightLocal = new THREE.Vector3(0, 0, -1);
          handoffTargetUpLocal
            .crossVectors(handoffTargetNormalLocal, rightLocal)
            .normalize();
          let minRight = Infinity;
          let maxRight = -Infinity;
          let minUp = Infinity;
          let maxUp = -Infinity;
          let minNormal = Infinity;
          let maxNormal = -Infinity;
          const vertex = new THREE.Vector3();
          for (let index = 0; positions && index < positions.count; index += 1) {
            vertex.set(positions.getX(index), positions.getY(index), positions.getZ(index));
            const right = vertex.dot(rightLocal);
            const up = vertex.dot(handoffTargetUpLocal);
            const normal = vertex.dot(handoffTargetNormalLocal);
            minRight = Math.min(minRight, right);
            maxRight = Math.max(maxRight, right);
            minUp = Math.min(minUp, up);
            maxUp = Math.max(maxUp, up);
            minNormal = Math.min(minNormal, normal);
            maxNormal = Math.max(maxNormal, normal);
          }
          handoffTargetLocal
            .copy(rightLocal)
            .multiplyScalar((minRight + maxRight) * 0.5)
            .addScaledVector(handoffTargetUpLocal, (minUp + maxUp) * 0.5)
            .addScaledVector(handoffTargetNormalLocal, (minNormal + maxNormal) * 0.5);

          const screenCenterWorld = handoffTargetLocal
            .clone()
            .applyMatrix4(capturedScreen.matrixWorld);
          const screenNormalWorld = handoffTargetNormalLocal
            .clone()
            .transformDirection(capturedScreen.matrixWorld);
          if (screenNormalWorld.dot(FULL_HOME.clone().sub(screenCenterWorld)) < 0) {
            handoffTargetNormalLocal.negate();
          }
          const worldOrigin = new THREE.Vector3().applyMatrix4(capturedScreen.matrixWorld);
          const rightWorldScale = rightLocal
            .clone()
            .applyMatrix4(capturedScreen.matrixWorld)
            .distanceTo(worldOrigin);
          const upWorldScale = handoffTargetUpLocal
            .clone()
            .applyMatrix4(capturedScreen.matrixWorld)
            .distanceTo(worldOrigin);
          const screenWidth = (maxRight - minRight) * rightWorldScale;
          const screenHeight = (maxUp - minUp) * upWorldScale;
          handoffEndScaleX = screenWidth / 4 * 0.995;
          handoffEndScaleY = screenHeight / 3 * 0.995;
          if (handoffMaterial) {
            handoffMaterial.uniforms.uScreenAspect.value =
              (handoffEndScaleX * 4) / Math.max(0.001, handoffEndScaleY * 3);
          }
          updateHandoffLanding();
        }
      }

      const worldUp = new THREE.Vector3(0, 1, 0);

      /*
       * Stand our own machine in the slot the captured one leaves.
       *
       * The deck goes under `model` rather than beside it, which buys three things for
       * free: it inherits `BASE_TRANSFORM`, it is found by name like any other node so
       * the hotspot loop below needs no special case, and it is disposed with the room.
       */
      const slot = retireCapturedDeck(model);
      if (!slot) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[about-room] no captured turntable to replace; the deck is not built");
        }
      } else {
        deck = createRoomTurntable();
        const { platterCentre, bottomY, recordRadius } = deck.anchors;

        // A twelve-inch record is the one dimension in this shot a reader already knows
        // the size of, so it is what sets the scale rather than the plinth: match the
        // pressing the capture had on the platter and everything else follows.
        const scale = slot.recordRadius / recordRadius;

        // The machine is authored facing +Z. The desk runs along Z with the chair pulled
        // out at +X, so a quarter turn puts its front towards the chair — and takes the
        // lid's hinge to the wall side, which is where the captured lid stood open.
        const facing = Math.PI / 2;
        deck.group.rotation.y = facing;
        deck.group.scale.setScalar(scale);

        // Feet on the table, platter centred on the slot. One conversion, so this stays
        // correct if the base is ever moved or turned.
        const anchor = model.worldToLocal(
          new THREE.Vector3(slot.centre.x, slot.tableY, slot.centre.z),
        );
        const offset = platterCentre.clone().applyAxisAngle(worldUp, facing).multiplyScalar(scale);
        deck.group.position.set(anchor.x - offset.x, anchor.y - bottomY * scale, anchor.z - offset.z);
        model.add(deck.group);
        deck.group.updateMatrixWorld(true);

        /*
         * Reconcile the room with the machine now standing in it.
         *
         * Both passes measure the scene rather than carrying numbers, so they stay
         * correct if the capture is re-exported or the deck model changes shape. A
         * margin scaled off the record keeps the clearance proportional to the room.
         */
        seatPropsOnDesk(model);
        const cleared = clearDeckOfDeskProps(model, deck.group, slot.recordRadius * 0.04);
        if (cleared && cleared.shift === 0 && process.env.NODE_ENV !== "production") {
          console.warn(
            `[about-room] the deck still overlaps ${cleared.against.join(", ")} and cannot`
            + " give way on either side; it has outgrown the space on the desk",
          );
        }

        // Fit the object that is actually here. The previous fixed 6.15-unit orbit was
        // calibrated on the platter alone, so the plinth and its right-side controls fell
        // outside the view as soon as the canvas became narrower than that calibration.
        scene.updateMatrixWorld(true);
        const playerBounds = new THREE.Box3().setFromObject(deck.group);
        const playerSphere = playerBounds.getBoundingSphere(new THREE.Sphere());
        PLAYER_LOOK.copy(playerSphere.center);
        // The lower third belongs to the transport and record shelf. Moving the camera's
        // orbit centre a little below the object's geometric centre places the complete
        // machine in the clear upper field instead of technically fitting it behind the
        // opaque console.
        PLAYER_LOOK.y -= playerSphere.radius * 0.42;
        // The lid is deliberately allowed to breathe just beyond the safe circle. Fitting
        // its complete open plane made the playable chassis — and especially its three
        // right-hand controls — too small. The DOM controls still reserve the lower field,
        // while this radius keeps the whole plinth and every physical control prominent.
        playerBoundsRadius = playerSphere.radius * 0.84;
        if (pendingLabel) deck.setLabel(pendingLabel);

      }

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
  const handoffCloseCamera = new THREE.Vector3();
  const handoffCameraLook = new THREE.Vector3();
  let focusAmount = 0;
  let lastFrameMs = 0;
  let playerMode = false;
  let playerAmount = 0;
  let orbitAzimuth = PLAYER_AZIMUTH;
  let orbitElevation = PLAYER_ELEVATION;
  let playerBoundsRadius = 1.8;
  let tonearmTarget: number | null = null;
  /**
   * The label the deck asked for. Held rather than applied directly, because the console
   * opens against a room that is still loading its GLB — a side chosen in that window
   * would otherwise be printed on a record that does not exist yet, and lost.
   */
  let pendingLabel: DeckRecordSide | null = null;
  const playerHome = new THREE.Vector3();
  const baseHome = new THREE.Vector3();

  const playerDistance = () => {
    const verticalHalfFov = THREE.MathUtils.degToRad(PLAYER_FOV * 0.5);
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * fullAspect);
    const limitingHalfFov = Math.max(0.12, Math.min(verticalHalfFov, horizontalHalfFov));
    // Keep the hardware large enough to read. The first responsive pass treated every
    // almost-square desktop as a phone and pulled the camera back by nearly half again;
    // that fitted the lid, but reduced the physical controls to decoration. Only truly
    // narrow portrait screens need the larger horizontal-FOV allowance.
    const consoleClearance = fullAspect < 0.72
      ? 1.48
      : fullAspect < 0.9
        ? 1.32
        : fullAspect < 1.2
          ? 1.22
          : 1.18;
    return Math.max(
      PLAYER_MIN_RADIUS,
      (playerBoundsRadius / Math.sin(limitingHalfFov)) * consoleClearance,
    );
  };

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
    deck?.update(delta);

    pickables.forEach((entry, id) => {
      const lift = hovered === id ? 0.28 : 0;
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
    const roomFov = fullAspect < 1 ? 38 : 30;
    let nextFullFov = THREE.MathUtils.lerp(roomFov, PLAYER_FOV, playerAmount);
    if (playerAmount > 0.001) {
      const cosE = Math.cos(orbitElevation);
      const distance = playerDistance();
      playerHome.set(
        PLAYER_LOOK.x + Math.cos(orbitAzimuth) * cosE * distance,
        PLAYER_LOOK.y + Math.sin(orbitElevation) * distance,
        PLAYER_LOOK.z + Math.sin(orbitAzimuth) * cosE * distance,
      );
      baseHome.lerp(playerHome, playerAmount);
      lookCurrent.lerp(PLAYER_LOOK, playerAmount);
    }

    if (Math.abs(fullCamera.fov - nextFullFov) > 0.01) {
      fullCamera.fov = nextFullFov;
      fullCamera.updateProjectionMatrix();
    }

    updateHandoffLanding();

    /*
     * This is heroScene.update() played backwards, not a second motion design:
     *
     *   cameraProgressBase = min(journey / .8, 1)
     *   cameraProgress     = 1 - (1 - base)^1.4
     *   filmHandoff       = smooth((journey - .66) / .22)
     *
     * Here `journey` runs from the completed PC close-up back to the room. Keeping
     * those source constants together makes the two screen transitions feel like one
     * continuous camera move instead of two animations with similar intentions.
     */
    fullCamera.position.copy(baseHome);
    handoffCameraLook.copy(lookCurrent);
    const journey = THREE.MathUtils.clamp(1 - handoffProgress, 0, 1);
    const cameraProgressBase = Math.min(journey / 0.8, 1);
    const cameraProgress = reducedMotion
      ? 0
      : 1 - Math.pow(1 - cameraProgressBase, 1.4);
    const sourceFilmHandoff = THREE.MathUtils.smoothstep(journey, 0.66, 0.88);
    const dock = reducedMotion ? 1 : 1 - sourceFilmHandoff;
    if (cameraProgress > 0.001) {
      const fovTangent = Math.tan(THREE.MathUtils.degToRad(fullCamera.fov) * 0.5);
      const filmWidth = handoffEndScaleX * 4;
      const filmHeight = handoffEndScaleY * 3;
      const screenAspect = filmWidth / Math.max(0.001, filmHeight);
      // Match the CRT's cover-fit exactly: portrait screens fit by height and crop
      // the PC's sides; landscape screens fit by width and crop top/bottom. The
      // selected picture therefore becomes the viewport before the room pulls away.
      handoffScreenDistance = (fullAspect < screenAspect
        ? filmHeight / 2 / fovTangent
        : filmWidth / 2 / (fovTangent * fullAspect)) * 0.9;
      handoffCloseCamera
        .copy(handoffLanding)
        .addScaledVector(handoffTargetNormalWorld, handoffScreenDistance);
      fullCamera.position.lerpVectors(baseHome, handoffCloseCamera, cameraProgress);
      handoffCameraLook.lerpVectors(lookCurrent, handoffLanding, cameraProgress);
    }
    fullCamera.lookAt(handoffCameraLook);

    if (handoffMaterial && handoffProgress >= 0.2) {
      filmHandoff.visible = true;
      filmHandoff.position.copy(handoffLanding);
      filmHandoff.quaternion.copy(handoffLandingQuaternion);
      const physicalScale = handoffEndScaleY;
      filmHandoff.scale.set(
        THREE.MathUtils.lerp(physicalScale, handoffEndScaleX, dock),
        THREE.MathUtils.lerp(physicalScale, handoffEndScaleY, dock),
        THREE.MathUtils.lerp(
          physicalScale,
          (handoffEndScaleX + handoffEndScaleY) * 0.5,
          dock,
        ),
      );
      handoffMaterial.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(
        handoffProgress,
        0.2,
        0.24,
      );
      handoffMaterial.uniforms.uDock.value = dock;
      handoffMaterial.uniforms.uCurl.value = 0;
      handoffMaterial.uniforms.uTime.value = t * 2.1;
    } else {
      filmHandoff.visible = false;
    }

    // The arm parks itself when nothing is playing and tracks inward while it is. Where
    // it lands, and the lift-swing-drop on the way, belong to the deck.
    deck?.setTonearm(tonearmTarget);

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
    handoffScene,
    frameCamera,
    fullCamera,
    setFullAspect: (aspect) => {
      fullAspect = Math.max(0.45, aspect);
      fullCamera.aspect = fullAspect;
      fullCamera.fov = fullAspect < 1 ? 38 : 30;
      fullCamera.updateProjectionMatrix();
      updateResponsiveHome();
    },
    setFilmHandoff: (progress, projectIndex, sourcePose) => {
      handoffProgress = THREE.MathUtils.clamp(progress, 0, 1);
      if (handoffMaterial) handoffMaterial.uniforms.uActiveFrame.value = projectIndex;
      if (sourcePose) {
        handoffSourcePose.centerX = THREE.MathUtils.clamp(sourcePose.centerX, -1, 1);
        handoffSourcePose.centerY = THREE.MathUtils.clamp(sourcePose.centerY, -1, 1);
        handoffSourcePose.width = THREE.MathUtils.clamp(sourcePose.width, 0.08, 3);
        handoffSourcePose.height = THREE.MathUtils.clamp(sourcePose.height, 0.08, 2);
        handoffSourcePose.angle = THREE.MathUtils.clamp(sourcePose.angle, -Math.PI, Math.PI);
      }
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
    raycastDeckControl: (ndc) => {
      if (!loaded || !deck || deck.controlNodes.length === 0) return null;
      fullCamera.updateMatrixWorld();
      deck.group.updateWorldMatrix(true, true);
      pointerNdc.set(ndc.x, ndc.y);
      raycaster.setFromCamera(pointerNdc, fullCamera);
      const hit = raycaster.intersectObjects(deck.controlNodes, false)[0]?.object;
      return (hit?.userData.deckControl as DeckControlId | undefined) ?? null;
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
    setPlatterRpm: (rpm) => deck?.setRpm(rpm),
    setPlatterSpinning: (spinning) => deck?.setSpinning(spinning),
    setRecordLabel: (side) => {
      pendingLabel = side;
      deck?.setLabel(side);
    },
    setDeckControlValue: (control, value) => deck?.setControlValue(control, value),
    pressDeckStart: () => deck?.pressStart(),
    setDeckControlHover: (control) => deck?.setControlHover(control),
    dispose: () => {
      disposed = true;
      deck?.dispose();
      if (model) disposeObject(model);
      handoffGeometry?.dispose();
      handoffMaterial?.dispose();
      ownedTextures.forEach((texture) => texture.dispose());
      scene.clear();
      handoffScene.clear();
      unbindBoard?.();
      unbindBoard = null;
      pictureMaterials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      pictureMaterials.clear();
      boardTexture?.dispose();
      boardTexture = null;
      boardMaterial?.dispose();
      boardMaterial = null;
      pickables.clear();
      interactiveMeshes.length = 0;
    },
  };
}
