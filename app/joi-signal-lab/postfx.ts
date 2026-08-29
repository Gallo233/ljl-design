import * as THREE from "three";
import type { QualityTier } from "./quality";

/**
 * The stage's post chain — one pane of glass over every scene on the page.
 *
 * Ported from the reverse-engineering in
 * `docs/shader-research/shader-se-2026-07/`, whose numbers are measurements, not
 * taste. The nine documented steps, in order: selective bloom, warm phosphor add,
 * temporal persistence, gamma, sepia, brightness and contrast, lens distortion with
 * a rounded bezel, vertical chromatic aberration, and gaussian grain last.
 *
 * ### Two facts about three r178 that shape all of this
 *
 * Rendering into a plain `WebGLRenderTarget` forces linear output **and disables
 * tone mapping** (`WebGLRenderer.js`, the `outputColorSpace` and `toneMapping`
 * selections both test `_currentRenderTarget === null`). So:
 *
 * - Scene targets hold scene-linear light, and this chain owns the one and only
 *   linear→sRGB conversion. Adding `<colorspace_fragment>` anywhere below would
 *   encode twice and lift the whole picture into milk.
 * - The hero used to render with `NeutralToneMapping` straight to its own canvas.
 *   Through a target it would silently lose it, so the blend pass re-applies it —
 *   to the hero tap only, because the reel and the room never had it.
 *
 * ### Where the colour space changes
 *
 * Bloom and the phosphor add are light transport and run in linear. Everything
 * after is a grade whose constants were authored against encoded values — contrast
 * pivoting on 0.5, grain scaled by `(1 - colour)` — so the encode sits between
 * step 2 and step 3 and nothing below it converts again.
 */

const SHARED_GLSL = /* glsl */ `
  float postLuma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 postLinearToSrgb(vec3 c) {
    c = max(c, vec3(0.0));
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
  }
`;

/** Three's own Neutral tone mapper, copied so the hero's look survives the move. */
const NEUTRAL_TONEMAP_GLSL = /* glsl */ `
  vec3 neutralToneMapping(vec3 color, float exposure) {
    const float StartCompression = 0.8 - 0.04;
    const float Desaturation = 0.15;
    color *= exposure;
    float x = min(color.r, min(color.g, color.b));
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    color -= offset;
    float peak = max(color.r, max(color.g, color.b));
    if (peak < StartCompression) return color;
    float d = 1.0 - StartCompression;
    float newPeak = 1.0 - d * d / (peak + d - StartCompression);
    color *= newPeak / peak;
    float g = 1.0 - 1.0 / (Desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3(newPeak), g);
  }
`;

/**
 * Fullscreen triangle rather than a quad: no diagonal seam, no helper-lane waste
 * along it. `position` is auto-declared by three's ShaderMaterial prefix; `uv` is
 * derived from clip space here because the geometry carries no uv attribute.
 */
const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BLEND_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uSlotA;
  uniform sampler2D uSlotB;
  uniform sampler2D uOverlay;
  uniform float uBlend;
  uniform float uSlotAOpacity;
  uniform float uToneMapA;
  uniform float uExposure;
  uniform float uDim;
  varying vec2 vUv;
  ${SHARED_GLSL}
  ${NEUTRAL_TONEMAP_GLSL}
  void main() {
    vec4 a = texture2D(uSlotA, vUv);
    vec4 b = texture2D(uSlotB, vUv);
    vec4 overlay = texture2D(uOverlay, vUv);
    // Slot A carries the hero early and the room late; only the hero was ever
    // tone-mapped, and through a render target three would have dropped it.
    a.rgb = mix(a.rgb, neutralToneMapping(a.rgb, uExposure), uToneMapA);
    a *= clamp(uSlotAOpacity, 0.0, 1.0);
    vec4 mixed = mix(a, b, clamp(uBlend, 0.0, 1.0));
    // The selected film frame is a physical relay above both source worlds. Keeping
    // it out of the A/B dissolve prevents moving video from being readable twice while
    // the surrounding ribbon gives way to the room.
    // WebGL's normal alpha blending stores the transparent target premultiplied, so
    // add its RGB directly. Multiplying it by alpha again would darken the negative
    // during the first few frames of its lift-off.
    mixed = vec4(
      overlay.rgb + mixed.rgb * (1.0 - overlay.a),
      overlay.a + mixed.a * (1.0 - overlay.a)
    );
    gl_FragColor = vec4(mixed.rgb * (1.0 - uDim), mixed.a * (1.0 - uDim * 0.35));
  }
`;

/**
 * The 13-tap downsample, as one body.
 *
 * Prefilter and downsample run the identical Kawase-style kernel — four inner taps at
 * half weight plus four overlapping quads at an eighth — and differ only in what `tap`
 * does: the prefilter applies the soft knee, the downsample does not. That is why this
 * is included rather than parameterised; each shader defines its own `tap` above the
 * point it lands, and this is the arithmetic they share.
 *
 * Byte-identical to the two copies it replaced. A de-duplication, not a retune: the
 * weights and the tap offsets are the shape of the bloom, and AGENTS.md freezes that.
 */
const DOWNSAMPLE_BODY_GLSL = /* glsl */ `
  void main() {
    vec2 d = uSourceTexel;
    vec3 a = tap(vUv + vec2(-2.0, 2.0) * d);
    vec3 b = tap(vUv + vec2(0.0, 2.0) * d);
    vec3 c = tap(vUv + vec2(2.0, 2.0) * d);
    vec3 e = tap(vUv + vec2(-2.0, 0.0) * d);
    vec3 f = tap(vUv);
    vec3 g = tap(vUv + vec2(2.0, 0.0) * d);
    vec3 h = tap(vUv + vec2(-2.0, -2.0) * d);
    vec3 i = tap(vUv + vec2(0.0, -2.0) * d);
    vec3 j = tap(vUv + vec2(2.0, -2.0) * d);
    vec3 k = tap(vUv + vec2(-1.0, 1.0) * d);
    vec3 l = tap(vUv + vec2(1.0, 1.0) * d);
    vec3 m = tap(vUv + vec2(-1.0, -1.0) * d);
    vec3 n = tap(vUv + vec2(1.0, -1.0) * d);
    vec3 sum = (k + l + m + n) * 0.5;
    sum += (a + b + f + e) * 0.125;
    sum += (b + c + g + f) * 0.125;
    sum += (e + f + i + h) * 0.125;
    sum += (f + g + j + i) * 0.125;
    gl_FragColor = vec4(sum * 0.25, 1.0);
  }
`;

const PREFILTER_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uSource;
  uniform vec2 uSourceTexel;
  uniform float uThreshold;
  uniform float uSmoothing;
  varying vec2 vUv;
  ${SHARED_GLSL}

  // Soft knee applied per tap, before averaging: thresholding the average instead
  // lets one bright sprocket hole strobe the whole tile between frames.
  vec3 knee(vec3 c) {
    float lum = postLuma(postLinearToSrgb(c));
    return c * smoothstep(uThreshold, uThreshold + uSmoothing, lum);
  }
  vec3 tap(vec2 uv) { return knee(texture2D(uSource, uv).rgb); }

  ${DOWNSAMPLE_BODY_GLSL}
`;

const DOWNSAMPLE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uSource;
  uniform vec2 uSourceTexel;
  varying vec2 vUv;
  vec3 tap(vec2 uv) { return texture2D(uSource, uv).rgb; }
  ${DOWNSAMPLE_BODY_GLSL}
`;

const UPSAMPLE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uSource;
  uniform vec2 uSourceTexel;
  uniform float uRadius;
  uniform float uLevels;
  varying vec2 vUv;
  vec3 tap(vec2 uv) { return texture2D(uSource, uv).rgb; }
  void main() {
    vec2 d = uSourceTexel * uRadius;
    vec3 sum = tap(vUv + vec2(-1.0, 1.0) * d) * 1.0;
    sum += tap(vUv + vec2(0.0, 1.0) * d) * 2.0;
    sum += tap(vUv + vec2(1.0, 1.0) * d) * 1.0;
    sum += tap(vUv + vec2(-1.0, 0.0) * d) * 2.0;
    sum += tap(vUv) * 4.0;
    sum += tap(vUv + vec2(1.0, 0.0) * d) * 2.0;
    sum += tap(vUv + vec2(-1.0, -1.0) * d) * 1.0;
    sum += tap(vUv + vec2(0.0, -1.0) * d) * 2.0;
    sum += tap(vUv + vec2(1.0, -1.0) * d) * 1.0;
    // Divided by the level count as well as the kernel: a Gaussian pyramid summed
    // additively over seven levels reaches roughly 7x on a broadly lit region, and
    // the source's own min(bloom, 1) governor turns that into a white slab rather
    // than a glow. Normalising here keeps bloomIntensity 1 meaning "one bloom".
    gl_FragColor = vec4(sum / 16.0 / max(uLevels, 1.0), 1.0);
  }
`;

/**
 * Steps 1-3 in one pass, producing the "base": the lit scene, un-premultiplied,
 * encoded to display-referred, optionally carrying a little of last frame with it.
 *
 * Keeping this separate from the compose is what stops the light-transport half of
 * the chain from being written twice — once for the persistence path and once for
 * the direct path — which is the arrangement that makes a double encode almost
 * inevitable. Here there is exactly one encode, in one place.
 */
const BASE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform sampler2D uHistory;
  uniform float uBloomIntensity;
  uniform vec3 uPhosphor;
  uniform float uPhosphorAmount;
  uniform float uPersistence;
  varying vec2 vUv;
  ${SHARED_GLSL}
  void main() {
    vec4 scene = texture2D(uScene, vUv);
    vec3 bloom = min(texture2D(uBloom, vUv).rgb, vec3(1.0)) * uBloomIntensity;
    vec3 lit = scene.rgb + bloom;                   // 1. selective bloom, additive
    lit += bloom * uPhosphor * uPhosphorAmount;     // 2. warm phosphor add
    // Coverage picks up the bloom so glow spilling past the film ribbon still
    // reaches the compositor instead of being multiplied away by an alpha of zero.
    float cover = clamp(scene.a + postLuma(bloom), 0.0, 1.0);
    vec3 straight = lit / max(cover, 1e-4);
    vec4 current = vec4(postLinearToSrgb(straight), cover);
    vec4 history = texture2D(uHistory, vUv);        // 3. temporal persistence
    gl_FragColor = mix(current, history, clamp(uPersistence, 0.0, 0.94));
  }
`;

/**
 * Steps 4-9, on display-referred colour, exactly in the documented order.
 *
 * Not present, and deliberately: the source composites its UI into a texture and
 * runs it through the same distortion, then halves the aberration wherever UI alpha
 * is non-zero. Our typography stays DOM above the canvas, so there is no UI tap to
 * read and no alpha to test — the full radial offset applies across the frame, and
 * the headings are not curved by this pass. That is a known gap, not a bug here.
 */
const COMPOSE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uBase;
  uniform float uPow;
  uniform float uSepiaIntensity;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSharpness;
  uniform vec2 uBaseTexel;
  uniform float uLensDistortion;
  uniform float uLensDistortionBorder;
  uniform float uAspect;
  uniform float uChromaticAberrationStrength;
  uniform float uTime;
  uniform float uNoiseIntensity;
  uniform float uNoiseVelocity;
  varying vec2 vUv;
  ${SHARED_GLSL}

  const float LENS_COEFFICIENT = 0.3655;
  const float BEZEL_RADIUS = 0.04;
  const float BEZEL_FEATHER = 0.005;
  const float CA_BASE = 0.001;
  const float CA_EDGE_FADE = 0.005;
  const float GRAIN_SIGMA = 0.7;
  const float TAU = 6.283185307179586;
  const float EPS = 1e-4;

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 barrelDistort(vec2 uv, float k) {
    vec2 p = uv * 2.0 - 1.0;
    float r2 = dot(p, p);
    p *= 1.0 + k * r2;
    return p * 0.5 + 0.5;
  }

  // The source rescales and recentres the barrel so the centre is fixed and the
  // zoom-out very nearly cancels the outward push. The corners still overscan by
  // about 5% at full distortion; inFrameMask folds that into the bezel rather than
  // letting CLAMP_TO_EDGE smear a column of stretched texels.
  vec2 lensDistortUv(vec2 uv, float distortion, float border) {
    float n = mix(LENS_COEFFICIENT, 0.0, clamp(border, 0.0, 1.0));
    float k = distortion * n;
    return vec2(1.0 - k) * barrelDistort(uv, k) + vec2(k * 0.5);
  }

  float roundedBoxSdf(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // The feather is floored off zero because the source's mix(0.0, 0.005, d)
  // reaches literal zero at distortion 0, and smoothstep with equal edges is a
  // divide by zero: the NaN propagates through the multiply and the frame dies.
  float bezelMask(vec2 uv, float cornerRadius, float feather, float aspect) {
    float f = max(feather, EPS);
    float mask = smoothstep(0.0, f, uv.x)
               * smoothstep(0.0, f, uv.y)
               * smoothstep(0.0, f, 1.0 - uv.x)
               * smoothstep(0.0, f, 1.0 - uv.y);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 b = vec2(0.5 * aspect, 0.5);
    mask *= 1.0 - smoothstep(-f, f, roundedBoxSdf(p, b, cornerRadius));
    return clamp(mask, 0.0, 1.0);
  }

  float inFrameMask(vec2 uv, float feather) {
    float f = max(feather, EPS);
    vec2 e = min(smoothstep(vec2(0.0), vec2(f), uv),
                 smoothstep(vec2(0.0), vec2(f), vec2(1.0) - uv));
    return clamp(e.x * e.y, 0.0, 1.0);
  }

  vec4 gradeAt(vec2 uv) {
    vec4 base = texture2D(uBase, uv);
    vec3 c = base.rgb;
    // 4. gamma. The exponent is a live uniform a transition can drive to zero,
    //    and pow(0, 0) is undefined, so it is floored.
    c = pow(max(c, vec3(0.0)), vec3(max(uPow, 1e-3)));
    // 5. sepia, then brightness.
    vec3 sepia = vec3(
      dot(c, vec3(0.393, 0.769, 0.189)),
      dot(c, vec3(0.349, 0.686, 0.168)),
      dot(c, vec3(0.272, 0.534, 0.131))
    );
    c = mix(c, sepia, uSepiaIntensity);
    c = clamp(c * uBrightness, 0.0, 1.0);
    // 6. contrast.
    c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
    return vec4(c, base.a);
  }

  vec4 sharpenedGradeAt(vec2 uv) {
    vec4 centre = gradeAt(uv);
    if (uSharpness <= 0.001) return centre;
    vec3 neighbours = gradeAt(uv + vec2(uBaseTexel.x, 0.0)).rgb;
    neighbours += gradeAt(uv - vec2(uBaseTexel.x, 0.0)).rgb;
    neighbours += gradeAt(uv + vec2(0.0, uBaseTexel.y)).rgb;
    neighbours += gradeAt(uv - vec2(0.0, uBaseTexel.y)).rgb;
    neighbours *= 0.25;
    centre.rgb = clamp(centre.rgb + (centre.rgb - neighbours) * uSharpness, 0.0, 1.0);
    return centre;
  }

  // 9. Gaussian grain. The source names a normal deviate with mean 0 and sigma
  //    0.7; Box-Muller gives exactly that and stays stable over a long session,
  //    where feeding an ever-growing time straight into a PDF would decay to zero.
  float gaussianGrain(vec2 uv, float t) {
    float u1 = clamp(fract(hash12(uv) + t), 1e-5, 1.0);
    float u2 = fract(hash12(uv + vec2(31.416, 27.183)) + t * 1.618);
    float radius = sqrt(-2.0 * log(u1));
    return clamp(radius * cos(TAU * u2) * GRAIN_SIGMA, -2.1, 2.1);
  }

  void main() {
    vec2 uv = vUv;
    // 7a. Lens distortion: the uv every later sample is taken through.
    vec2 lensUv = lensDistortUv(uv, uLensDistortion, uLensDistortionBorder);

    // 8. Vertical chromatic aberration, radial magnitude, zero at the centre. The
    //    radius is measured on the screen uv — it is a property of the glass, not
    //    of the image behind it — while the taps use the distorted uv.
    vec2 radial = (uv - 0.5) * vec2(uAspect, 1.0) / max(uAspect, 1.0) * 2.0;
    float offset = CA_BASE * length(radial) * 2.0 * uChromaticAberrationStrength;

    // A restrained output-space unsharp pass restores the last bit of definition
    // lost when the curved ribbon is projected into the viewport. The colour-split
    // taps stay unsharpened so the CRT fringe cannot turn into a hard halo.
    vec4 tapCentre = sharpenedGradeAt(lensUv);
    vec4 tapRed = gradeAt(lensUv + vec2(0.0, -offset));
    vec4 tapBlue = gradeAt(lensUv + vec2(0.0, offset));
    vec3 aberrated = vec3(tapRed.r, tapCentre.g, tapBlue.b);

    // Fade the split out at the very edge so the three taps never straddle the
    // frame and drag in clamped texels of a different colour.
    vec2 fadeAxis = min(smoothstep(vec2(0.0), vec2(CA_EDGE_FADE), uv),
                        smoothstep(vec2(0.0), vec2(CA_EDGE_FADE), vec2(1.0) - uv));
    float fade = fadeAxis.x * fadeAxis.y;
    vec3 color = mix(tapCentre.rgb, aberrated, fade);
    float coverage = max(tapCentre.a, max(tapRed.a, tapBlue.a));

    // 7b. The bezel tightens as the glass curves: both radius and feather are
    //     driven by the same distortion amount.
    float mask = bezelMask(uv, mix(0.0, BEZEL_RADIUS, uLensDistortion),
                           mix(0.0, BEZEL_FEATHER, uLensDistortion), uAspect);
    mask *= inFrameMask(lensUv, mix(0.0, BEZEL_FEATHER, uLensDistortion));
    color *= mask;
    // The source composites an opaque page and leaves alpha alone. Our canvas is
    // transparent over live DOM, so coverage has to be cut too — otherwise the
    // bezel paints a black ring instead of an edge.
    coverage *= mask;

    // 9. Grain, last. The (1 - colour) term is what makes it inversely
    //    proportional to luminance: dense in the shadows, gone in the highlights.
    color += gaussianGrain(uv, uTime * uNoiseVelocity) * (1.0 - color) * uNoiseIntensity;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color * coverage, coverage);
  }
`;

export type PostChain = {
  /** Scene slots. Hero occupies A early, the room occupies it late; the reel is B. */
  slotA: any;
  slotB: any;
  /** Alpha-composited physical relay above both scene slots. */
  slotOverlay: any;
  /** Live knobs, written from the scroll callback. */
  uniforms: Record<string, { value: any }>;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  /**
   * Run the chain and put the result on screen.
   * `blend` 0 shows slot A, 1 shows slot B. `toneMapA` re-applies the hero's
   * Neutral tone mapping, which a render target would otherwise drop.
   */
  render: (options: {
    blend: number;
    slotAOpacity: number;
    toneMapA: number;
    dim: number;
    elapsed: number;
  }) => void;
  dispose: () => void;
};

export function createPostChain(renderer: any, tier: QualityTier): PostChain {
  // HalfFloat keeps the bloom pyramid from banding and lets the persistence
  // history hold values a byte target would quantise into stair-steps. WebGL2
  // renders to RGBA16F natively; on WebGL1 it needs an extension, and without it
  // the chain still runs, just in bytes.
  const canHalfFloat =
    renderer.capabilities.isWebGL2 || renderer.extensions.has("EXT_color_buffer_half_float");
  const targetType = canHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;

  const makeTarget = (width: number, height: number, depth: boolean, samples = 0) => {
    const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      type: targetType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: depth,
      stencilBuffer: false,
      generateMipmaps: false,
      samples,
    });
    // Scene targets hold linear light and the base targets hold encoded colour;
    // neither is an sRGB-tagged texture, because tagging one would make three
    // decode it on sample and the chain would lose a transfer function it needs.
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return target;
  };

  // The canvas's own `antialias` only ever applied to the default framebuffer, so
  // moving every scene through a target lost it. These ask for it back explicitly.
  // Two samples at the desktop's native 2x density keep the ribbon edge clean while
  // using less multisample storage than the former 1.5x / 4-sample combination. The
  // saved memory pays for actual picture detail instead of extra sub-pixel coverage.
  const sceneSamples = tier.antialias && renderer.capabilities.isWebGL2 ? 2 : 0;
  const slotA = makeTarget(2, 2, true, sceneSamples);
  const slotB = makeTarget(2, 2, true, sceneSamples);
  const slotOverlay = makeTarget(2, 2, true, sceneSamples);
  const sceneTarget = makeTarget(2, 2, false);
  const baseTargets = [makeTarget(2, 2, false), makeTarget(2, 2, false)];
  let baseIndex = 0;

  const bloomTargets: any[] = [];
  const bloomTexels: any[] = [];
  for (let level = 0; level < tier.bloomLevels; level += 1) {
    bloomTargets.push(makeTarget(2, 2, false));
    bloomTexels.push(new THREE.Vector2(0.5, 0.5));
  }

  const uniforms: Record<string, { value: any }> = {
    // Bloom and phosphor — steps 1 and 2.
    // The source's 0.1 threshold is tuned for a dark CRT. Our reel plays bright
    // product screens, where 0.1 means every pixel blooms and every frame blows out.
    // The knee starts where a highlight actually is instead.
    uBloomIntensity: { value: 0.32 },
    uBloomThreshold: { value: 0.62 },
    uBloomSmoothing: { value: 0.28 },
    uBloomRadius: { value: 0.5 },
    uPhosphor: { value: new THREE.Vector3(1.0, 0.8, 0.0) },
    uPhosphorAmount: { value: 0.1 },
    // Persistence — step 3. Zero is a pass-through, and the tier can veto it.
    uPersistence: { value: 0.0 },
    // The grade — steps 4 to 6.
    uPow: { value: 1.0 },
    uSepiaIntensity: { value: 0.14 },
    uBrightness: { value: 1.0 },
    uContrast: { value: 1.04 },
    // Raised only while the reel owns the stage; the hero and room stay untouched.
    uSharpness: { value: 0.0 },
    uBaseTexel: { value: new THREE.Vector2(0.5, 0.5) },
    // Glass — steps 7 and 8.
    uLensDistortion: { value: 0.55 },
    uLensDistortionBorder: { value: 0.0 },
    uChromaticAberrationStrength: { value: 1.0 },
    uAspect: { value: 1.0 },
    // Grain — step 9. This is what replaces the CSS .grain layer.
    uTime: { value: 0.0 },
    // Off. Ported and kept because it is step 9 of the reference chain, but a grain
    // field over the whole stage read as dirt on the lens rather than as film stock,
    // and it softened everything under it. Raise this if it is ever wanted back.
    uNoiseIntensity: { value: 0.0 },
    uNoiseVelocity: { value: 1.0 },
  };

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.Camera();
  const quadGeometry = new THREE.BufferGeometry();
  quadGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const quad = new THREE.Mesh(quadGeometry, new THREE.MeshBasicMaterial());
  quad.frustumCulled = false;
  quadScene.add(quad);

  const passMaterial = (fragmentShader: string, extra: Record<string, { value: any }>) =>
    new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader,
      uniforms: extra,
      depthTest: false,
      depthWrite: false,
      // Nothing here goes through three's own colour management: the chain owns
      // its transfer functions, and a second opinion would double-encode.
      toneMapped: false,
    });

  const blendMaterial = passMaterial(BLEND_FRAGMENT, {
    uSlotA: { value: slotA.texture },
    uSlotB: { value: slotB.texture },
    uOverlay: { value: slotOverlay.texture },
    uBlend: { value: 0 },
    uSlotAOpacity: { value: 1 },
    uToneMapA: { value: 1 },
    uExposure: { value: 1 },
    uDim: { value: 0 },
  });

  const prefilterMaterial = passMaterial(PREFILTER_FRAGMENT, {
    uSource: { value: sceneTarget.texture },
    uSourceTexel: { value: new THREE.Vector2() },
    uThreshold: uniforms.uBloomThreshold,
    uSmoothing: uniforms.uBloomSmoothing,
  });

  const downsampleMaterial = passMaterial(DOWNSAMPLE_FRAGMENT, {
    uSource: { value: null },
    uSourceTexel: { value: new THREE.Vector2() },
  });

  const upsampleMaterial = passMaterial(UPSAMPLE_FRAGMENT, {
    uSource: { value: null },
    uSourceTexel: { value: new THREE.Vector2() },
    uRadius: uniforms.uBloomRadius,
    uLevels: { value: tier.bloomLevels },
  });
  upsampleMaterial.blending = THREE.CustomBlending;
  upsampleMaterial.blendSrc = THREE.OneFactor;
  upsampleMaterial.blendDst = THREE.OneFactor;
  upsampleMaterial.blendEquation = THREE.AddEquation;

  const baseMaterial = passMaterial(BASE_FRAGMENT, {
    uScene: { value: sceneTarget.texture },
    uBloom: { value: bloomTargets[0].texture },
    uHistory: { value: baseTargets[1].texture },
    uBloomIntensity: uniforms.uBloomIntensity,
    uPhosphor: uniforms.uPhosphor,
    uPhosphorAmount: uniforms.uPhosphorAmount,
    uPersistence: uniforms.uPersistence,
  });

  const composeMaterial = passMaterial(COMPOSE_FRAGMENT, {
    uBase: { value: baseTargets[0].texture },
    uPow: uniforms.uPow,
    uSepiaIntensity: uniforms.uSepiaIntensity,
    uBrightness: uniforms.uBrightness,
    uContrast: uniforms.uContrast,
    uSharpness: uniforms.uSharpness,
    uBaseTexel: uniforms.uBaseTexel,
    uLensDistortion: uniforms.uLensDistortion,
    uLensDistortionBorder: uniforms.uLensDistortionBorder,
    uAspect: uniforms.uAspect,
    uChromaticAberrationStrength: uniforms.uChromaticAberrationStrength,
    uTime: uniforms.uTime,
    uNoiseIntensity: uniforms.uNoiseIntensity,
    uNoiseVelocity: uniforms.uNoiseVelocity,
  });
  // Premultiplied "over" onto the transparent default framebuffer, so the page
  // behind the canvas keeps showing through outside the bezel.
  composeMaterial.transparent = true;
  composeMaterial.blending = THREE.CustomBlending;
  composeMaterial.blendSrc = THREE.OneFactor;
  composeMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
  composeMaterial.blendEquation = THREE.AddEquation;

  const drawPass = (material: any, target: any) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  };

  let historyValid = false;

  const setSize = (width: number, height: number, pixelRatio: number) => {
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    slotA.setSize(w, h);
    slotB.setSize(w, h);
    slotOverlay.setSize(w, h);
    sceneTarget.setSize(w, h);
    baseTargets.forEach((target) => target.setSize(w, h));
    let levelWidth = Math.max(1, Math.ceil(w / 2));
    let levelHeight = Math.max(1, Math.ceil(h / 2));
    bloomTargets.forEach((target, index) => {
      target.setSize(levelWidth, levelHeight);
      bloomTexels[index].set(1 / levelWidth, 1 / levelHeight);
      levelWidth = Math.max(1, Math.floor(levelWidth / 2));
      levelHeight = Math.max(1, Math.floor(levelHeight / 2));
    });
    uniforms.uAspect.value = width / Math.max(1, height);
    uniforms.uBaseTexel.value.set(1 / w, 1 / h);
    // A resized history is a stretched ghost of the old viewport; drop it.
    historyValid = false;
  };

  const render = ({
    blend,
    slotAOpacity,
    toneMapA,
    dim,
    elapsed,
  }: {
    blend: number;
    slotAOpacity: number;
    toneMapA: number;
    dim: number;
    elapsed: number;
  }) => {
    uniforms.uTime.value = elapsed;

    blendMaterial.uniforms.uBlend.value = blend;
    blendMaterial.uniforms.uSlotAOpacity.value = slotAOpacity;
    blendMaterial.uniforms.uToneMapA.value = toneMapA;
    blendMaterial.uniforms.uDim.value = dim;
    drawPass(blendMaterial, sceneTarget);

    // 1. Bloom pyramid: threshold into mip 0, halve down the ladder, then tent
    //    back up accumulating additively into each level below.
    prefilterMaterial.uniforms.uSource.value = sceneTarget.texture;
    prefilterMaterial.uniforms.uSourceTexel.value.copy(bloomTexels[0]).multiplyScalar(0.5);
    drawPass(prefilterMaterial, bloomTargets[0]);

    for (let level = 1; level < bloomTargets.length; level += 1) {
      downsampleMaterial.uniforms.uSource.value = bloomTargets[level - 1].texture;
      downsampleMaterial.uniforms.uSourceTexel.value.copy(bloomTexels[level - 1]);
      drawPass(downsampleMaterial, bloomTargets[level]);
    }

    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    for (let level = bloomTargets.length - 1; level > 0; level -= 1) {
      upsampleMaterial.uniforms.uSource.value = bloomTargets[level].texture;
      upsampleMaterial.uniforms.uSourceTexel.value.copy(bloomTexels[level]);
      drawPass(upsampleMaterial, bloomTargets[level - 1]);
    }
    renderer.autoClear = autoClear;

    // 2 + 3. Light the scene and carry a little of last frame with it. The
    //        history is the other half of the ping-pong, and it is only trusted
    //        once a frame has actually been written into it.
    const write = baseTargets[baseIndex];
    const history = baseTargets[1 - baseIndex];
    baseMaterial.uniforms.uBloom.value = bloomTargets[0].texture;
    baseMaterial.uniforms.uHistory.value = history.texture;
    baseMaterial.uniforms.uPersistence.value =
      tier.persistence && historyValid ? uniforms.uPersistence.value : 0;
    drawPass(baseMaterial, write);

    // 4-9. The grade and the glass, straight to the screen.
    composeMaterial.uniforms.uBase.value = write.texture;
    quad.material = composeMaterial;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCamera);

    baseIndex = 1 - baseIndex;
    historyValid = true;
  };

  return {
    slotA,
    slotB,
    slotOverlay,
    uniforms,
    setSize,
    render,
    dispose: () => {
      [slotA, slotB, slotOverlay, sceneTarget, ...baseTargets, ...bloomTargets]
        .forEach((target) => target.dispose());
      [blendMaterial, prefilterMaterial, downsampleMaterial, upsampleMaterial, baseMaterial, composeMaterial]
        .forEach((material) => material.dispose());
      quadGeometry.dispose();
    },
  };
}
