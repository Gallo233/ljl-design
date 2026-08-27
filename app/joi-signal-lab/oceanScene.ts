import * as THREE from "three";

/**
 * The open sea, as a scene rather than a component.
 *
 * It owns no renderer, no canvas, no rAF and no React — the host calls `update` once a
 * frame and renders `scene` through `camera` into a target, and the CRT screen material
 * samples that target. That indirection is the whole point: the JOI9000's glass already
 * knows how to be a television (rounded mask, vignette, scanlines, the bulge of the
 * tube), and a picture handed to it inherits all of that for free. It also decouples the
 * two cameras — the hero's flies into the screen through a 40° swing while this one has
 * to hold the horizon dead still, and a sea built as geometry in the hero scene would
 * have the horizon walking across the glass.
 *
 * The numbers here are measured off the reference footage, not invented:
 *
 *   - The horizon sits at 43% of frame height. `PITCH` is derived from that, not chosen.
 *   - Wave amplitude falls as 1/k across the octaves. A DFT of the reference water showed
 *     energy from k=3 to k=14+ with that roll-off — a Phillips spectrum shape. Two or
 *     three sines cannot make this picture. Because A·k is then the same constant for
 *     every wave, one scalar (`steepness`) sets the whole sea state.
 *   - Every colour is an eyedropper reading off the footage, written as the sRGB hex it
 *     was measured as.
 *   - The sun sits low, 3°–14°. This is not a mood choice: the specular path appears
 *     below the horizon by the sun's own elevation, so a high sun puts the glitter
 *     entirely off the bottom of the frame. At 8° it lands at 63% down — mid-water.
 *
 * What sells the water, in order: Fresnel (which is the whole near/far cold-warm split,
 * and is not two colours but one F0 of 0.02), multi-scale wave normals, the glitter
 * path, horizon haze, and the turquoise subsurface glow on backlit crests. There is
 * deliberately no foam — stacking four consecutive frames of the reference's calm shot
 * shows open water carries almost none, and foam accumulation is the most expensive
 * thing we would have built to get something nobody would have noticed.
 */

/**
 * Measured off the reference footage. sRGB hex.
 *
 * The sky ramp runs *bright to dark* going up, which looks wrong written down and is
 * exactly right on screen: a hazy marine sky is palest at the waterline, where the line
 * of sight travels through the most atmosphere, and deepens to blue overhead. Sampling
 * the reference with clouds averaged in hid this — the horizon band reads #c1c6ce and
 * the clear blue between the clouds reads #7388a9. Inverting this ramp is what made the
 * first draft's sky a flat grey wash.
 */
const MEASURED = {
  /** The pale band right at the waterline. The water's far edge dissolves into this. */
  skyHorizon: 0xaebbc9,
  skyLow: 0xb3c2da,
  skyMid: 0x8fa6cd,
  /** Clear blue between the clouds, overhead. */
  skyHigh: 0x5f80b4,
  /** Cloud tops. */
  cloud: 0xf4f7fa,
  /** Water body looking steeply down, in a trough. */
  deep: 0x0d4470,
  /** Water body on the lit shoulder of a crest. */
  shallow: 0x2a6f96,
  /** Backlit thin crests. */
  sss: 0x2ec4b6,
} as const;

/**
 * The stage grade downstream of us is sepia 0.18 and contrast 1.04 while the hero owns
 * the frame (`JoiSignalLab.tsx`, where `uSepiaIntensity` lerps 0.18 -> 0.035), plus a
 * warm phosphor add. All of that pushes blue-green toward warm grey. Rather than reach
 * into `postfx.ts`, which every other section of the page shares, the sea pre-compensates
 * here. These two are the tuning surface — raise saturation until the sea reads as sea
 * through the filter, cool until the phosphor's yellow stops tinting the haze.
 */
const GRADE_SATURATION = 1.15;
const GRADE_COOL = 0.075;

/** Vertical field of view, degrees. */
const FOV = 38;
/** Where the horizon lands, as a fraction of frame height from the top. Measured. */
const HORIZON_SCREEN_Y = 0.43;
/** Eye height above mean sea level, metres. A deck, not a helicopter. */
const EYE_HEIGHT = 6.5;
/** Beyond this the regular grid stops and two skirt rows carry the rest to the horizon. */
const MAX_REGULAR_DISTANCE = 3000;
const SKIRT_DISTANCES = [12000, 60000];

/**
 * The boat, out at the far end of the water.
 *
 * Placed off the sun's side so it never sits inside the glitter path, and far enough
 * that a four-metre mast comes to about fourteen pixels — a speck you have to notice
 * rather than a subject. It rides the same Gerstner sum the surface does, sampled on the
 * CPU for its one point, so it lifts and heels with the water under it instead of
 * sliding across a picture of it.
 */
const BOAT_X = -74;
const BOAT_Z = -330;
const BOAT_HULL = 0xb2372b;
const BOAT_SAIL = 0xf6f3ec;

/** Longest wavelength in the cascade, metres, and the ratio between octaves. */
const BASE_WAVELENGTH = 78;
const OCTAVE_RATIO = 0.585;
const GRAVITY = 9.81;
/** Which octave the cascade's energy gathers around, and how broadly. */
const SPECTRAL_PEAK_OCTAVE = 1.5;
const SPECTRAL_PEAK_WIDTH = 2.8;

export type SeaState = {
  /** Shown in the terminal HUD. */
  label: string;
  /**
   * A·k, shared by every wave in the cascade. This one number is the sea state: it sets
   * slope variance, and therefore roughness, whitecap-free chop and how hard the glitter
   * path breaks up. sigma = 0.87 * A0, significant wave height ~= 3.5 * A0.
   */
  steepness: number;
  /** Gerstner horizontal pinch. Sharpens crests; the loop-safety bound is N*Q*steepness <= 1. */
  choppy: number;
  /** Degrees above the horizon. Low, or the glitter path leaves the frame. */
  sunElevation: number;
  /** Degrees off the view direction. */
  sunAzimuth: number;
  sunColor: number;
  sunIntensity: number;
  detail: number;
  sss: number;
  hazeDensity: number;
  /** Tints the room's key light, so the terminal's glow spills the sea onto the desk. */
  roomLight: number;
  skyHorizon: number;
  skyLow: number;
  skyMid: number;
  skyHigh: number;
  deep: number;
  shallow: number;
};

export const SEA_STATES: SeaState[] = [
  {
    label: "SEA 00 / CALM",
    steepness: 0.085,
    choppy: 0.72,
    sunElevation: 8,
    sunAzimuth: 9,
    sunColor: 0xfff4e2,
    sunIntensity: 1,
    detail: 0.55,
    sss: 0.25,
    hazeDensity: 0.00070,
    roomLight: 0x9fb4c6,
    skyHorizon: MEASURED.skyHorizon,
    skyLow: MEASURED.skyLow,
    skyMid: MEASURED.skyMid,
    skyHigh: MEASURED.skyHigh,
    deep: MEASURED.deep,
    shallow: MEASURED.shallow,
  },
  {
    label: "SEA 01 / SWELL",
    steepness: 0.098,
    choppy: 0.80,
    sunElevation: 11,
    sunAzimuth: -16,
    sunColor: 0xfff0d8,
    sunIntensity: 1.1,
    detail: 0.7,
    sss: 0.45,
    hazeDensity: 0.00060,
    roomLight: 0x8ea8bd,
    skyHorizon: 0xb4bcc8,
    skyLow: 0x9aa6bd,
    skyMid: 0x8194b4,
    skyHigh: 0x647ca0,
    deep: 0x083f52,
    shallow: 0x1d5568,
  },
  {
    label: "SEA 02 / WIND",
    steepness: 0.145,
    choppy: 0.95,
    sunElevation: 14,
    sunAzimuth: 30,
    sunColor: 0xe8ecf0,
    sunIntensity: 0.85,
    detail: 1,
    sss: 0.85,
    hazeDensity: 0.00105,
    roomLight: 0x7d95ab,
    skyHorizon: 0xc3c7cc,
    skyLow: 0xa9afb9,
    skyMid: 0x8d95a3,
    skyHigh: 0x76808f,
    deep: 0x123f4c,
    shallow: 0x2b5a66,
  },
  {
    label: "SEA 03 / DUSK",
    steepness: 0.078,
    choppy: 0.74,
    sunElevation: 3,
    sunAzimuth: -6,
    sunColor: 0xffb877,
    sunIntensity: 1.45,
    detail: 0.65,
    sss: 0.55,
    hazeDensity: 0.00095,
    roomLight: 0xe0a071,
    skyHorizon: 0xe0a98c,
    skyLow: 0xb08a90,
    skyMid: 0x6a6a8f,
    skyHigh: 0x3c4a6b,
    deep: 0x08283f,
    shallow: 0x1b4256,
  },
];

export type OceanSceneOptions = {
  isMobile: boolean;
  reducedMemory: boolean;
  reducedMotion: boolean;
  /** Aspect of the screen this is drawn for. The camera is fixed to it, not to a viewport. */
  aspect: number;
};

export type OceanScene = {
  scene: any;
  camera: any;
  update: (delta: number) => void;
  /** Move to the next sea state and return its index. */
  cycleSeaState: () => number;
  /** The state currently being lerped toward. */
  seaState: () => number;
  /** Pointer in normalised device coordinates; leans the wind and swings the sun. */
  setPointer: (x: number, y: number) => void;
  /**
   * How many octaves the picture is being shrunk by on its way to the glass. At the top
   * of the page the CRT is small and the target is minified ~4x; folding that into the
   * shader's own filtering is what stops the glitter crawling.
   */
  setLodBias: (octaves: number) => void;
  dispose: () => void;
};

/**
 * Colour management is on, so `new THREE.Color(hex)` already reads the hex as sRGB and
 * stores linear-sRGB working values. Calling `convertSRGBToLinear()` on top of that
 * converts a second time and squares the value — which is what made the first draft of
 * this sea come out near-black. The constructor alone is the conversion.
 */
const linear = (hex: number) => new THREE.Color(hex);

/**
 * A screen-space lattice unprojected onto y = 0, built once because the camera never
 * moves. Vertex density is uniform in *screen* space, which is what you actually want:
 * dense near the camera, sparse toward the horizon, with no popping and no warp function
 * to tune. The two skirt rows are how the far boundary disappears — the last regular row
 * at 3 km still projects several pixels below the true horizon, which reads as a seam,
 * while the 60 km row lands inside a pixel of it and is fully hazed besides.
 */
function buildProjectedGrid(cols: number, rows: number, camera: any, horizonNdc: number) {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const totalRows = rows + SKIRT_DISTANCES.length;
  const positions = new Float32Array(cols * totalRows * 3);
  const spacing = new Float32Array(cols * totalRows);
  const origin = camera.position;
  const probe = new THREE.Vector3();

  const place = (index: number, x: number, z: number) => {
    positions[index * 3] = x;
    positions[index * 3 + 1] = 0;
    positions[index * 3 + 2] = z;
  };

  for (let row = 0; row < rows; row += 1) {
    // Stop just short of the horizon; the skirt rows cover the rest. The near end runs
    // well below the frame so a deep trough cannot let the camera see under the mesh.
    const yNdc = THREE.MathUtils.lerp(-1.45, horizonNdc - 0.0087, row / (rows - 1));
    for (let col = 0; col < cols; col += 1) {
      // 6% lateral overscan so the Gerstner horizontal pinch can never pull an edge
      // vertex into frame.
      const xNdc = THREE.MathUtils.lerp(-1.06, 1.06, col / (cols - 1));
      probe.set(xNdc, yNdc, 0.5).unproject(camera).sub(origin).normalize();
      const distance =
        probe.y < -1e-6
          ? Math.min(-origin.y / probe.y, MAX_REGULAR_DISTANCE)
          : MAX_REGULAR_DISTANCE;
      place(row * cols + col, origin.x + probe.x * distance, origin.z + probe.z * distance);
    }
  }

  // Push the last regular row's bearings out to the skirt distances.
  for (let s = 0; s < SKIRT_DISTANCES.length; s += 1) {
    const source = (rows - 1) * cols;
    const target = (rows + s) * cols;
    for (let col = 0; col < cols; col += 1) {
      const x = positions[(source + col) * 3] - origin.x;
      const z = positions[(source + col) * 3 + 2] - origin.z;
      const length = Math.max(1e-6, Math.hypot(x, z));
      const scale = SKIRT_DISTANCES[s] / length;
      place(target + col, origin.x + x * scale, origin.z + z * scale);
    }
  }

  // World-space vertex spacing, for the geometric LOD. Measured, not guessed.
  const gap = (a: number, b: number) =>
    Math.hypot(positions[a * 3] - positions[b * 3], positions[a * 3 + 2] - positions[b * 3 + 2]);
  for (let row = 0; row < totalRows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const across = gap(index, col + 1 < cols ? index + 1 : index - 1);
      const along = gap(index, row + 1 < totalRows ? index + cols : index - cols);
      spacing[index] = Math.max(across, along);
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < totalRows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const a = row * cols + col;
      // Counter-clockwise seen from above, so the sea faces the sky and backface
      // culling keeps working for us rather than deleting the whole ocean.
      indices.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSpacing", new THREE.BufferAttribute(spacing, 1));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Shared by the sky dome and by the water's reflection and haze. One function, because
 * the moment the haze the sea fades into stops being the sky directly above it, the
 * horizon grows a seam — and that seam is the classic tell of a fake ocean.
 */
const SKY_GLSL = /* glsl */ `
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyLow;
  uniform vec3 uSkyMid;
  uniform vec3 uSkyHigh;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;

  // The visible sky only spans about 16 degrees above the horizon at this field of view,
  // so the ramp is compressed into 0.42 rather than the half-dome it would cover on an
  // open camera. Stretched over the full dome the frame never leaves the pale end and
  // the whole sky reads as haze.
  vec3 oceanSky(vec3 dir) {
    float t = clamp(dir.y / 0.42, 0.0, 1.0);
    vec3 col = mix(uSkyHorizon, uSkyLow, smoothstep(0.0, 0.14, t));
    col = mix(col, uSkyMid, smoothstep(0.12, 0.45, t));
    col = mix(col, uSkyHigh, smoothstep(0.4, 1.0, t));
    return col;
  }
`;

/**
 * Saturation and cool-shift, applied last. The only place the stage grade is compensated
 * for; nothing downstream knows the sea exists.
 */
const GRADE_GLSL = /* glsl */ `
  vec3 oceanGrade(vec3 colour) {
    float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    vec3 out_ = mix(vec3(grey), colour, ${GRADE_SATURATION.toFixed(3)});
    out_.b *= 1.0 + ${GRADE_COOL.toFixed(3)};
    out_.r *= 1.0 - ${GRADE_COOL.toFixed(3)} * 0.55;
    return max(out_, 0.0);
  }
`;

export function createOceanScene(options: OceanSceneOptions): OceanScene {
  const { isMobile, reducedMemory, reducedMotion, aspect } = options;

  // Reduced motion calms the sea; it does not freeze it. A still ocean inside a live CRT
  // reads as a broken screen, and the stronger house rule is never to show something that
  // looks failed. Small and slow removes the large, fast motion that actually causes
  // discomfort while keeping the tube alive.
  const motionScale = reducedMotion ? 0.35 : 1;
  const steepnessScale = reducedMotion ? 0.57 : 1;

  const waveCount = reducedMotion ? 3 : isMobile ? 5 : reducedMemory ? 6 : 8;
  const detailOctaves = reducedMotion ? 1 : isMobile || reducedMemory ? 2 : 3;
  // Reduced motion keeps a full-resolution picture — the ask is less movement, not a
  // worse image — but with only three waves left in the cascade the densest grid has
  // nothing to resolve, so it drops a step rather than paying for vertices that cannot
  // move anything.
  const cols = isMobile ? 96 : reducedMemory || reducedMotion ? 144 : 192;
  const rows = isMobile ? 88 : reducedMemory || reducedMotion ? 120 : 162;

  const scene = new THREE.Scene();

  // The horizon's screen position is the measurement; the pitch is derived from it.
  const horizonNdc = (0.5 - HORIZON_SCREEN_Y) * 2;
  const fovRadians = THREE.MathUtils.degToRad(FOV);
  const pitch = Math.atan(horizonNdc * Math.tan(fovRadians / 2));
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 1, 90000);
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.set(-pitch, 0, 0);

  // The cascade, built once. Amplitude falls as 1/k, so A*k is one shared constant and
  // the analytic Gerstner normal collapses to a plain sum of cosines.
  const waveK = new Float32Array(waveCount);
  const waveWeight = new Float32Array(waveCount);
  const waveOmega = new Float32Array(waveCount);
  const wavePhase = new Float32Array(waveCount);
  const waveDir = new Float32Array(waveCount * 2);
  const waveData = new Float32Array(waveCount * 4);
  for (let i = 0; i < waveCount; i += 1) {
    const wavelength = BASE_WAVELENGTH * Math.pow(OCTAVE_RATIO, i);
    waveK[i] = (Math.PI * 2) / wavelength;
    // Deep-water dispersion. This is what makes the long swell crawl while the chop
    // skitters; a shared speed is the clearest tell that water was faked.
    waveOmega[i] = Math.sqrt(GRAVITY * waveK[i]);
    wavePhase[i] = i * 1.7;
    // Log-normal around the second octave, so the dominant swell reads and the short
    // end thins out rather than competing with it.
    const fromPeak = (i - SPECTRAL_PEAK_OCTAVE) / SPECTRAL_PEAK_WIDTH;
    waveWeight[i] = Math.exp(-0.5 * fromPeak * fromPeak);
  }

  const scratchDir = new THREE.Vector2();
  /*
   * The table has two halves with very different lifetimes.
   *
   * Direction, wavenumber, amplitude and choppiness are functions of the sea state and
   * the wind angle, and both of those converge — a few seconds after a state change, or
   * after the pointer stops, they are constant. Phase is what actually makes the water
   * move, and has to be rewritten every frame.
   *
   * They used to be written together, so a settled sea still ran two trig calls and a
   * power per wave per frame to arrive at the numbers it already had. Splitting them
   * keeps the water moving and stops recomputing the parts that are standing still.
   */
  let tabledSteepness = Infinity;
  let tabledChoppy = Infinity;
  let tabledWindAngle = Infinity;
  const writeWaveShape = (steepness: number, choppy: number, windAngle: number) => {
    if (
      Math.abs(steepness - tabledSteepness) < 1e-6 &&
      Math.abs(choppy - tabledChoppy) < 1e-6 &&
      Math.abs(windAngle - tabledWindAngle) < 1e-6
    ) {
      return;
    }
    tabledSteepness = steepness;
    tabledChoppy = choppy;
    tabledWindAngle = windAngle;
    for (let i = 0; i < waveCount; i += 1) {
      const spread =
        (i % 2 === 0 ? 1 : -1) * 1.05 * Math.pow(i / Math.max(1, waveCount - 1), 0.7) +
        0.37 * Math.sin(2.399 * i);
      scratchDir.set(Math.cos(windAngle + spread), Math.sin(windAngle + spread));
      waveDir[i * 2] = scratchDir.x;
      waveDir[i * 2 + 1] = scratchDir.y;
      waveData[i * 4] = waveK[i];
      waveData[i * 4 + 1] = (steepness / waveK[i]) * waveWeight[i];
      waveData[i * 4 + 3] = choppy;
    }
  };
  /** Every frame, unconditionally: this is the motion. */
  const writeWavePhase = () => {
    for (let i = 0; i < waveCount; i += 1) waveData[i * 4 + 2] = wavePhase[i];
  };
  const writeWaveTable = (steepness: number, choppy: number, windAngle: number) => {
    writeWaveShape(steepness, choppy, windAngle);
    writeWavePhase();
  };
  writeWaveTable(SEA_STATES[0].steepness * steepnessScale, SEA_STATES[0].choppy, 0.18);

  const seaUniforms: any = {
    uWave: { value: waveData },
    uWaveDir: { value: waveDir },
    uSteepness: { value: SEA_STATES[0].steepness * steepnessScale },
    uDetail: { value: SEA_STATES[0].detail },
    uDetailPhase: { value: new THREE.Vector3() },
    uSss: { value: SEA_STATES[0].sss },
    uHazeDensity: { value: SEA_STATES[0].hazeDensity },
    uWind: { value: new THREE.Vector2(1, 0) },
    uCameraPos: { value: new THREE.Vector3() },
    uLodBias: { value: 0 },
    uDeep: { value: linear(SEA_STATES[0].deep) },
    uShallow: { value: linear(SEA_STATES[0].shallow) },
    uSssColor: { value: linear(MEASURED.sss) },
    uSunDir: { value: new THREE.Vector3(0, 0.14, -1).normalize() },
    uSunColor: { value: linear(SEA_STATES[0].sunColor) },
    uSunIntensity: { value: SEA_STATES[0].sunIntensity },
    uSkyHorizon: { value: linear(SEA_STATES[0].skyHorizon) },
    uSkyLow: { value: linear(SEA_STATES[0].skyLow) },
    uSkyMid: { value: linear(SEA_STATES[0].skyMid) },
    uSkyHigh: { value: linear(SEA_STATES[0].skyHigh) },
  };

  const seaMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    defines: { WAVE_COUNT: waveCount, DETAIL_OCTAVES: detailOctaves },
    uniforms: seaUniforms,
    vertexShader: /* glsl */ `
      #define INV_TWO_PI 0.15915494

      uniform vec4 uWave[WAVE_COUNT];
      uniform vec2 uWaveDir[WAVE_COUNT];

      attribute float aSpacing;

      varying vec2 vSurfPos;
      varying vec3 vWorldPos;
      varying float vHeight;
      varying float vSpacing;

      void main() {
        vec2 p = position.xz;
        // The UNDISPLACED point. Gerstner is parameterised by the grid position, so the
        // fragment normal has to be evaluated here too; using the displaced xz instead
        // makes the shading swim against the geometry in a way that is very hard to
        // diagnose later.
        vSurfPos = p;
        vSpacing = aSpacing;

        vec3 displaced = vec3(p.x, 0.0, p.y);
        vec2 pinch = vec2(0.0);
        for (int i = 0; i < WAVE_COUNT; i++) {
          // A wave the grid cannot resolve leaves the geometry. It does not leave the
          // shading — the fragment normal keeps it until the pixel cannot resolve it.
          float lod = 1.0 - smoothstep(0.18, 0.42, aSpacing * uWave[i].x * INV_TWO_PI);
          if (lod <= 0.0) continue;
          vec2 dir = uWaveDir[i];
          float phase = dot(dir, p) * uWave[i].x + uWave[i].z;
          displaced.y += uWave[i].y * sin(phase) * lod;
          pinch += dir * (uWave[i].w * uWave[i].y * cos(phase) * lod);
        }

        // The Gerstner pinch is what sharpens crests, and it is also what tears the mesh
        // if it moves a vertex past its neighbour. A projected grid is violently
        // foreshortened near the camera — rows down there sit centimetres apart while a
        // swell wants to pull a vertex a full metre — so the classic sum-of-steepness
        // bound is not enough on its own. Clamping against the measured local spacing is,
        // and it only bites in the near field, where the water is being viewed almost
        // straight down and the sharpening was doing little anyway.
        float pinchLimit = aSpacing * 0.4;
        float pinchLength = length(pinch);
        if (pinchLength > pinchLimit) pinch *= pinchLimit / pinchLength;
        displaced.xz += pinch;

        vHeight = displaced.y;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      #define INV_TWO_PI 0.15915494
      #define PI 3.14159265359
      // How much of the host's minification to actually spend on smoothing.
      #define LOD_BIAS_WEIGHT 0.4

      uniform vec4 uWave[WAVE_COUNT];
      uniform vec2 uWaveDir[WAVE_COUNT];
      uniform float uSteepness;
      uniform float uDetail;
      uniform vec3 uDetailPhase;
      uniform float uSss;
      uniform float uHazeDensity;
      uniform vec2 uWind;
      uniform vec3 uCameraPos;
      uniform float uLodBias;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSssColor;

      varying vec2 vSurfPos;
      varying vec3 vWorldPos;
      varying float vHeight;
      varying float vSpacing;

      ${SKY_GLSL}
      ${GRADE_GLSL}

      float saturate1(float v) { return clamp(v, 0.0, 1.0); }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      // Value noise with analytic derivatives. Finite differences alias worse than the
      // signal they are trying to measure, which is the whole problem here.
      vec3 noised(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));
        float k1 = b - a;
        float k2 = c - a;
        float k3 = a - b - c + d;
        return vec3(
          a + k1 * u.x + k2 * u.y + k3 * u.x * u.y,
          du.x * (k1 + k3 * u.y),
          du.y * (k2 + k3 * u.x)
        );
      }

      // Peak glints land around 3 in scene-linear: past the bloom knee, still with
      // gradient left for the tone mapper's shoulder to shape.
      #define SUN_RADIANCE 0.18

      float ggxD(float NoH, float alpha) {
        float a2 = alpha * alpha;
        float d = NoH * NoH * (a2 - 1.0) + 1.0;
        return a2 / max(PI * d * d, 1e-8);
      }
      float smithG1(float NoX, float alpha) {
        float a2 = alpha * alpha;
        return 2.0 * NoX / max(NoX + sqrt(a2 + (1.0 - a2) * NoX * NoX), 1e-8);
      }

      void main() {
        float dist = length(vWorldPos - uCameraPos);

        // How much surface one pixel covers, in metres. uLodBias folds in the
        // minification the CRT applies on the way to the glass — at the top of the page
        // the terminal is small and the target is shrunk about fourfold, and without
        // this the glitter crawls.
        float footprint = max(length(dFdx(vSurfPos)), length(dFdy(vSurfPos)));
        footprint = clamp(footprint * exp2(uLodBias * LOD_BIAS_WEIGHT), vSpacing * 0.25, 400.0);

        // Slope variance the pixel cannot resolve does not vanish — it reappears as lobe
        // width. Filtering the normal *distribution* rather than the normal is what turns
        // sun glitter from crawling noise into a coherent path.
        vec2 slope = vec2(0.0);
        float dy = 0.0;
        float lostVariance = 0.0;
        for (int i = 0; i < WAVE_COUNT; i++) {
          float k = uWave[i].x;
          float steep = uWave[i].y * k;
          float lod = 1.0 - smoothstep(0.85, 1.9, footprint * k * INV_TWO_PI);
          vec2 dir = uWaveDir[i];
          float phase = dot(dir, vSurfPos) * k + uWave[i].z;
          slope -= dir * (steep * cos(phase) * lod);
          dy -= uWave[i].w * steep * sin(phase) * lod;
          lostVariance += (1.0 - lod * lod) * steep * steep * 0.5;
        }

        // Capillary detail below the shortest Gerstner wave. Roll-off is 1/2.17 so the
        // slope contribution per octave stays constant — the same spectrum, continued.
        float frequency = 0.9;
        float amplitude = 0.030 * uDetail;
        for (int i = 0; i < DETAIL_OCTAVES; i++) {
          vec2 p = vSurfPos * frequency + uWind * uDetailPhase[i];
          float lod = 1.0 - smoothstep(0.85, 1.9, footprint * frequency);
          vec3 n = noised(p);
          slope -= n.yz * amplitude * frequency * lod;
          lostVariance += (1.0 - lod * lod) * pow(amplitude * frequency, 2.0) * 0.5;
          frequency *= 2.17;
          amplitude *= 0.46;
        }

        vec3 normal = normalize(vec3(slope.x, 1.0 + dy, slope.y));
        // Seen from underneath, the surface is still the surface: keep the normal on the
        // sky side so a backfacing triangle shades as water instead of as a hole.
        if (!gl_FrontFacing) normal = -normal;
        vec3 view = normalize(uCameraPos - vWorldPos);
        vec3 half_ = normalize(uSunDir + view);

        float NoV = saturate1(dot(normal, view));
        float NoL = saturate1(dot(normal, uSunDir));
        float NoH = saturate1(dot(normal, half_));

        // GGX roughness from the variance we just threw away, plus a floor so the far
        // field cannot go mirror-smooth and strobe.
        float variance = lostVariance + 0.002;
        float alpha = clamp(sqrt(2.0 * variance), 0.035, 0.6);
        alpha = max(alpha, 0.13 * smoothstep(260.0, 1100.0, dist));

        // Schlick, F0 = 0.02 for water, held off a perfect mirror by roughness. This one
        // term is the entire near/far split: 12% sky at the bottom of frame, 86% at the
        // horizon. The two measured colour families are not two colours — they are this.
        float F0 = 0.02037;
        float fresnel = F0 + (max(1.0 - alpha, F0) - F0) * pow(1.0 - NoV, 5.0);
        // Two corrections, both pulling the same way. A rough surface reflects less at
        // grazing than a flat one at the same angle, because some of its facets are
        // turned toward the viewer — and the LOD above deliberately flattens the far
        // field for antialiasing, which without this would hand the horizon a mirror
        // finish it has not earned. The cap is the stylisation the reference makes too:
        // its water still reads as water right up to the skyline rather than dissolving
        // into a reflection of it.
        fresnel *= mix(1.0, 0.62, clamp(alpha * 3.2, 0.0, 1.0));
        fresnel = min(fresnel, 0.80);

        // Rough water does not mirror the bright horizon band the way a flat sheet
        // would: the tilted facets send a good share of the reflected rays higher up the
        // dome, where the sky is darker and bluer. Lifting the reflection vector by the
        // roughness is the cheap stand-in for that, and it is what keeps the far water
        // reading as water instead of converging onto the sky a few hundred metres out.
        vec3 reflected = reflect(-view, normal);
        reflected.y += alpha * 1.15;
        vec3 sky = oceanSky(normalize(reflected));

        // Troughs see less sky than crests, which is why the darker measurement belongs
        // to the low water rather than to the distance.
        float skyAccess = saturate1(0.5 + 0.5 * normal.y) *
          (0.65 + 0.35 * saturate1(vHeight / max(uSteepness * 40.0, 0.05) * 0.5 + 0.5));
        vec3 body = mix(uDeep, uShallow, skyAccess);

        vec3 colour = mix(body, sky, fresnel);

        // Thin backlit crests. Keyed on height, so calm shows almost none and wind lights up.
        vec3 bent = normalize(uSunDir - normal * 0.4);
        float lift = saturate1(vHeight / max(uSteepness * 30.0, 0.05));
        float sss = pow(saturate1(dot(view, -bent)), 4.0) * lift * lift * saturate1(1.0 - normal.y);
        colour += uSssColor * sss * uSss;

        colour = oceanGrade(colour);

        // The glitter, added after the grade and deliberately above 1.0 — it is meant to
        // blow out and feed the bloom, which is where the expensive read lives.
        //
        // Two things this has to get right. The sun is a disk about half a degree wide,
        // not a point: at the roughness of calm water a point light collapses the lobe
        // to a single blinding pixel that crawls from frame to frame, so the lobe is
        // floored at the sun's rough angular size. And the BRDF's 1/(4 NoV NoL) already
        // carries an NoL that the rendering equation's cosine cancels — dividing by both
        // is the double-count that had the whole frame blown out.
        float specAlpha = max(alpha, 0.055);
        float spec = ggxD(NoH, specAlpha) * smithG1(NoV, specAlpha) * smithG1(NoL, specAlpha)
          / max(4.0 * NoV, 1e-4);
        // Capped so a single near-mirror facet cannot fire off a highlight the bloom
        // then smears across the whole tube.
        colour += uSunColor * min(spec, 40.0) * uSunIntensity * fresnel * SUN_RADIANCE;

        // Dissolve into the same sky the dome draws, in the same direction, so the far
        // edge of the mesh never shows a boundary.
        float haze = 1.0 - exp(-dist * uHazeDensity);
        colour = mix(colour, oceanSky(normalize(vec3(view.x, 0.02, view.z) * -1.0)), haze);

        gl_FragColor = vec4(max(colour, 0.0), 1.0);
      }
    `,
  });

  const seaGeometry = buildProjectedGrid(cols, rows, camera, horizonNdc);
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  // The grid is built in world space around a camera that never moves, so its bounds are
  // meaningful — but the skirt rows put it 60 km out and the displacement happens on the
  // GPU. Culling has nothing useful to decide here.
  sea.frustumCulled = false;
  scene.add(sea);

  const skyUniforms: any = {
    uSunDir: seaUniforms.uSunDir,
    uSunColor: seaUniforms.uSunColor,
    uSunIntensity: seaUniforms.uSunIntensity,
    uSkyHorizon: seaUniforms.uSkyHorizon,
    uSkyLow: seaUniforms.uSkyLow,
    uSkyMid: seaUniforms.uSkyMid,
    uSkyHigh: seaUniforms.uSkyHigh,
    uCloudPhase: { value: new THREE.Vector2() },
    uCloud: { value: linear(MEASURED.cloud) },
  };

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uCloudPhase;
      uniform vec3 uCloud;
      varying vec3 vDir;

      ${SKY_GLSL}
      ${GRADE_GLSL}

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
          mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.55;
        for (int i = 0; i < 4; i++) {
          value += amp * valueNoise(p);
          p = p * 2.07 + 19.3;
          amp *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 dir = normalize(vDir);
        vec3 colour = oceanSky(dir);

        float sun = max(dot(dir, uSunDir), 0.0);
        // Above 1.0 on purpose: the target is HalfFloat and the bloom downstream is what
        // turns this into a sun rather than a white dot. Kept small and mostly glare —
        // the reference reads as diffused light in a hazy sky, and a hard disc this low
        // in frame simply takes the picture over.
        colour += uSunColor * pow(sun, 34.0) * 0.20 * uSunIntensity;

        // Cumulus on a deck overhead. The projection blows up as dir.y approaches zero,
        // so the band is held well clear of the horizon — down there the haze owns the
        // frame anyway, and clouds crowding the horizon was what made the first draft
        // read as weather rather than as distance.
        float above = max(dir.y, 0.12);
        vec2 cloudUv = dir.xz / above;
        float cloud = fbm(cloudUv * 2.3 + uCloudPhase);
        cloud = smoothstep(0.46, 0.63, cloud);
        cloud *= smoothstep(0.10, 0.42, dir.y);

        vec3 lit = uCloud * (0.9 + sun * 0.45);
        colour = mix(colour, lit, cloud * 0.85);

        gl_FragColor = vec4(max(oceanGrade(colour), 0.0), 1.0);
      }
    `,
  });

  const skyGeometry = new THREE.SphereGeometry(20000, 32, 20);
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  // Drawn first with no depth test or write; the water lays over it.
  sky.renderOrder = -1;
  sky.position.copy(camera.position);
  scene.add(sky);

  /**
   * The same wave sum the vertex shader runs, for one point. Kept here rather than read
   * back from the GPU because one sine per wave is cheaper than a readback and exact.
   */
  /** Reused: `sampleWave` is called on the frame loop and the result is read immediately. */
  const waveSample = { height: 0, slopeX: 0, slopeZ: 0 };
  const sampleWave = (x: number, z: number) => {
    let height = 0;
    let slopeX = 0;
    let slopeZ = 0;
    for (let i = 0; i < waveCount; i += 1) {
      const k = waveData[i * 4];
      const amplitude = waveData[i * 4 + 1];
      const phase = waveData[i * 4 + 2];
      const dirX = waveDir[i * 2];
      const dirZ = waveDir[i * 2 + 1];
      const theta = (dirX * x + dirZ * z) * k + phase;
      height += amplitude * Math.sin(theta);
      const steep = amplitude * k * Math.cos(theta);
      slopeX += dirX * steep;
      slopeZ += dirZ * steep;
    }
    waveSample.height = height;
    waveSample.slopeX = slopeX;
    waveSample.slopeZ = slopeZ;
    return waveSample;
  };

  const boat = new THREE.Group();
  boat.position.set(BOAT_X, 0, BOAT_Z);
  boat.rotation.y = 0.6;
  boat.scale.setScalar(1.25);

  const boatMaterial = (colour: number, emissive: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uColour: { value: linear(colour) },
        uEmissive: { value: emissive },
        uCameraPos: seaUniforms.uCameraPos,
        uHazeDensity: seaUniforms.uHazeDensity,
        uSunDir: seaUniforms.uSunDir,
        uSunColor: seaUniforms.uSunColor,
        uSunIntensity: seaUniforms.uSunIntensity,
        uSkyHorizon: seaUniforms.uSkyHorizon,
        uSkyLow: seaUniforms.uSkyLow,
        uSkyMid: seaUniforms.uSkyMid,
        uSkyHigh: seaUniforms.uSkyHigh,
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColour;
        uniform float uEmissive;
        uniform vec3 uCameraPos;
        uniform float uHazeDensity;
        varying vec3 vWorldPos;
        varying vec3 vNormalW;

        ${SKY_GLSL}
        ${GRADE_GLSL}

        void main() {
          // Lit softly from the sun side so the hull has a shaded face, then hazed by the
          // same law the water uses. Without the haze it would sit in front of the
          // distance rather than in it.
          float lambert = 0.55 + 0.45 * max(dot(normalize(vNormalW), uSunDir), 0.0);
          vec3 colour = oceanGrade(uColour * mix(lambert, 1.0, uEmissive));
          float dist = length(vWorldPos - uCameraPos);
          float haze = 1.0 - exp(-dist * uHazeDensity);
          vec3 air = oceanSky(normalize(vec3(0.0, 0.02, -1.0)));
          gl_FragColor = vec4(mix(colour, air, haze), 1.0);
        }
      `,
    });

  const hullMaterial = boatMaterial(BOAT_HULL, 0.0);
  const sailMaterial = boatMaterial(BOAT_SAIL, 0.35);

  // A hull, a mast and one sail. At this distance the silhouette is the whole design.
  const hullGeometry = new THREE.BoxGeometry(3.6, 0.62, 1.15);
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.position.y = 0.18;
  boat.add(hull);

  const mastGeometry = new THREE.BoxGeometry(0.1, 3.9, 0.1);
  const mast = new THREE.Mesh(mastGeometry, hullMaterial);
  mast.position.set(0.2, 2.0, 0);
  boat.add(mast);

  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    0.26, 3.85, 0,
    0.26, 0.62, 0,
    -1.55, 0.72, 0,
  ]), 3));
  sailGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]), 3));
  const sail = new THREE.Mesh(sailGeometry, sailMaterial);
  sail.material.side = THREE.DoubleSide;
  boat.add(sail);

  boat.frustumCulled = false;
  scene.add(boat);

  const pointer = new THREE.Vector2();
  const targetPointer = new THREE.Vector2();
  const sunDirection = new THREE.Vector3();

  let currentIndex = 0;

  // Every value a sea state moves, held live and lerped rather than snapped. A hard cut
  // would read as a channel change, which is the wrong metaphor for weather.
  const live = {
    steepness: SEA_STATES[0].steepness * steepnessScale,
    choppy: SEA_STATES[0].choppy,
    sunElevation: SEA_STATES[0].sunElevation,
    sunAzimuth: SEA_STATES[0].sunAzimuth,
    sunIntensity: SEA_STATES[0].sunIntensity,
    detail: SEA_STATES[0].detail,
    sss: SEA_STATES[0].sss,
    hazeDensity: SEA_STATES[0].hazeDensity,
    sunColor: linear(SEA_STATES[0].sunColor),
    skyHorizon: linear(SEA_STATES[0].skyHorizon),
    skyLow: linear(SEA_STATES[0].skyLow),
    skyMid: linear(SEA_STATES[0].skyMid),
    skyHigh: linear(SEA_STATES[0].skyHigh),
    deep: linear(SEA_STATES[0].deep),
    shallow: linear(SEA_STATES[0].shallow),
  };

  const scratchColor = new THREE.Color();
  const detailPhase = seaUniforms.uDetailPhase.value;
  const cloudPhase = skyUniforms.uCloudPhase.value;

  const update = (delta: number) => {
    const step = delta * motionScale;

    // Phase is accumulated, never computed as omega * t. A sea state that lerps a wave's
    // speed would otherwise make the whole surface jump the instant omega changed, and
    // accumulating also avoids float32 drift over a long session.
    for (let i = 0; i < waveCount; i += 1) {
      wavePhase[i] = (wavePhase[i] + waveOmega[i] * step) % (Math.PI * 2);
    }
    detailPhase.x = (detailPhase.x + step * 1.31) % 1000;
    detailPhase.y = (detailPhase.y + step * 0.94) % 1000;
    detailPhase.z = (detailPhase.z + step * 0.68) % 1000;
    cloudPhase.x = (cloudPhase.x + step * 0.0045) % 1000;
    cloudPhase.y = (cloudPhase.y - step * 0.0016) % 1000;

    pointer.lerp(targetPointer, reducedMotion ? 1 : 1 - Math.exp(-3.2 * delta));

    const target = SEA_STATES[currentIndex];
    const ease = reducedMotion ? 1 : 1 - Math.exp(-2.4 * delta);
    live.steepness += (target.steepness * steepnessScale - live.steepness) * ease;
    live.choppy += (target.choppy - live.choppy) * ease;
    live.sunElevation += (target.sunElevation - live.sunElevation) * ease;
    live.sunAzimuth += (target.sunAzimuth - live.sunAzimuth) * ease;
    live.sunIntensity += (target.sunIntensity - live.sunIntensity) * ease;
    live.detail += (target.detail - live.detail) * ease;
    live.sss += (target.sss - live.sss) * ease;
    live.hazeDensity += (target.hazeDensity - live.hazeDensity) * ease;
    live.sunColor.lerp(scratchColor.setHex(target.sunColor), ease);
    live.skyHorizon.lerp(scratchColor.setHex(target.skyHorizon), ease);
    live.skyLow.lerp(scratchColor.setHex(target.skyLow), ease);
    live.skyMid.lerp(scratchColor.setHex(target.skyMid), ease);
    live.skyHigh.lerp(scratchColor.setHex(target.skyHigh), ease);
    live.deep.lerp(scratchColor.setHex(target.deep), ease);
    live.shallow.lerp(scratchColor.setHex(target.shallow), ease);

    // The pointer leans the wind and swings the sun a few degrees — enough that moving
    // the mouse visibly disturbs the water, never enough to walk the glitter path out of
    // the frame.
    const windAngle = 0.18 + pointer.x * 0.42;
    seaUniforms.uWind.value.set(Math.cos(windAngle), Math.sin(windAngle));
    writeWaveTable(live.steepness, live.choppy, windAngle);

    const azimuth = THREE.MathUtils.degToRad(live.sunAzimuth + pointer.x * 10);
    const elevation = THREE.MathUtils.degToRad(
      Math.max(1.2, live.sunElevation + pointer.y * 3),
    );
    sunDirection
      .set(
        Math.sin(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        -Math.cos(azimuth) * Math.cos(elevation),
      )
      .normalize();

    seaUniforms.uSunDir.value.copy(sunDirection);
    seaUniforms.uSunColor.value.copy(live.sunColor);
    seaUniforms.uSunIntensity.value = live.sunIntensity;
    seaUniforms.uSteepness.value = live.steepness;
    seaUniforms.uDetail.value = live.detail;
    seaUniforms.uSss.value = live.sss;
    seaUniforms.uHazeDensity.value = live.hazeDensity;
    seaUniforms.uCameraPos.value.copy(camera.position);
    seaUniforms.uSkyHorizon.value.copy(live.skyHorizon);
    seaUniforms.uSkyLow.value.copy(live.skyLow);
    seaUniforms.uSkyMid.value.copy(live.skyMid);
    seaUniforms.uSkyHigh.value.copy(live.skyHigh);
    seaUniforms.uDeep.value.copy(live.deep);
    seaUniforms.uShallow.value.copy(live.shallow);

    // The boat sits on the water rather than near it, and heels with the slope under it.
    const swell = sampleWave(BOAT_X, BOAT_Z);
    boat.position.y = swell.height;
    boat.rotation.z = THREE.MathUtils.clamp(-swell.slopeX * 1.1, -0.28, 0.28);
    boat.rotation.x = THREE.MathUtils.clamp(swell.slopeZ * 0.8, -0.22, 0.22);
  };

  return {
    scene,
    camera,
    update,
    cycleSeaState: () => {
      currentIndex = (currentIndex + 1) % SEA_STATES.length;
      return currentIndex;
    },
    seaState: () => currentIndex,
    setPointer: (x: number, y: number) => {
      if (reducedMotion) return;
      targetPointer.set(x, y);
    },
    setLodBias: (octaves: number) => {
      seaUniforms.uLodBias.value = octaves;
    },
    dispose: () => {
      seaGeometry.dispose();
      seaMaterial.dispose();
      hullGeometry.dispose();
      mastGeometry.dispose();
      sailGeometry.dispose();
      hullMaterial.dispose();
      sailMaterial.dispose();
      skyGeometry.dispose();
      skyMaterial.dispose();
    },
  };
}
