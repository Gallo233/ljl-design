import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OCCLUDER_LAYER, createHeroLightOrb } from "./heroLightOrb";
import { createSolarSystem } from "./solarSystem";

/**
 * The JOI9000 terminal, as a scene rather than a component.
 *
 * It owns no renderer, no canvas, no rAF and no React. A host calls `update` once a
 * frame and then renders `scene` through `camera` — to the screen, or into a render
 * target as one layer of a composited stage. That separation is the whole point: the
 * same scene has to work under its own canvas today and under a shared renderer with
 * a post chain tomorrow, without the camera flight being re-derived in either.
 *
 * `updateFinalCamera` in particular is moved verbatim. It is this codebase's
 * frustum-fit — it reads the screen mesh's world position, scale and rotation and puts
 * the camera exactly where the frustum covers the screen — and re-deriving it is how
 * the hero's arrival stops landing on the glass.
 */

export type HeroSceneOptions = {
  /** Quality tier decisions the host has already made. */
  isMobile: boolean;
  reducedMotion: boolean;
  shadows: boolean;
  /** The sea, already drawn into a target by the host. Sampled by the screen glass. */
  screenMap: any;
  /** Fired once the GLB is in the scene and the first frame is worth showing. */
  onModelReady: () => void;
};

export type HeroScene = {
  scene: any;
  camera: any;
  /** Canvas size in CSS pixels. */
  setSize: (width: number, height: number) => void;
  /**
   * Advance one frame. `progress` is 0 at the top of the page to 1 when the reel has
   * arrived — the same value the CSS variables are derived from.
   */
  update: (delta: number, progress: number) => void;
  /** Pointer in normalised device coordinates; drives parallax, look and ripples. */
  setPointer: (x: number, y: number) => void;
  /**
   * Draw everything the beauty pass will sample but cannot produce itself — today the
   * orb's scattering buffer. Must run before the host renders this scene.
   */
  prepare: (renderer: any) => void;
  /** True when the pointer is over the orb. The host turns this into a cursor. */
  orbHitTest: (ndc: { x: number; y: number }) => boolean;
  /** Take hold of the orb. False when the pointer was not on it. */
  grabOrb: (ndc: { x: number; y: number }) => boolean;
  /** Carry the orb. No-op unless it is held. */
  moveOrb: (ndc: { x: number; y: number }) => void;
  /** Let the orb go. True if it actually moved, so the host can swallow the click. */
  releaseOrb: () => boolean;
  isOrbHeld: () => boolean;
  /** Carry the host's sea state through to the screen's spill light. */
  setSeaState: (index: number) => void;
  /** Width of the CRT screen in device pixels, as it currently sits on the stage. */
  screenPixelWidth: () => number;
  /** True once the model has landed — the host's boot gate reads this. */
  isReady: () => boolean;
  dispose: () => void;
};



const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const amount = clamp01(value);
  return amount * amount * (3 - 2 * amount);
};

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const right = x + width;
  const top = y + height;
  shape.moveTo(x + radius, y);
  shape.lineTo(right - radius, y);
  shape.quadraticCurveTo(right, y, right, y + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(x + radius, top);
  shape.quadraticCurveTo(x, top, x, top - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createRoundedBox(width: number, height: number, depth: number, radius: number) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(radius * 0.42, 0.12),
    bevelThickness: Math.min(depth * 0.16, 0.1),
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}






/**
 * The glass of the JOI9000. It is handed a picture — the sea, drawn into a target by
 * `oceanScene` — and its whole job is to make that picture look like it is arriving
 * through a tube: rounded corners, a vignette, scanlines, and the bulge of the screen
 * toward the viewer. Whatever is sampled here inherits all of it for free, which is why
 * the sea is a texture and not geometry sitting in this scene.
 */
function createCrtMaterial(screenMap: any) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScreenMap: { value: screenMap },
      /** Fades the picture out as the reel takes the frame. */
      uScreenAmount: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        vec2 centered = uv - 0.5;
        p.z += (1.0 - dot(centered, centered) * 2.3) * 0.045;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uScreenMap;
      uniform float uScreenAmount;
      varying vec2 vUv;
      float rnd(vec2 value) {
        return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
      }
      void main() {
        vec2 centered = vUv - 0.5;
        vec2 q = abs(centered) - vec2(0.475, 0.445);
        float rounded = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.045;
        float mask = 1.0 - smoothstep(-0.008, 0.006, rounded);
        if (mask < 0.01) discard;
        float vignette = smoothstep(0.78, 0.18, length(centered * vec2(1.05, 1.3)));
        float scan = 0.88 + 0.12 * sin(vUv.y * 1050.0 + uTime * 4.0);
        float noise = (rnd(gl_FragCoord.xy + floor(uTime * 20.0)) - 0.5) * 0.045;
        // The target is tagged linear-sRGB, so this is the light the sea wrote, not a
        // decoded copy of it. The post chain still owns the only encode.
        vec3 picture = texture2D(uScreenMap, vUv).rgb * uScreenAmount;
        vec3 base = mix(vec3(0.006, 0.012, 0.019), vec3(0.035, 0.073, 0.085), vignette);
        gl_FragColor = vec4((base + picture * vignette + noise) * scan, mask);
      }
    `,
  });
}

export function createHeroScene(options: HeroSceneOptions): HeroScene {
const { isMobile, reducedMotion, shadows } = options;

const scene = new THREE.Scene();
  /*
   * A trace of fog, not a room's worth. The old value hid a back wall that no longer
   * exists; at this density it only keeps the furthest orbits from reading as hard as the
   * nearest ones, which is the one depth cue a starfield cannot give on its own.
   */
  scene.fog = new THREE.FogExp2(0x05070d, 0.016);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const initialCamera = new THREE.Vector3(0, 0.2, 4.5);
  // Between the terminal at lower right and the system at upper left, not at either.
  const initialLookAt = new THREE.Vector3(-0.2, 0.15, -1.2);
  camera.position.copy(initialCamera);

  // Rebuild Shader's actual scene hierarchy so the model, screen and camera
  // share the same coordinate system as the reference.
  /*
   * The terminal sits low and right, turned three-quarters, with the sun and the system
   * away to the upper left. It used to sit left of centre facing straight out, which was
   * the right arrangement when a wall was behind it and nothing else was in shot.
   */
  const computer = new THREE.Group();
  /*
   * These look further left than the terminal ends up, and they have to: the model hangs
   * about two units to the +X side of this group's origin (`modelRoot` is offset, then
   * the whole thing is yawed), so positioning the group where you want the screen puts
   * the screen off the right edge of the frame. This is the group position that lands the
   * *screen* at roughly three-quarters across and a third down.
   */
  /*
   * Sits higher than "lower right" sounds, on purpose. The page lays a dark scrim over
   * the bottom of the canvas so the footer stays legible, and the terminal is tall — the
   * case and keyboard hang well below the screen. Placed by eye against the screen alone
   * it lands with its whole body under that scrim, which reads as the case having failed
   * to render at all.
   */
  computer.position.set(isMobile ? -0.62 : -0.42, isMobile ? 0.12 : 0.4, isMobile ? 0.3 : -0.05);
  computer.scale.setScalar(isMobile ? 0.6 : 0.72);
  // Just off square to the lens. Enough of a turn to keep one side panel in shot so the
  // case reads as a solid object rather than a flat front, and no more than that — at the
  // larger angle it was showing more flank than screen and looked knocked askew.
  computer.rotation.y = isMobile ? 0.16 : -0.15;
  /** Where the drift returns to, so the float is an offset and never accumulates. */
  const computerHomeY = computer.position.y;
  scene.add(computer);

  const modelRoot = new THREE.Group();
  modelRoot.position.set(-1.1, -1.4, 0);
  modelRoot.scale.setScalar(0.14);
  modelRoot.rotation.y = Math.PI;
  computer.add(modelRoot);

  let disposed = false;
  let modelLoaded = false;
  /** Textures the computer GLB brought in; nothing else. See the harvest below. */
  const ownedTextures = new Set<any>();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    "/models/joi9000-computer.glb",
    (gltf: any) => {
      if (disposed) return;
      const model = gltf.scene;
      const originalLogo = model.getObjectByName("logo");
      /*
       * Materials taken off the GLB on the way in.
       *
       * `material.dispose()` frees the program, not the maps hanging off it, and a
       * material that has been replaced is no longer reachable from the scene graph
       * at all — so neither it nor its textures would ever be reached by the traverse
       * in `dispose`. Collected here and released with everything else below.
       */
      const retired: any[] = [];
      if (originalLogo) {
        originalLogo.visible = true;
        originalLogo.traverse((object: any) => {
          if (!object.isMesh) return;
          retired.push(object.material);
          object.material = new THREE.MeshStandardMaterial({
            color: 0x090b0e,
            roughness: 0.34,
            metalness: 0.42,
          });
        });
      }
      model.traverse((object: any) => {
        if (!object.isMesh) return;
        object.castShadow = shadows && object.name !== "background";
        object.receiveShadow = true;
        if (object.name === "computer" && object.material) {
          retired.push(object.material);
          object.material = object.material.clone();
          object.material.roughness = 0.8;
          /*
           * The case is moulded plastic, and it is now lit like it.
           *
           * It used to be set to 0.83 metalness, which only held together because the room
           * had five lights in it. A metal has no diffuse response — it shows the
           * environment or it shows nothing — and there is no environment map here, so in
           * an empty starfield the case went completely black and the terminal became a
           * screen hanging on its own. Dropping metalness lets the sky light it as the
           * dielectric it actually is, which costs nothing and needs no invented lamp on
           * the camera side to make up for the sun being behind the case.
           */
          object.material.metalness = 0.18;
          object.material.side = THREE.DoubleSide;
        }
        if (object.name === "keyboard") {
          retired.push(object.material);
          object.material = new THREE.MeshStandardMaterial({
            color: 0x050609,
            roughness: 0.2,
            metalness: 0,
          });
        }
        /*
         * The GLB ships a `background` mesh: a fifty-unit backdrop that stood behind the
         * terminal when this was a room. In space there is nothing for it to be, and it
         * is actively in the way — it is large enough that the camera sits inside its
         * bounds, so once the terminal was turned and moved to the lower right the
         * backdrop swung between the lens and the case and hid it completely. That is
         * what a black rectangle with a glowing screen cut into it turned out to be.
         */
        if (object.name === "background") {
          object.visible = false;
          return;
        }
        // The case is what the sun's light breaks against. `enable`, not `set`: the mesh
        // still has to draw in the beauty pass on layer 0.
        object.layers.enable(OCCLUDER_LAYER);
      });
      /*
       * Everything the GLB brought with it, in one place for `dispose` to free.
       *
       * Scoped deliberately to the model and the materials it arrived with. The
       * screen's map is the film's render target, owned and released by the caller,
       * and the orb, solar and dust modules each free their own — disposing textures
       * from a blind walk of the whole scene would take those with it and leave the
       * stage drawing black on the next mount.
       */
      const harvest = (material: any) => {
        if (!material) return;
        for (const value of Object.values(material)) {
          if ((value as any)?.isTexture) ownedTextures.add(value);
        }
      };
      model.traverse((object: any) => {
        if (!object.isMesh) return;
        if (Array.isArray(object.material)) object.material.forEach(harvest);
        else harvest(object.material);
      });
      retired.forEach((material) => {
        harvest(material);
        material?.dispose?.();
      });

      modelRoot.add(model);
      modelLoaded = true;
      // Six cube faces of shadow were rendered against an empty room. Ask for them again
      // now that there is something in it — and the same for the two maps above, which
      // no longer redraw on their own.
      orb.invalidateShadow();
      invalidateShadows();
    },
    undefined,
    (error: unknown) => {
      console.error("JOI9000 model failed to load", error);
      // Readiness means the loader has settled, not that the optional shell mesh must
      // exist. The screen rig and the rest of the scene remain usable, and deep links
      // must not keep the boot lock or the render loop alive forever after a 404.
      modelLoaded = true;
    },
  );

  const screenRig = new THREE.Group();
  screenRig.position.set(-22, 11, 2);
  screenRig.rotation.y = Math.PI - 0.735;
  modelRoot.add(screenRig);
  const screenMaterial = createCrtMaterial(options.screenMap);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 28, 20), screenMaterial);
  screen.scale.set(10.15, 7.875, 1);
  screen.position.set(-0.2, -0.55, 0.1);
  screen.rotation.x = -0.07;
  screenRig.add(screen);


  const screenLight = new THREE.PointLight(0xf2c79d, 4.6, 7.5, 1.4);
  scene.add(screenLight);

  /*
   * Room lighting, cut down to what a terminal floating in space is entitled to.
   *
   * The bodies do not read these at all — they run their own shader off the sun's
   * position, because terminator hardness is an identity feature and no roughness value
   * expresses it. What is left here exists only so the terminal's case does not fall to
   * a pure silhouette against the starfield: the sun sits behind it, so without a little
   * fill the whole model would be a black rectangle.
   */
  const ambient = new THREE.HemisphereLight(0x8ea6cc, 0x0a0d16, 0.62);
  scene.add(ambient);
  /*
   * A warm key on the camera side of the terminal.
   *
   * There is nothing in space to justify it, and it is here anyway, because the
   * alternative is a black rectangle. The sun sits far behind and to the left, so the
   * only face it can reach is the one turned away from us — light the scene honestly and
   * the terminal is a silhouette with a glowing screen cut into it. The reference image
   * solves this the same way every product shot does, with a key the lighting setup does
   * not otherwise explain. It is tinted to the sun's own colour so it reads as bounce
   * rather than as a second, whiter source.
   */
  const keyLight = new THREE.DirectionalLight(0xffd2a0, 2.6);
  keyLight.position.set(4.5, 3.2, 6.0);
  keyLight.castShadow = shadows;
  keyLight.shadow.mapSize.set(1024, 1024);
  // This key rakes the case at a much lower angle than the old one did, and a grazing
  // directional light is exactly where shadow acne shows up — without a normal bias the
  // case self-shadows into a uniform dark grey.
  keyLight.shadow.normalBias = 0.03;
  keyLight.shadow.bias = -0.0008;
  scene.add(keyLight);
  /*
   * A tight warm spot on the terminal itself.
   *
   * The room this came from lit the case with a 9.5-intensity spot aimed at the desk, and
   * removing it along with the desk is what turned the case black — a directional key
   * spread over the whole scene does not put nearly as much light on one object as a spot
   * aimed at it. It is aimed by `terminalKeyTarget` every frame, because the terminal
   * drifts and a spot that stays pointed at where it used to be is worse than none.
   */
  /*
   * The intensity looks extreme and is not. The stage renders linear into a HalfFloat
   * target and the post chain owns the only tone map, so what matters is this case's
   * linear value against a sun and eight lit bodies — not how it looks rendered straight
   * to an sRGB buffer, where it reads fine at a third of this and then vanishes in the
   * composite. That discrepancy is exactly how the case appeared not to be rendering.
   */
  const terminalKey = new THREE.SpotLight(0xffd2a0, 18, 16, 0.7, 0.7, 1.0);
  terminalKey.castShadow = shadows;
  terminalKey.shadow.mapSize.set(1024, 1024);
  terminalKey.shadow.bias = -0.0006;
  terminalKey.shadow.normalBias = 0.02;
  /*
   * Shadow maps redraw on movement, not on the clock.
   *
   * These two 1024² maps were re-rendered every frame for a scene whose only moving
   * part is the terminal's own slow drift — a tumble of a few hundredths of a radian on
   * three long periods, plus the same again in height. `heroLightOrb` already settled
   * this argument for the cube map next door; this is the same trade with a cheaper
   * test, because the terminal is the only thing either map can be cast by.
   *
   * The thresholds are in the terminal's own units and sized to roughly a texel of
   * movement at this frustum, so the map is rebuilt tens of frames apart instead of
   * sixty times a second, and the edge never visibly steps.
   */
  if (shadows) {
    keyLight.shadow.autoUpdate = false;
    keyLight.shadow.needsUpdate = true;
    terminalKey.shadow.autoUpdate = false;
    terminalKey.shadow.needsUpdate = true;
  }
  let shadowedRotationX = Infinity;
  let shadowedRotationZ = Infinity;
  let shadowedPositionY = Infinity;
  /** Re-cast both maps: the drift moved far enough, or the scene itself changed. */
  const invalidateShadows = () => {
    if (!shadows) return;
    keyLight.shadow.needsUpdate = true;
    terminalKey.shadow.needsUpdate = true;
  };

  const terminalKeyTarget = new THREE.Object3D();
  scene.add(terminalKeyTarget);
  terminalKey.target = terminalKeyTarget;
  scene.add(terminalKey);
  // Cold, from behind, separating the case from the starfield along its far edge.
  const rimLight = new THREE.DirectionalLight(0x6f8ee0, 1.15);
  rimLight.position.set(-4.0, 1.6, -5.0);
  scene.add(rimLight);

  /*
   * The one light in this room that is not on rails. It sits beside the terminal,
   * roughly where a desk lamp would, and the visitor can pick it up and carry it
   * anywhere in the frame — the shadows the case throws and the shafts it cuts out of
   * the fog are both recomputed from wherever they leave it.
   *
   * Its home is offset by tier because the terminal is: on a phone the whole computer
   * group is turned and pushed back, so the space "beside the CRT" is somewhere else.
   */
  const orb = createHeroLightOrb({
    // Behind the terminal and up to the left. Two things decided this: the sun has to be
    // far enough back that the outermost orbit still fits the frame, and it has to sit
    // behind the case rather than beside it, because the case is the only occluder left
    // and the shafts are worth more broken than clean.
    home: isMobile
      ? new THREE.Vector3(-1.5, 1.5, -5.0)
      : new THREE.Vector3(-3.4, 2.1, -6.0),
    reducedMotion,
    shadows,
    /*
     * No volumetric scattering. The march threw a broad soft fan of light across a third
     * of the frame, which is what a lamp does through dust in a room — but this is a sun
     * seen across the solar system, and a sun does not do that. It makes a tight
     * starburst, which the orb now draws on one billboard for a fraction of the cost.
     */
    scattering: false,
    // A lamp this far from the camera is a speck; a sun is not.
    scale: isMobile ? 1.9 : 2.2,
    // Far enough to still be lighting the terminal from five units behind it.
    lightRange: 18,
    lightDecay: 1.1,
    // Strong enough that carrying it to the terminal visibly takes over from the static
    // key. At the terminal's depth it sits a unit or two away, where inverse-square puts
    // it well above everything else lighting the case — which is the point of being able
    // to bring it there.
    lightIntensity: 10.5,
    // There is no floor in space, so nothing to stop the sun being carried downward.
    floorClearance: -1e6,
    // Long enough to look at what you just did, short enough that the composition puts
    // itself back together before the next visitor sees it.
    returnDelay: 3,
  });
  scene.add(orb.group);
  scene.add(orb.composite);

  /*
   * The solar system the terminal is floating in.
   *
   * The orb tells it where the light is, and nothing else. The orbits stay anchored, so
   * dragging the sun re-lights the system instead of dragging it around.
   */
  const solar = createSolarSystem({
    isMobile,
    reducedMotion,
    // Anchored, and deliberately not where the sun starts: the sun is draggable and the
    // system is not, so the two cannot share a position.
    origin: isMobile
      ? new THREE.Vector3(-0.9, 0.9, -4.4)
      : new THREE.Vector3(-2.3, 1.2, -5.2),
  });
  scene.add(solar.group);
  scene.add(solar.sky);
  // A body crossing in front of the sun should cut the shafts, the same way the case
  // does. That is a transit, and it costs nothing here because the scattering pass draws
  // occluders with an override material.
  solar.bodies.forEach((body: any) => body.layers.enable(OCCLUDER_LAYER));

  const dustGeometry = new THREE.BufferGeometry();
  const dustCount = isMobile ? 220 : 520;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustRandom = seededRandom(9000);
  for (let index = 0; index < dustCount; index += 1) {
    const offset = index * 3;
    dustPositions[offset] = (dustRandom() - 0.5) * 14;
    dustPositions[offset + 1] = (dustRandom() - 0.5) * 8;
    dustPositions[offset + 2] = -1 - dustRandom() * 8;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  /*
   * The motes are the effect the visitor is actually looking at.
   *
   * Shafts drawn in screen space are the *shape* of scattered light, but a beam is only
   * visible because there is something suspended in it — so each mote is lit here by its
   * own distance to the orb, inverse-square, and swells a little as it brightens. Carry
   * the orb through the dust and the dust answers, which is what sells the shafts as
   * volume rather than as a gradient laid over the frame.
   *
   * A `PointsMaterial` cannot do this: it has one colour for every point. The cost of
   * replacing it is one uniform update a frame.
   */
  const dustMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      // Interplanetary dust rather than a room's motes: cooler, and much fainter until
      // the sun is near enough to light it.
      uBase: { value: new THREE.Color(0x5a6478) },
      uOrb: { value: new THREE.Vector3() },
      uOrbColor: { value: new THREE.Color(0xffcf9a) },
      uOrbEnergy: { value: 0 },
      uSize: { value: 0.012 },
      /** Half the drawing buffer height, the way three's own size attenuation reads it. */
      uScale: { value: 300 },
    },
    vertexShader: `
      uniform vec3 uOrb;
      uniform float uOrbEnergy;
      uniform float uSize;
      uniform float uScale;
      varying float vLit;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * world;
        float distance = length(world.xyz - uOrb);
        vLit = uOrbEnergy / (1.0 + distance * distance * 0.62);
        gl_PointSize = uSize * (1.0 + vLit * 1.9) * (uScale / max(0.001, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uBase;
      uniform vec3 uOrbColor;
      varying float vLit;
      void main() {
        float falloff = smoothstep(0.5, 0.06, length(gl_PointCoord - 0.5));
        if (falloff <= 0.001) discard;
        vec3 color = uBase + uOrbColor * vLit * 2.4;
        gl_FragColor = vec4(color, falloff * (0.16 + vLit * 0.6));
      }
    `,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  let width = 1;
  let height = 1;
  const finalCamera = new THREE.Vector3();
  const screenWorldPosition = new THREE.Vector3();
  const screenWorldScale = new THREE.Vector3();
  const screenWorldQuaternion = new THREE.Quaternion();
  const screenNormal = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const targetPointer = new THREE.Vector2();
  const edgeLeft = new THREE.Vector3();
  const edgeRight = new THREE.Vector3();
  const lightOrigin = new THREE.Vector3();
  const orbWorld = new THREE.Vector3();
  const drawingBuffer = new THREE.Vector2();
  // One per sea state, in the same order. The terminal is the room's key light, so the
  // desk warms and cools with the weather in the screen.
  const seaLightColors = [
    new THREE.Color(0x9fb4c6),
    new THREE.Color(0x8ea8bd),
    new THREE.Color(0x7d95ab),
    new THREE.Color(0xe0a071),
  ];
  let currentSeaState = 0;
  /** The hero's own clock, which four materials and the pointer gate read. */
  let time = 0;
  /** Last progress the host reported — pointer and click gating still need it. */
  let lastProgress = 0;
  let transitionStartedAt = 0;
  let transitionDuration = 1.1;
  let transitionActive = false;
  let readySent = false;

  const updateFinalCamera = () => {
    screen.updateWorldMatrix(true, false);
    screen.getWorldPosition(screenWorldPosition);
    screen.getWorldScale(screenWorldScale);
    screen.getWorldQuaternion(screenWorldQuaternion);
    screenNormal.set(0, 0, 1).applyQuaternion(screenWorldQuaternion).normalize();
    const radians = THREE.MathUtils.degToRad(50);
    const aspect = width / Math.max(1, height);
    const screenAspect = screenWorldScale.x / Math.max(0.001, screenWorldScale.y);
    const fitDistance = (aspect < screenAspect
      ? screenWorldScale.y / 2 / Math.tan(radians / 2)
      : screenWorldScale.x / 2 / (Math.tan(radians / 2) * aspect)) * 0.9;
    finalCamera.copy(screenWorldPosition).addScaledVector(screenNormal, fitDistance);
  };

  const setSize = (nextWidth: number, nextHeight: number) => {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateFinalCamera();
  };

  const setPointer = (x: number, y: number) => {
    targetPointer.set(x, y);
  };

  /**
   * The sea itself lives in its own scene and the host owns the switch; all this has to
   * do is carry the new state through to the light, so the terminal's glow on the desk
   * changes with the weather on the screen.
   */
  const setSeaState = (index: number) => {
    currentSeaState = index % seaLightColors.length;
  };

  const update = (delta: number, progress: number) => {
    lastProgress = progress;
    time += delta;
    screenMaterial.uniforms.uTime.value = time;
    pointer.lerp(targetPointer, reducedMotion ? 1 : 1 - Math.exp(-5.4 * delta));
    const journey = clamp01(progress);
    const cameraProgressBase = Math.min(journey / 0.8, 1);
    const cameraProgress = 1 - Math.pow(1 - cameraProgressBase, 1.4);
    const parallaxStrength = 1 - cameraProgress;
    const filmHandoff = smooth((journey - 0.66) / 0.22);
    screenMaterial.uniforms.uScreenAmount.value = 1 - filmHandoff;
    updateFinalCamera();
    lightOrigin.copy(screenWorldPosition).addScaledVector(screenNormal, 0.26);
    screenLight.position.copy(lightOrigin);
    screenLight.color.lerp(seaLightColors[currentSeaState], 1 - Math.exp(-2.4 * delta));
    // Follow the terminal as it drifts, from a little above and to the camera's right.
    terminalKeyTarget.position.copy(screenWorldPosition);
    // The sun is carried in a plane through the terminal, so it can be brought round to
    // the front and light the face the camera sees instead of only passing behind it.
    orb.setCarryAnchor(screenWorldPosition);
    terminalKey.position.set(
      screenWorldPosition.x + 2.6,
      screenWorldPosition.y + 2.4,
      screenWorldPosition.z + 3.4,
    );
    /*
     * How much of the room is still in shot. The terminal used to draw a cone of light
     * down onto the desk on this curve — a mesh pretending to be a shaft, from before
     * anything here scattered for real. The orb's shafts are marched out of an occlusion
     * buffer, so the two read as different kinds of light in the same frame and the fake
     * one lost. The curve stays; it is now what carries the room out as the camera
     * arrives at the glass.
     */
    const outsideScreen = 1 - smooth((journey - 0.56) / 0.22);
    const orbEnergy = orb.update(delta, time, outsideScreen);
    orb.group.getWorldPosition(orbWorld);
    dustMaterial.uniforms.uOrb.value.copy(orbWorld);
    dustMaterial.uniforms.uOrbEnergy.value = orbEnergy;
    // Order matters: the sun has already moved this frame, and every orbit is evaluated
    // about where it is now.
    solar.setSunPosition(orbWorld);
    // The terminal is what the frame is focused on, so its distance is the focal plane.
    solar.update(delta, time, orbEnergy, camera, camera.position.distanceTo(screenWorldPosition));

    /*
     * The terminal floats. It had a desk under it and now it does not, so it needs its
     * own small motion or it reads as pinned to the camera rather than adrift — a long
     * slow tumble on three different periods, so the loop never lines back up.
     */
    if (!reducedMotion) {
      computer.rotation.x = Math.sin(time * 0.13) * 0.045;
      computer.rotation.z = Math.cos(time * 0.09) * 0.035;
      computer.position.y = computerHomeY + Math.sin(time * 0.21) * 0.075;
    }
    if (
      shadows &&
      (Math.abs(computer.rotation.x - shadowedRotationX) > 0.004 ||
        Math.abs(computer.rotation.z - shadowedRotationZ) > 0.004 ||
        Math.abs(computer.position.y - shadowedPositionY) > 0.006)
    ) {
      shadowedRotationX = computer.rotation.x;
      shadowedRotationZ = computer.rotation.z;
      shadowedPositionY = computer.position.y;
      invalidateShadows();
    }
    screenLight.intensity = 3.7 + Math.sin(time * 1.2) * 0.24;
    camera.position.lerpVectors(initialCamera, finalCamera, cameraProgress);
    camera.position.x += pointer.x * 0.3 * parallaxStrength;
    camera.position.y += pointer.y * 0.3 * parallaxStrength;
    lookAt.lerpVectors(initialLookAt, screenWorldPosition, cameraProgress);
    camera.lookAt(lookAt);
    dust.rotation.z += reducedMotion ? 0 : delta * 0.006;
    if (!readySent && modelLoaded) {
      readySent = true;
      options.onModelReady();
    }
  };

  /**
   * Width of the screen mesh in device pixels, as it currently sits on the stage. The
   * ocean target is a fixed size, so the ratio between the two is how many octaves of
   * minification the picture is taking — which the sea folds into its own filtering
   * rather than leaving to crawl.
   */
  const screenPixelWidth = () => {
    screen.updateWorldMatrix(true, false);
    edgeLeft.set(-0.5, 0, 0).applyMatrix4(screen.matrixWorld).project(camera);
    edgeRight.set(0.5, 0, 0).applyMatrix4(screen.matrixWorld).project(camera);
    return Math.abs(edgeRight.x - edgeLeft.x) * 0.5 * width;
  };

  return {
    scene,
    camera,
    setSize,
    screenPixelWidth,
    update,
    setPointer,
    setSeaState,
    prepare: (renderer: any) => {
      // Point size attenuation is in device pixels, and the stage's DPR is the host's
      // business — so read it off the renderer rather than guessing from the CSS size.
      renderer.getDrawingBufferSize(drawingBuffer);
      dustMaterial.uniforms.uScale.value = drawingBuffer.y * 0.5;
      orb.prepare(renderer, scene, camera);
    },
    orbHitTest: (ndc) => orb.hitTest(ndc, camera),
    grabOrb: (ndc) => orb.grab(ndc, camera),
    moveOrb: (ndc) => orb.moveTo(ndc, camera),
    releaseOrb: () => orb.release(),
    isOrbHeld: () => orb.isHeld(),
    isReady: () => readySent,
    dispose: () => {
      disposed = true;
      orb.dispose();
      solar.dispose();
      scene.traverse((object: any) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.());
        else object.material?.dispose?.();
      });
      ownedTextures.forEach((texture) => texture.dispose?.());
      ownedTextures.clear();
      dracoLoader.dispose();
    },
  };
}
