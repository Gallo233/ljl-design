import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { ROOM_OBJECTS, type RoomObjectId } from "./roomObjects";
import { retireCapturedDeck } from "./roomPlatter";
import { createRoomTerminal, type RoomTerminalRig } from "./roomTerminal";
import { createRoomProps, type RoomPropId } from "./roomProps";
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
  BASE_NODE_UV,
  BASE_TRANSFORM,
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
  frameCamera: any;
  fullCamera: any;
  setFullAspect: (aspect: number) => void;
  /**
   * Relay the selected reel frame into the room. The first part of the hand-off keeps
   * the negative pinned to the reel's focal plane; the second lets it fall onto the
   * physical desk, where it remains as evidence of the route the visitor took in.
   */
  setFilmHandoff: (progress: number, projectIndex: number) => void;
  update: (timeMs: number, pointer?: { x: number; y: number }) => void;
  raycastAt: (ndc: { x: number; y: number }) => RoomObjectId | null;
  /** Pick one of the four physical deck controls while its close-up camera owns the room. */
  raycastDeckControl: (ndc: { x: number; y: number }) => DeckControlId | null;
  setHover: (id: RoomObjectId | null) => void;
  /**
   * Pull the camera towards one object. `close` is the app-opening read: the full
   * distance goes, not the half-step the hover chips use.
   */
  focus: (id: RoomObjectId | null, close?: boolean) => void;
  /** One of three graded moments for the baked room. Tint and practical glows move together. */
  setLightPreset: (preset: RoomLightPreset) => void;
  /** Slide one shelf book out of the rack. `null` seats them all again. */
  setBookSelected: (nodeIndex: number | null) => void;
  /** A click landed on a prop. */
  pokeProp: (id: RoomPropId) => void;
  /** The terminal painted on the screen. Created with the scene, wired after load. */
  terminal: RoomTerminalRig;
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

/** The three graded moments. The bake stays one capture; the grade is applied live. */
export type RoomLightPreset = "day" | "blue" | "night";

/*
 * Grading follows the reference room's own numbers: a state is mostly an exposure,
 * not a colour cast — their light-night is 0.42 exposure against light-day's 0.9.
 * "Lights off" reads as dimmed with a faint cool bias plus real practical glows;
 * it does not read as a saturated wash over everything.
 */
const LIGHT_PRESETS: Record<
  RoomLightPreset,
  { tint: [number, number, number]; exposure: number; lamp: number; desk: number; screen: number }
> = {
  day: { tint: [1, 1, 1], exposure: 1, lamp: 0, desk: 0, screen: 0 },
  blue: { tint: [0.82, 0.86, 1.02], exposure: 0.75, lamp: 0.5, desk: 0.55, screen: 0.35 },
  night: { tint: [0.66, 0.7, 0.86], exposure: 0.45, lamp: 0.9, desk: 0.9, screen: 0.5 },
};

/** Practical glows, measured off the capture: floor-lamp shade, desk lamp, the screen. */
const GLOWS: { position: [number, number, number]; scale: number; channel: "lamp" | "desk" | "screen"; colour: number }[] = [
  { position: [2.89, 8.0, 8.59], scale: 2.6, channel: "lamp", colour: 0xffc27a },
  { position: [2.3, 7.1, -1.6], scale: 2.2, channel: "desk", colour: 0xffc27a },
  { position: [3.07, 5.8, -4.06], scale: 2.4, channel: "screen", colour: 0xcfe0ff },
];

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
  uniform float uExposureMul;
  uniform float uLift;
  uniform vec3 uTint;
  varying vec2 vBakeUv;
  void main() {
    vec3 baked = max(texture2D(uBake, vBakeUv).rgb, vec3(0.0));
    gl_FragColor = vec4(baked * uExposure * uExposureMul * uTint + uLift, 1.0);
  }
`;

/** A restrained toe lift, shared by every atlas. */
const BAKE_LIFT = 0.006;

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
  varying vec2 vFilmUv;
  varying vec3 vFilmWorldPosition;
  varying vec3 vFilmWorldNormal;

  void main() {
    const float TEXTURE_COUNT = 6.0;
    const float BORDER_X = 0.030;
    const float BORDER_Y = 0.070;
    float frameIndex = floor(uActiveFrame + 0.5);
    vec2 contentUv = vec2(
      clamp((vFilmUv.x - BORDER_X) / (1.0 - BORDER_X * 2.0), 0.0, 1.0),
      clamp((vFilmUv.y - BORDER_Y) / (1.0 - BORDER_Y * 2.0), 0.0, 1.0)
    );
    vec2 atlasUv = vec2((frameIndex + contentUv.x) / TEXTURE_COUNT, contentUv.y);
    vec3 image;
    if (abs(frameIndex - 0.0) < 0.5) {
      image = mix(texture2D(uMap, atlasUv).rgb, texture2D(uJoiVideo, contentUv).rgb, uJoiVideoReady);
    } else if (abs(frameIndex - 1.0) < 0.5) {
      vec2 mobileVideoUv = vec2(0.125 + contentUv.x * 0.75, contentUv.y);
      image = mix(texture2D(uMap, atlasUv).rgb, texture2D(uJoiMapVideo, mobileVideoUv).rgb, uJoiMapVideoReady);
    } else if (abs(frameIndex - 2.0) < 0.5) {
      image = texture2D(uNightTideMap, contentUv).rgb;
    } else if (abs(frameIndex - 4.0) < 0.5) {
      image = texture2D(uRoomMap, contentUv).rgb;
    } else {
      image = texture2D(uMap, atlasUv).rgb;
    }

    bool sideBorder = vFilmUv.x < BORDER_X || vFilmUv.x > 1.0 - BORDER_X;
    bool topBottom = vFilmUv.y < BORDER_Y || vFilmUv.y > 1.0 - BORDER_Y;
    vec3 colour = (sideBorder || topBottom) ? vec3(0.006, 0.008, 0.012) : image;

    // The same sealed sprocket rail as the reel: holes belong inside the stock, never
    // cut through its outer edge. A little more spacing makes them legible once the
    // negative has become a small object on the desk.
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
    if (holeSdf < 0.0) discard;

    vec3 toEye = normalize(cameraPosition - vFilmWorldPosition);
    float facing = abs(dot(normalize(vFilmWorldNormal), toEye));
    float sheen = pow(1.0 - facing, 2.4);
    colour += vec3(0.10, 0.16, 0.21) * sheen * 0.32;
    colour = mix(colour, vec3(dot(colour, vec3(0.299, 0.587, 0.114))), 0.035);
    gl_FragColor = vec4(colour, uOpacity);
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

/** A soft radial gradient on a small canvas — the practical glow's only texture. */
function createGlowTexture(colour: number): any {
  const hex = `#${colour.toString(16).padStart(6, "0")}`;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, hex);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoomScene(filmSources?: RoomFilmSources): RoomScene {
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

  /*
   * Layer 1 is the relay negative. Frame 05's camera remains on layer 0, which prevents
   * the card from recursively appearing inside the room texture it samples. The full
   * About camera sees both layers and therefore receives the same physical object after
   * the reel itself has released it.
   */
  fullCamera.layers.enable(1);

  const filmHandoff = new THREE.Group();
  filmHandoff.name = "selected-film-handoff";
  filmHandoff.visible = false;
  let handoffMaterial: any = null;
  let handoffShadowMaterial: any = null;
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
    negative.renderOrder = 2;
    filmHandoff.add(negative);

    handoffShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      toneMapped: false,
    });
    const shadow = new THREE.Mesh(handoffGeometry, handoffShadowMaterial);
    shadow.name = "selected-film-shadow";
    shadow.position.z = -0.035;
    shadow.scale.set(1.035, 1.045, 1);
    shadow.renderOrder = 1;
    filmHandoff.add(shadow);
  }
  filmHandoff.traverse((node: any) => node.layers.set(1));
  scene.add(filmHandoff);

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
  const handoffLanding = new THREE.Vector3(5.6, 5.7, -2.6);
  const handoffLandingQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, -0.16),
  );

  /** One node that lifts on hover, and the parent-space axis that is world "up" for it. */
  type PickableNode = { node: any; home: any; up: any };
  const pickables = new Map<RoomObjectId, { nodes: PickableNode[]; focus: any; viewDistance: number }>();
  /** Camera stand-off for a focused object, read off how big the object actually is. */
  const viewDistanceFor = (bounds: any) =>
    THREE.MathUtils.clamp(bounds.getBoundingSphere(new THREE.Sphere()).radius * 2.4, 8, 30);
  const interactiveMeshes: any[] = [];
  const ownedTextures: any[] = [];
  let model: any = null;
  let deck: DeckRig | null = null;

  /*
   * The three moments. Shared uniform objects (tint colour, exposure multiplier) go
   * into every baked material, so grading the room is two lerps no matter how many
   * atlases are in it. The practical glows are small sprites seated *inside* the lamp
   * shade and on the screen — never bigger than the fixture they belong to.
   */
  const tintUniform = { value: new THREE.Color(1, 1, 1) };
  const exposureUniform = { value: 1 };
  let lightPreset: RoomLightPreset = "day";
  const glowSprites = GLOWS.map((glow) => {
    const material = new THREE.SpriteMaterial({
      map: createGlowTexture(glow.colour),
      color: glow.colour,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...glow.position);
    sprite.scale.setScalar(glow.scale);
    scene.add(sprite);
    return { material, channel: glow.channel, amount: 0 };
  });
  let glowTargets: Record<"lamp" | "desk" | "screen", number> = { lamp: 0, desk: 0, screen: 0 };

  const terminal = createRoomTerminal();
  let terminalMix = 0;
  const screenMaterials: any[] = [];
  let screenNodes: any[] = [];

  const props = createRoomProps();
  scene.add(props.group);

  /** The shelf books that answer the reading timeline. */
  const bookRigs: Map<number, { nodes: any[]; homes: any[]; direction: any; progress: number }> = new Map();
  let selectedBook: number | null = null;

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
              uTint: tintUniform,
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

      /*
       * Find the real desk surface under the intended landing point. The capture can be
       * swapped or repositioned without leaving the negative floating above a guessed Y.
       * Up-facing surfaces only: a monitor bezel crossed by the probe is not a table.
       */
      const landingProbe = new THREE.Raycaster(
        new THREE.Vector3(handoffLanding.x, 30, handoffLanding.z),
        new THREE.Vector3(0, -1, 0),
        0,
        60,
      );
      const normalMatrix = new THREE.Matrix3();
      const landingHit = landingProbe.intersectObject(model, true).find((hit: any) => {
        if (!hit.face || hit.point.y < 3.5 || hit.point.y > 8.5) return false;
        const normal = hit.face.normal.clone().applyMatrix3(
          normalMatrix.getNormalMatrix(hit.object.matrixWorld),
        ).normalize();
        return normal.y > 0.72;
      });
      if (landingHit?.face) {
        const normal = landingHit.face.normal.clone().applyMatrix3(
          normalMatrix.getNormalMatrix(landingHit.object.matrixWorld),
        ).normalize();
        handoffLanding.copy(landingHit.point).addScaledVector(normal, 0.055);
        const alignToSurface = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normal,
        );
        const turnOnSurface = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          -0.16,
        );
        handoffLandingQuaternion.copy(alignToSurface).multiply(turnOnSurface);
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
          viewDistance: viewDistanceFor(bounds),
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

      /*
       * The terminal screen: the capture's own screen meshes get a material that mixes
       * the baked wallpaper with the live terminal canvas. The trap this guards against
       * is the bake's UV space: those coordinates address the atlas's packed layout,
       * not the screen, so the terminal sample is remapped through the mesh's own uv
       * bounds first — one material per mesh, because two screens rarely share a rect.
       */
      const uvRectOf = (mesh: any) => {
        const uv = mesh.geometry?.attributes?.uv;
        if (!uv || uv.count === 0) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < uv.count; i += 1) {
          minX = Math.min(minX, uv.getX(i));
          maxX = Math.max(maxX, uv.getX(i));
          minY = Math.min(minY, uv.getY(i));
          maxY = Math.max(maxY, uv.getY(i));
        }
        return Number.isFinite(minX) && maxX - minX > 1e-4 && maxY - minY > 1e-4
          ? { minX, minY, maxX, maxY }
          : null;
      };
      screenNodes = ["screen", "screen001"]
        .map((name) => model.getObjectByName(name))
        .filter(Boolean);
      if (screenNodes.length === 0 && process.env.NODE_ENV !== "production") {
        console.warn("[about-room] no screen node found; the terminal has no glass");
      } else {
        const makeScreenMaterial = (rect: { minX: number; minY: number; maxX: number; maxY: number }) =>
          new THREE.ShaderMaterial({
            name: "About room · terminal screen",
            uniforms: {
              uBake: { value: atlases.get("group3") },
              uTerminal: { value: terminal.canvasTexture },
              uMix: { value: 0 },
              uExposure: { value: BASE_ATLAS_EXPOSURE.group3 },
              uLift: { value: BAKE_LIFT },
              uTint: tintUniform,
              uExposureMul: exposureUniform,
              uUvMin: { value: new THREE.Vector2(rect.minX, rect.minY) },
              uUvSize: { value: new THREE.Vector2(rect.maxX - rect.minX, rect.maxY - rect.minY) },
            },
            vertexShader: BAKED_VERTEX_SHADER[0],
            fragmentShader: /* glsl */ `
              precision highp float;
              uniform sampler2D uBake;
              uniform sampler2D uTerminal;
              uniform float uMix;
              uniform float uExposure;
              uniform float uExposureMul;
              uniform float uLift;
              uniform vec3 uTint;
              uniform vec2 uUvMin;
              uniform vec2 uUvSize;
              varying vec2 vBakeUv;
              void main() {
                vec3 baked = max(texture2D(uBake, vBakeUv).rgb, vec3(0.0))
                  * uExposure * uExposureMul * uTint + uLift;
                vec2 termUv = clamp((vBakeUv - uUvMin) / uUvSize, 0.0, 1.0);
                vec3 terminal = texture2D(uTerminal, termUv).rgb;
                gl_FragColor = vec4(mix(baked, terminal, uMix), 1.0);
              }
            `,
          });
        screenNodes.forEach((node: any) => {
          const material = makeScreenMaterial(uvRectOf(node) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 });
          material.toneMapped = false;
          screenMaterials.push(material);
          node.material = material;
        });
      }

      /*
       * The props land where the capture actually has surfaces. Each probe looks
       * straight down at the spot the prop asked for and takes the first up-facing
       * face in its height band — coordinates measured off the capture
       * (scripts/dev/inspect-room-glb.mjs). A probe that finds nothing still places
       * its prop, on the fallback height and upright: a prop that vanishes is worse
       * than a prop floating a little.
       */
      const propProbe = new THREE.Raycaster();
      const propDown = new THREE.Vector3(0, -1, 0);
      const propNormalMatrix = new THREE.Matrix3();
      const registeredProps = new Set<RoomPropId>();
      props.probeSpots.forEach((spot) => {
        propProbe.set(new THREE.Vector3(spot.x, 30, spot.z), propDown);
        propProbe.far = 60;
        const hit = propProbe.intersectObject(model, true).find((entry: any) => {
          if (!entry.face || entry.point.y < spot.minY || entry.point.y > spot.maxY) return false;
          const normal = entry.face.normal
            .clone()
            .applyMatrix3(propNormalMatrix.getNormalMatrix(entry.object.matrixWorld))
            .normalize();
          return normal.y > 0.72;
        });
        let point: any;
        let normal: any;
        if (hit?.face) {
          normal = hit.face.normal
            .clone()
            .applyMatrix3(propNormalMatrix.getNormalMatrix(hit.object.matrixWorld))
            .normalize();
          point = hit.point;
        } else {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[about-room] prop "${spot.id}${spot.part ? `:${spot.part}` : ""}" found no surface; placed on the fallback height`);
          }
          normal = new THREE.Vector3(0, 1, 0);
          point = new THREE.Vector3(spot.x, spot.fallbackY, spot.z);
        }
        props.place(spot.id, point, normal, spot.part, spot.faceTo);

        if (registeredProps.has(spot.id)) return;
        const propNode = props.nodesByProp[spot.id][0];
        if (!propNode) return;
        registeredProps.add(spot.id);
        const bounds = new THREE.Box3().setFromObject(propNode);
        const up = new THREE.Vector3(0, 1, 0);
        pickables.set(spot.id as RoomObjectId, {
          nodes: [{ node: propNode, home: propNode.position.clone(), up }],
          focus: bounds.getCenter(new THREE.Vector3()),
          viewDistance: viewDistanceFor(bounds),
        });
        propNode.traverse((child: any) => {
          child.userData.roomObject = spot.id;
          if (child.isMesh) interactiveMeshes.push(child);
        });
      });

      /*
       * The reading timeline's half of the deal: remember where every shelved book
       * sits, and which way "out of the rack" is. Outward is horizontal, away from the
       * shelf's own centre — which puts the slide into the room no matter which wall
       * the capture stands the shelf against.
       */
      const shelfCentre = new THREE.Vector3();
      const bookCentres: { index: number; centre: any; nodes: any[]; homes: any[] }[] = [];
      for (let index = 1; index <= 10; index += 1) {
        const nodes = [`book${index}`, `book${index} outer`]
          .map((name) => model.getObjectByName(name))
          .filter(Boolean);
        if (nodes.length === 0) continue;
        const centre = new THREE.Vector3();
        const bounds = new THREE.Box3();
        nodes.forEach((node: any) => {
          node.updateWorldMatrix(true, false);
          bounds.expandByObject(node);
        });
        bounds.getCenter(centre);
        shelfCentre.add(centre);
        bookCentres.push({ index, centre, nodes, homes: nodes.map((node: any) => node.position.clone()) });
      }
      if (bookCentres.length > 0) {
        shelfCentre.multiplyScalar(1 / bookCentres.length);
        bookCentres.forEach(({ index, centre, nodes, homes }) => {
          const direction = new THREE.Vector3(centre.x - shelfCentre.x, 0, centre.z - shelfCentre.z);
          if (direction.lengthSq() < 0.0001) direction.set(1, 0, 0);
          direction.normalize();
          bookRigs.set(index, { nodes, homes, direction, progress: 0 });
        });
      }

      // The practical glows sit at coordinates measured off this capture
      // (scripts/dev/inspect-room-glb.mjs); nothing to look up at runtime.

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
  const handoffStart = new THREE.Vector3();
  const handoffPosition = new THREE.Vector3();
  const handoffDirection = new THREE.Vector3();
  const handoffStartQuaternion = new THREE.Quaternion();
  const handoffQuaternion = new THREE.Quaternion();
  let focusAmount = 0;
  /** The app-opening read: full pull, not the hover chips' half-step. */
  let focusClose = false;
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
    props.update(delta, timeMs);

    // The room's moment. Shared tint + exposure uniforms move every atlas together;
    // the practical glows fade in per channel so the lamp patches survive the dim.
    const grade = reducedMotion ? 1 : Math.min(1, delta * 3.2);
    const presetTarget = LIGHT_PRESETS[lightPreset];
    tintUniform.value.r += (presetTarget.tint[0] - tintUniform.value.r) * grade;
    tintUniform.value.g += (presetTarget.tint[1] - tintUniform.value.g) * grade;
    tintUniform.value.b += (presetTarget.tint[2] - tintUniform.value.b) * grade;
    exposureUniform.value += (presetTarget.exposure - exposureUniform.value) * grade;
    const terminalTarget = terminal.isActive() ? 1 : 0;
    terminalMix += (terminalTarget - terminalMix) * (reducedMotion ? 1 : Math.min(1, delta * 6));
    screenMaterials.forEach((material) => {
      material.uniforms.uMix.value = terminalMix;
    });
    if (terminalMix > 0.001) terminal.update(delta);
    glowSprites.forEach((glow) => {
      const target = glowTargets[glow.channel] + (glow.channel === "screen" ? terminalMix * 0.3 : 0);
      glow.amount += (target - glow.amount) * grade;
      glow.material.opacity = glow.amount * 0.35;
    });

    pickables.forEach((entry, id) => {
      const lift = hovered === id ? 0.28 : 0;
      entry.nodes.forEach(({ node, home, up }) => {
        liftStep.copy(home).addScaledVector(up, lift).sub(node.position);
        node.position.addScaledVector(liftStep, reducedMotion ? 1 : 0.14);
      });
    });

    // The reading timeline's half: the selected volume eases out of the rack. This
    // rides on top of the hover pass above, which owns position every frame.
    bookRigs.forEach((rig, index) => {
      const target = selectedBook === index ? 1 : 0;
      rig.progress += (target - rig.progress) * (reducedMotion ? 1 : Math.min(1, delta * 7));
      rig.nodes.forEach((node, nodeIndex) => {
        node.position.copy(rig.homes[nodeIndex]).addScaledVector(rig.direction, rig.progress * 0.9);
      });
    });

    const nextFocus = focused ? pickables.get(focused)?.focus : null;
    if (nextFocus) focusPoint.copy(nextFocus);
    focusAmount += ((nextFocus ? 1 : 0) - focusAmount) * (reducedMotion ? 1 : 0.075);
    cameraTarget.copy(nextFocus ?? HOME_LOOK);
    lookCurrent.lerp(cameraTarget, reducedMotion ? 1 : 0.075);

    cameraDirection.copy(responsiveHome).sub(HOME_LOOK).normalize();
    const focusedEntry = focused ? pickables.get(focused) : null;
    const focusDistance = focusedEntry
      ? THREE.MathUtils.clamp(
          focusedEntry.viewDistance * (focusClose ? 0.78 : 1),
          6.5,
          30,
        )
      : FOCUS_DISTANCE;
    focusHome.copy(focusPoint).addScaledVector(cameraDirection, focusDistance);
    cameraHome.copy(responsiveHome).lerp(focusHome, focusAmount * (focusClose ? 0.92 : 0.58));
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

    fullCamera.position.copy(baseHome);
    fullCamera.lookAt(lookCurrent);

    if (handoffMaterial && handoffProgress > 0.035) {
      filmHandoff.visible = true;
      fullCamera.updateMatrixWorld(true);
      fullCamera.getWorldDirection(handoffDirection);

      // During the source swap the card stays pinned to the selected reel frame. Only
      // after slot A owns the picture does it begin the long, readable fall to the desk.
      const rawFlight = THREE.MathUtils.clamp((handoffProgress - 0.28) / 0.58, 0, 1);
      const flight = rawFlight * rawFlight * (3 - 2 * rawFlight);
      const startDistance = 2.4;
      handoffStart.copy(fullCamera.position).addScaledVector(handoffDirection, startDistance);
      const viewportHeight = 2 * Math.tan(THREE.MathUtils.degToRad(fullCamera.fov) * 0.5) * startDistance;
      const startScale = viewportHeight * (fullAspect < 0.8 ? 0.40 : 0.47) / 3;
      const endScale = fullAspect < 0.72 ? 0.82 : 1.08;

      handoffPosition.lerpVectors(handoffStart, handoffLanding, flight);
      handoffPosition.y += Math.sin(flight * Math.PI) * (fullAspect < 0.8 ? 1.25 : 2.25);
      filmHandoff.position.copy(handoffPosition);
      handoffStartQuaternion.copy(fullCamera.quaternion);
      handoffQuaternion.copy(handoffStartQuaternion).slerp(handoffLandingQuaternion, flight);
      filmHandoff.quaternion.copy(handoffQuaternion);
      filmHandoff.scale.setScalar(THREE.MathUtils.lerp(startScale, endScale, flight));

      handoffMaterial.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(
        handoffProgress,
        0.035,
        0.115,
      );
      handoffMaterial.uniforms.uCurl.value = reducedMotion ? 0 : Math.sin(flight * Math.PI) * 0.34;
      handoffMaterial.uniforms.uTime.value = t * 2.1;
      if (handoffShadowMaterial) {
        handoffShadowMaterial.opacity = THREE.MathUtils.lerp(0.07, 0.22, flight);
      }

      if (reducedMotion) {
        filmHandoff.position.copy(handoffLanding);
        filmHandoff.quaternion.copy(handoffLandingQuaternion);
        filmHandoff.scale.setScalar(endScale);
      }
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
    frameCamera,
    fullCamera,
    setFullAspect: (aspect) => {
      fullAspect = Math.max(0.45, aspect);
      fullCamera.aspect = fullAspect;
      fullCamera.fov = fullAspect < 1 ? 38 : 30;
      fullCamera.updateProjectionMatrix();
      updateResponsiveHome();
    },
    setFilmHandoff: (progress, projectIndex) => {
      handoffProgress = THREE.MathUtils.clamp(progress, 0, 1);
      if (handoffMaterial) handoffMaterial.uniforms.uActiveFrame.value = projectIndex;
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
    focus: (id, close) => {
      focused = id;
      focusClose = close ?? false;
    },
    setLightPreset: (preset) => { lightPreset = preset; },
    setBookSelected: (nodeIndex) => { selectedBook = nodeIndex; },
    pokeProp: (id) => props.poke(id),
    terminal,
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
      props.dispose();
      terminal.canvasTexture.dispose();
      glowSprites.forEach((glow) => {
        glow.material.map?.dispose();
        glow.material.dispose();
      });
      screenMaterials.forEach((material) => material.dispose());
      if (model) disposeObject(model);
      handoffGeometry?.dispose();
      handoffMaterial?.dispose();
      handoffShadowMaterial?.dispose();
      ownedTextures.forEach((texture) => texture.dispose());
      scene.clear();
      pickables.clear();
      interactiveMeshes.length = 0;
    },
  };
}
