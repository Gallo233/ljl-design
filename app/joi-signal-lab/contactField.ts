import * as THREE from "three";

/**
 * Contact's quiet signal field.
 *
 * The field is deliberately content-free: the semantic heading, address and links stay
 * in DOM above the shared stage. WebGL only supplies a dark terminal atmosphere and a
 * short-lived refraction wake under a moving fine pointer. If this module never paints,
 * `.contactBackdrop` is the complete static fallback.
 *
 * SOURCE: the feedback buffer keeps the measured reference wiring — 256px wide,
 * neighbour diffusion at 40/s, exponential decay at 4/s and a pointer radius equal to
 * four percent of viewport width.
 */

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uPrevious;
  uniform vec2 uTexel;
  uniform vec2 uPointer;
  uniform float uAspect;
  uniform float uDelta;
  uniform float uAmplitude;
  varying vec2 vUv;

  void main() {
    float centre = texture2D(uPrevious, vUv).r;
    float neighbours = (
      texture2D(uPrevious, vUv + vec2(uTexel.x, 0.0)).r +
      texture2D(uPrevious, vUv - vec2(uTexel.x, 0.0)).r +
      texture2D(uPrevious, vUv + vec2(0.0, uTexel.y)).r +
      texture2D(uPrevious, vUv - vec2(0.0, uTexel.y)).r
    ) * 0.25;
    float density = mix(centre, neighbours, clamp(40.0 * uDelta, 0.0, 1.0));
    density *= exp(-4.0 * uDelta);

    vec2 q = vUv - uPointer;
    q.y /= max(uAspect, 0.0001);
    density += uAmplitude * exp(-dot(q, q) / (0.04 * 0.04));
    gl_FragColor = vec4(min(density, 1.5), 0.0, 0.0, 1.0);
  }
`;

const FIELD_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uTrail;
  uniform sampler2D uNoise;
  uniform vec2 uTrailTexel;
  uniform vec2 uResolution;
  uniform vec2 uBurnOrigin;
  uniform float uBurnProgress;
  uniform float uFlashFade;
  uniform float uTime;
  varying vec2 vUv;

  float sampleBurnNoise(vec2 p) {
    return texture2D(uNoise, p * 0.005).r;
  }

  float burnFbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.4;
    vec2 position = p;
    for (int i = 0; i < 4; i++) {
      total += amplitude * sampleBurnNoise(position * 1.4);
      position *= 2.0;
      amplitude *= 0.5;
    }
    return total;
  }

  // Ruled paper, not graph paper: one set of horizontal lines. RULE_PITCH is shared
  // with the .contactBackdrop fallback and with the binding's coil spacing, so the
  // holes land between rules rather than drifting across them.
  float signalRule(vec2 uv) {
    float cell = fract((uv.y * uResolution.y) / 44.0);
    float edge = min(cell, 1.0 - cell);
    return 1.0 - smoothstep(0.0, 0.030, edge);
  }

  void main() {
    float wake = texture2D(uTrail, vUv).r;
    vec2 gradient = vec2(
      texture2D(uTrail, vUv + vec2(uTrailTexel.x, 0.0)).r -
        texture2D(uTrail, vUv - vec2(uTrailTexel.x, 0.0)).r,
      texture2D(uTrail, vUv + vec2(0.0, uTrailTexel.y)).r -
        texture2D(uTrail, vUv - vec2(0.0, uTrailTexel.y)).r
    );

    // The grid moves, never the copy above it. A velocity wake bends at most a few
    // screen pixels, then the feedback texture brings it home without a second tween.
    vec2 warpedUv = vUv + gradient * 0.045;
    float rule = signalRule(warpedUv);
    float redRule = signalRule(warpedUv + gradient * 0.0045);
    float blueRule = signalRule(warpedUv - gradient * 0.0045);

    vec2 centred = vUv - 0.5;
    float edgeShade = smoothstep(0.76, 0.18, length(centred * vec2(0.9, 1.15)));
    float lowBand = 0.5 + 0.5 * sin(vUv.y * uResolution.y * 0.33);

    // Contact resolves into plain paper rather than another dark screen.
    //
    // The stock is neutral on purpose: no warm cast washed over it, and no blue one
    // either. Any colour on this page comes from the ruling and the ink, so the paper
    // itself carries none. The two ends are the vignette — the lighter one is the
    // centre, because edgeShade reads 1 there — and they must stay in step with the
    // .contactBackdrop radial, which is the complete fallback when this never paints.
    //
    // The falloff is deliberately shallow. A deep vignette on white stock stops reading
    // as light and starts reading as a dirty edge, which is the same complaint as a
    // wash of colour over the top: something laid on the paper rather than the paper.
    vec3 colour = mix(vec3(0.945, 0.945, 0.941), vec3(0.980, 0.980, 0.978), edgeShade);

    // The ruling is where the colour lives. Subtracting unevenly per channel leaves the
    // blue-grey line of a school exercise book instead of a neutral grey one; the three
    // displaced samples still give the pointer wake a real edge to split.
    vec3 splitRule = vec3(redRule, rule, blueRule);
    colour -= splitRule * (0.070 + wake * 0.120) * vec3(1.25, 1.05, 0.62);
    // The wake runs cool with the paper it disturbs; warming it here would put the one
    // warm thing on the page under the reader's own cursor.
    colour += vec3(-0.010, 0.006, 0.028) * wake;
    colour -= vec3(lowBand * 0.004);

    if (uBurnProgress < 0.0001) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // SOURCE: Shader's Contact hand-off is a noisy radial threshold around a tracked
    // sparkle point. The local room has no hand-tracking data, so uBurnOrigin is fixed
    // beside its focal area while the source graph and constants remain intact.
    // Shader hard-codes 9/16 for its 16:9 composite. Using the equivalent live
    // height/width ratio preserves that physical shape when our Contact turns portrait.
    vec2 relative = (vUv - uBurnOrigin) * vec2(1.0, uResolution.y / uResolution.x);
    float angle = atan(relative.y, relative.x);
    float wobble = (
      sin(angle * 3.0 + uTime * 1.5) * 1.5 +
      sin(angle * 7.0 + uTime * 2.5) +
      sin(angle * 13.0 + uTime * 0.8) * 0.5
    ) * 0.08 * uBurnProgress;
    float radialDistance = (length(relative) + wobble) * 1.3;

    vec2 noiseUv = vUv;
    noiseUv.x *= uResolution.x / uResolution.y;
    float detail =
      burnFbm(noiseUv * 12.0 + vec2(uTime * 0.4)) * 0.5 +
      burnFbm(noiseUv * 32.0 + vec2(uTime * 0.4)) +
      burnFbm(noiseUv * 160.0 + vec2(uTime * 0.2)) * 0.5 +
      burnFbm(noiseUv * 240.0 + vec2(uTime * 0.1)) * 0.2 +
      burnFbm(noiseUv * 320.0 + vec2(uTime * 0.1)) * 0.5;
    float burnField = uBurnProgress * 1.3 - radialDistance + detail * 0.7 * uBurnProgress;
    float inside = step(0.0, burnField);
    float edge = smoothstep(-max(uBurnProgress * 0.15, 0.002), 0.0, burnField) * (1.0 - inside);

    if (inside > 0.5) {
      // SOURCE: the newly revealed scene starts overexposed at vec3(2), then its real
      // colour returns on the separate flashFade timeline.
      vec3 revealed = mix(vec3(2.0), colour, uFlashFade);
      gl_FragColor = vec4(revealed, 1.0);
      return;
    }

    // PARTIAL: Shader's source edge is fed into its shared bloom graph. Contact is
    // intentionally drawn after our CRT chain, so this wider premultiplied band is the
    // documented local substitute rather than a guessed change to the source threshold.
    float glow = smoothstep(-max(uBurnProgress * 0.30, 0.004), 0.0, burnField) * (1.0 - inside);
    float alpha = max(edge, glow * 0.24);
    vec3 premultiplied = vec3(0.90, 0.95, 1.0) * (edge * 1.5 + glow * 0.12);
    gl_FragColor = vec4(premultiplied, alpha);
  }
`;

export function createContactField(renderer: any) {
  /**
   * GUESS, isolated from the SOURCE graph above: a deterministic, same-distribution
   * replacement for Shader's 96px rgba_noise.png. The source red channel measures
   * mean .25 / stdev .18; keeping that distribution prevents a brighter uniform noise
   * texture from making the threshold cover the frame too early.
   */
  const makeBurnNoise = () => {
    const size = 96;
    const data = new Uint8Array(size * size * 4);
    let seed = 0x6a09e667;
    let spare: number | null = null;
    const uniform = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return (seed + 1) / 4294967297;
    };
    const gaussian = () => {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }
      const radius = Math.sqrt(-2 * Math.log(uniform()));
      const angle = Math.PI * 2 * uniform();
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    };
    for (let index = 0; index < data.length; index += 4) {
      const value = Math.round(THREE.MathUtils.clamp(0.25 + gaussian() * 0.18, 0.012, 0.914) * 255);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  };

  const burnNoise = makeBurnNoise();
  const makeTrailTarget = () => {
    const target = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return target;
  };

  const trailTargets = [makeTrailTarget(), makeTrailTarget()];
  let trailIndex = 0;

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const placeholderMaterial = new THREE.MeshBasicMaterial();
  const quad = new THREE.Mesh(geometry, placeholderMaterial);
  quad.frustumCulled = false;
  scene.add(quad);

  const trailUniforms = {
    uPrevious: { value: trailTargets[1].texture },
    uTexel: { value: new THREE.Vector2(0.5, 0.5) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uDelta: { value: 0 },
    uAmplitude: { value: 0 },
  };
  const trailMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: TRAIL_FRAGMENT,
    uniforms: trailUniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const fieldUniforms = {
    uTrail: { value: trailTargets[0].texture },
    uNoise: { value: burnNoise },
    uTrailTexel: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBurnOrigin: { value: new THREE.Vector2(0.53, 0.43) },
    uBurnProgress: { value: 0 },
    uFlashFade: { value: 0 },
    uTime: { value: 0 },
  };
  const fieldMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: FIELD_FRAGMENT,
    uniforms: fieldUniforms,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  let viewportWidth = 1;
  let viewportHeight = 1;
  let targetX = 0.5;
  let targetY = 0.5;
  let smoothX = 0.5;
  let smoothY = 0.5;
  let pointerInside = false;
  let energy = 0;
  let trailIsClear = true;
  let dirty = true;
  let lastPresence = -1;
  let lastFlashFade = -1;
  let lastClearScreen: boolean | null = null;
  let elapsed = 0;

  const clearTrail = () => {
    const previousTarget = renderer.getRenderTarget();
    trailTargets.forEach((target) => {
      renderer.setRenderTarget(target);
      renderer.clear();
    });
    renderer.setRenderTarget(previousTarget);
    trailIsClear = true;
  };

  const setSize = (width: number, height: number, _pixelRatio: number) => {
    viewportWidth = Math.max(1, width);
    viewportHeight = Math.max(1, height);
    const trailWidth = 256;
    const trailHeight = Math.max(64, Math.round(trailWidth / (viewportWidth / viewportHeight)));
    trailTargets.forEach((target) => target.setSize(trailWidth, trailHeight));
    trailUniforms.uTexel.value.set(1 / trailWidth, 1 / trailHeight);
    trailUniforms.uAspect.value = viewportWidth / viewportHeight;
    fieldUniforms.uTrailTexel.value.set(1 / trailWidth, 1 / trailHeight);
    fieldUniforms.uResolution.value.set(viewportWidth, viewportHeight);
    fieldUniforms.uBurnOrigin.value.set(0.53, viewportWidth / viewportHeight < 0.8 ? 0.5 : 0.43);
    clearTrail();
    dirty = true;
  };

  const setPointer = (clientX: number, clientY: number, boundsLeft = 0, boundsTop = 0) => {
    targetX = THREE.MathUtils.clamp((clientX - boundsLeft) / viewportWidth, 0, 1);
    targetY = THREE.MathUtils.clamp(1 - (clientY - boundsTop) / viewportHeight, 0, 1);
    pointerInside = true;
    dirty = true;
  };

  const leavePointer = () => {
    pointerInside = false;
  };

  const draw = (material: any, target: any) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };

  const render = ({
    presence,
    flashFade,
    delta,
    reducedMotion,
    clearScreen,
  }: {
    presence: number;
    flashFade: number;
    delta: number;
    reducedMotion: boolean;
    clearScreen: boolean;
  }) => {
    elapsed += delta;
    const pointerAlpha = reducedMotion ? 1 : 1 - Math.exp(-7 * delta);
    smoothX += (targetX - smoothX) * pointerAlpha;
    smoothY += (targetY - smoothY) * pointerAlpha;
    const dx = (targetX - smoothX) * viewportWidth;
    const dy = (targetY - smoothY) * viewportHeight;
    const lag = Math.hypot(dx, dy) / viewportWidth;
    const speed = Math.tanh(Math.max(0, lag - 0.025) / 0.08);
    const amplitude = pointerInside && !reducedMotion ? speed * speed : 0;
    energy = Math.max(amplitude, energy * Math.exp(-4 * delta));

    if (!reducedMotion && energy > 0.001) {
      const write = trailTargets[trailIndex];
      const history = trailTargets[1 - trailIndex];
      trailUniforms.uPrevious.value = history.texture;
      trailUniforms.uPointer.value.set(smoothX, smoothY);
      trailUniforms.uDelta.value = delta;
      trailUniforms.uAmplitude.value = amplitude;
      draw(trailMaterial, write);
      fieldUniforms.uTrail.value = write.texture;
      trailIndex = 1 - trailIndex;
      trailIsClear = false;
      dirty = true;
    } else if (!trailIsClear) {
      energy = 0;
      clearTrail();
      fieldUniforms.uTrail.value = trailTargets[0].texture;
      dirty = true;
    }

    const nextPresence = THREE.MathUtils.clamp(presence, 0, 1);
    const nextFlashFade = THREE.MathUtils.clamp(flashFade, 0, 1);
    const presenceChanged = Math.abs(nextPresence - lastPresence) > 0.0005;
    const flashChanged = Math.abs(nextFlashFade - lastFlashFade) > 0.0005;
    const burnAnimating = nextPresence > 0.0001 && nextPresence < 0.9999;
    if (!dirty && !presenceChanged && !flashChanged && !burnAnimating && clearScreen === lastClearScreen) return false;

    fieldUniforms.uBurnProgress.value = nextPresence;
    fieldUniforms.uFlashFade.value = nextFlashFade;
    fieldUniforms.uTime.value = elapsed;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    // While the aperture is opening this is an overlay, not a replacement frame.
    // WebGLRenderer.render() clears by default; leaving that enabled erased the About
    // room before the first white pixel was composited and produced a black interstitial.
    renderer.autoClear = false;
    try {
      if (clearScreen) {
        renderer.setRenderTarget(null);
        renderer.clear();
      }
      draw(fieldMaterial, null);
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget);
    }

    lastPresence = nextPresence;
    lastFlashFade = nextFlashFade;
    lastClearScreen = clearScreen;
    dirty = false;
    return true;
  };

  return {
    setSize,
    setPointer,
    leavePointer,
    render,
    dispose: () => {
      geometry.dispose();
      placeholderMaterial.dispose();
      trailMaterial.dispose();
      fieldMaterial.dispose();
      burnNoise.dispose();
      trailTargets.forEach((target) => target.dispose());
    },
  };
}
