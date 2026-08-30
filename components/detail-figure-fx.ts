/**
 * Detail-page figure effects: the one-shot particle condensation on the first
 * figure, and the liquid field over the whole gallery.
 *
 * Ported from the viscose study (docs/shader-research/viscose-carousel-2026-08):
 * Yousuf Soomro's Viscose Carousel and MegD1's ICE WORKS derivative, both MIT —
 * the substrate field below is planeShaders.js math (smin fusion, the cursor
 * melt halo, the capillary wake, surface-tension wobble) and the hover shadow
 * is ICE's hoveredCardParticles, both re-anchored to DOM rectangles. Three is
 * deliberately not imported here — the detail pages carry no WebGL dependency
 * today and a full-screen quad does not justify one. GLSL is kept in ES 1.00
 * style, which a WebGL2 context accepts as-is.
 *
 * The liquid discipline is the study's own: the cursor is a force, not a
 * pointer — nothing is ever drawn at it; it swells and ripples the field
 * around itself. Particles belong to a bounded beat only (one condensation per
 * page load, one glyph shadow behind the single hovered figure). Both layers
 * are additive over content that is fully visible without them, and every
 * entry point degrades to the plain page: a failed context, reduced motion, a
 * coarse pointer or a narrow window simply means the static figures stand
 * alone.
 */

const ASCII_GLYPHS = ".:+x*#@";
const GLYPH_COUNT = ASCII_GLYPHS.length;

/** Ink from the page's own palette, parsed once; the fallback matches it closely. */
function readInk(el: HTMLElement): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue("--ink").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return [0.09, 0.08, 0.07];
}

/** The seven rasterised glyphs, one atlas row; only alpha is consumed. */
function buildGlyphAtlas(): HTMLCanvasElement {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cell * GLYPH_COUNT;
  canvas.height = cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 84px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < GLYPH_COUNT; i++) {
    ctx.fillText(ASCII_GLYPHS[i], i * cell + cell * 0.5, cell * 0.51);
  }
  return canvas;
}

type FxContext = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  canvas: HTMLCanvasElement;
  destroy: () => void;
};

const QUAD_VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

function makeFxContext(canvas: HTMLCanvasElement, fragment: string): FxContext | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // The field idles between pointer visits; keeping the buffer means the
    // last drawn frame — the resting seams — stays composited reliably.
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("no shader");
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
    }
    return shader;
  };

  let program: WebGLProgram;
  try {
    program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, QUAD_VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    }
  } catch (error) {
    // A silent null here would read as "the effect never ran". Keep the
    // reason reachable for diagnosis; the page itself still degrades cleanly.
    (window as unknown as Record<string, unknown>).__figureFxDiag = String(
      error instanceof Error ? error.message : error,
    ).slice(0, 400);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  return {
    gl,
    program,
    canvas,
    destroy: () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

function uploadTexture(gl: WebGL2RenderingContext, unit: number, source: TexImageSource) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return tex;
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number, dpr: number) {
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${Math.round(width)}px`;
  canvas.style.height = `${Math.round(height)}px`;
}

/* -------------------------------------------------------------------------
   The condensation. The first gallery figure condenses out of a mirrored
   ASCII diamond: glyphs gather from a spread of the image's own luminance,
   adopt its colour and tone as they close, and hand off to the real <img>,
   which fades in beneath the field's tail. One shot; the canvas is removed
   when it lands. Numbers track the study's intro (1.55s power3-in-out gather,
   spread 2.4 to fit the canvas, cell 13px).
   ------------------------------------------------------------------------- */

const CONDENSE_FS = `
  precision mediump float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform vec2 uBoxOrigin;
  uniform vec2 uBox;
  uniform sampler2D uArt;
  uniform sampler2D uGlyphs;
  uniform float uT;
  uniform float uTime;
  uniform float uSpread;
  uniform float uCell;
  uniform vec3 uInk;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 p = vUv * uRes - (uBoxOrigin + uBox * 0.5);
    vec2 halfSize = max(uBox * 0.5, vec2(1.0));
    float t = clamp(uT, 0.0, 1.0);
    float gather = t * t * (3.0 - 2.0 * t);
    float cloudScale = mix(uSpread, 1.0, gather);

    vec2 q = p / cloudScale;
    vec2 n = q / halfSize;
    float diamond = abs(n.x) + abs(n.y) - 1.0;
    float boxd = max(abs(n.x), abs(n.y)) - 1.0;
    float shape = mix(diamond, boxd, smoothstep(0.35, 0.92, gather));
    if (shape > 0.02) { gl_FragColor = vec4(0.0); return; }

    float radius = max(length(q), 1.0);
    float ripple = sin(uTime * 1.4 + (abs(q.x) + abs(q.y)) * 0.018);
    vec2 current = q + (q / radius) * ripple * uCell * 0.38 * (1.0 - gather);
    vec2 gridP = current / uCell;
    vec2 mirrored = abs(gridP);
    vec2 tile = floor(mirrored);
    vec2 glyphUv = fract(mirrored);
    float seed = hash21(tile + 71.19);

    vec2 imageUv = q / uBox + 0.5;
    imageUv.y = 1.0 - imageUv.y;
    vec3 art = texture2D(uArt, clamp(imageUv, 0.004, 0.996)).rgb;
    float luminance = dot(art, vec3(0.2126, 0.7152, 0.0722));

    float imageInfluence = smoothstep(0.28, 0.88, gather);
    float density = mix(0.30, 0.90, gather);
    float present = step(seed, density);
    float glyphBase = 3.0 + seed * 2.0;
    float glyphImage = (1.0 - luminance) * 4.8 + gather * 1.35 + seed * 0.8;
    float glyph = floor(clamp(mix(glyphBase, glyphImage, imageInfluence), 0.0, 6.0));
    float mask = texture2D(uGlyphs, vec2((glyph + glyphUv.x) / 7.0, glyphUv.y)).a;

    float born = smoothstep(0.0, 0.09, t);
    float handoff = 1.0 - smoothstep(0.58, 0.96, t);
    float pulse = 0.82 + 0.18 * sin(uTime * 3.2 + seed * 6.2831853);
    float cloudEdge = 1.0 - smoothstep(-0.16, 0.0, shape);
    float alpha = mask * present * born * handoff * pulse * cloudEdge;

    vec3 particle = mix(uInk, mix(uInk, art, 0.68), imageInfluence);
    gl_FragColor = vec4(particle, alpha);
  }
`;

export type CondenseHandle = { cancel: () => void };

/**
 * Condense one figure's image out of particles. `figure` is the positioned
 * container, `img` the image inside it whose box the field centres on. The
 * img keeps its normal markup and stays visible unless the effect actually
 * starts; cancellation at any point restores it.
 */
export function condenseFigure(
  figure: HTMLElement,
  img: HTMLImageElement,
): CondenseHandle | null {
  if (img.complete && img.naturalWidth === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "figure-fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  figure.appendChild(canvas);

  const cancel = () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    window.cancelAnimationFrame(raf);
    canvas.remove();
    img.style.opacity = "";
  };

  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const layout = () => {
    const w = figure.clientWidth;
    const h = figure.clientHeight;
    sizeCanvas(canvas, w, h, dpr);
  };
  const onResize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    layout();
  };
  // Off-screen work is wasted: the rAF keeps running but renders nothing.
  let visible = true;
  const onScroll = () => {
    const rect = figure.getBoundingClientRect();
    visible = rect.bottom > 0 && rect.top < window.innerHeight;
  };

  const fx = makeFxContext(canvas, CONDENSE_FS);
  if (!fx) {
    canvas.remove();
    return null;
  }
  const { gl, program } = fx;
  const U = (name: string) => gl.getUniformLocation(program, name);

  // Downscale the artwork: the field samples luminance per glyph cell, not
  // per pixel, so a 512-wide copy carries all the information it needs.
  const sample = document.createElement("canvas");
  const sampleW = 512;
  const sampleH = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * sampleW));
  sample.width = sampleW;
  sample.height = sampleH;
  const sctx = sample.getContext("2d");
  if (!sctx) {
    fx.destroy();
    canvas.remove();
    return null;
  }
  sctx.drawImage(img, 0, 0, sampleW, sampleH);
  const atlas = buildGlyphAtlas();
  uploadTexture(gl, 0, sample);
  uploadTexture(gl, 1, atlas);
  gl.uniform1i(U("uArt"), 0);
  gl.uniform1i(U("uGlyphs"), 1);

  const ink = readInk(figure);
  gl.uniform3f(U("uInk"), ink[0], ink[1], ink[2]);
  const uRes = U("uRes");
  const uBoxOrigin = U("uBoxOrigin");
  const uBox = U("uBox");
  const uT = U("uT");
  const uTime = U("uTime");
  const uCell = U("uCell");

  layout();
  const DURATION = 1.55;
  const SPREAD = 2.4;
  const CELL = 13;
  let start = -1;
  let raf = 0;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const frame = (now: number) => {
    raf = window.requestAnimationFrame(frame);
    if (start < 0) start = now;
    const t = Math.min((now - start) / 1000 / DURATION, 1);
    if (!visible) return;
    // easeInOutCubic, the study's power3.inOut
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const boxW = img.clientWidth;
    const boxH = img.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uBox, boxW * dpr, boxH * dpr);
    // The canvas covers the figure; the image's offset inside it is the box.
    gl.uniform2f(uBoxOrigin, img.offsetLeft * dpr, img.offsetTop * dpr);
    gl.uniform1f(uCell, CELL * dpr);
    gl.uniform1f(uT, e);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // The real image surfaces beneath the field's dying tail.
    img.style.opacity = String(Math.max(0, Math.min(1, (e - 0.5) / 0.45)));
    if (t >= 1) {
      cancel();
    }
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });
  raf = window.requestAnimationFrame(frame);

  return { cancel };
}

/* -------------------------------------------------------------------------
   The liquid field. Two canvases, one loop.

   The substrate (under the figures) is the study's own material: every figure
   cell is a rounded-box distance field, the cells fuse through a smooth
   minimum, and the fused blob is filled with ink — which is what turns the
   grid's one-pixel seams into the joins of a single liquid slab. The cursor
   is a force: a melt halo swells the field around it, a capillary wake rings
   out through the surface and outlives the movement, and surface-tension
   noise keeps the edge alive while the pointer is anywhere near.

   The glyph layer (over the figures) carries ICE's hover shadow: glyphs
   gather behind the single hovered figure, reversible, latched to its card —
   and clipped against every sibling cell so the field never paints over
   another figure's image.
   ------------------------------------------------------------------------- */

const SUBSTRATE_FS = `
  precision mediump float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform int uCellCount;
  uniform vec4 uCells[8];
  uniform vec2 uMouse;
  uniform float uMouseIn;
  uniform float uTime;
  uniform vec3 uInk;
  uniform float uDpr;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                    + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                            dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.y * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  void main() {
    vec2 p = vUv * uRes;
    float dpr = uDpr;

    // The goo. At rest k is small: each cell keeps its own ink outline. The
    // cursor's halo lifts k locally — exactly the study's melt — so nearby
    // outlines fuse into one blob under the pointer and split again on the
    // way out.
    float toMouse0 = distance(p, uMouse);
    float halo = uMouseIn * exp(-pow(toMouse0 / (260.0 * dpr), 2.0));
    float k = 9.0 * dpr + 34.0 * dpr * halo;
    float d = 1e6;
    for (int i = 0; i < 8; i++) {
      if (i >= uCellCount) break;
      vec2 c = uCells[i].xy;
      vec2 b = max(uCells[i].zw, vec2(1.0));
      float r = min(14.0 * dpr, min(b.x, b.y));
      d = smin(d, sdRoundBox(p - c, b, r), k);
    }

    // A capillary wake rings out through the surface and outlives the
    // movement; surface tension keeps the line alive while the pointer nears.
    float toMouse = distance(p, uMouse);
    d += sin(toMouse * 0.05 / dpr - uTime * 7.0)
       * 3.0 * dpr * uMouseIn * exp(-toMouse / (260.0 * dpr));
    d -= halo * 8.0 * dpr;
    d += snoise((p / dpr) * 0.012 + vec2(uTime * 0.22, uTime * -0.17))
       * (0.8 + 2.6 * halo) * dpr;

    // Analytic AA. The study clamps fwidth, but this WebKit build declines
    // fwidth in ESSL 1.00 shaders — and a thin constant line is what the
    // editorial page wants anyway.
    float aa = 1.1 * dpr;
    float alpha = (1.0 - smoothstep(0.0, 2.6 * dpr, abs(d))) * 0.9;
    gl_FragColor = vec4(uInk, alpha);
  }
`;

const GLYPH_FS = `
  precision mediump float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform sampler2D uGlyphs;
  uniform vec3 uInk;
  uniform int uCellCount;
  uniform vec4 uCells[8];
  uniform vec2 uFocusPos;
  uniform vec2 uFocusHalf;
  uniform float uAmount;
  uniform float uReach;
  uniform float uCell;
  uniform float uTime;
  uniform float uPhase;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 p = vUv * uRes;
    if (uAmount <= 0.004) { gl_FragColor = vec4(0.0); return; }

    // Outside every cell: the shadow may pool against a sibling's edge but
    // never onto another figure's image.
    float outsideAll = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uCellCount) break;
      vec2 c = uCells[i].xy;
      vec2 b = max(uCells[i].zw, vec2(1.0));
      outsideAll = min(outsideAll, smoothstep(1.5, 5.0,
        sdRoundBox(p - c, b, min(14.0, min(b.x, b.y)))));
    }

    vec2 q = p - uFocusPos;
    vec2 halfSize = max(uFocusHalf, vec2(1.0));
    float focusD = sdRoundBox(q, halfSize, min(14.0, min(halfSize.x, halfSize.y)));
    float outside = smoothstep(1.5, 5.0, focusD);
    float falloff = 1.0 - smoothstep(0.0, uReach, focusD);
    float field = outside * pow(max(falloff, 0.0), 1.25) * outsideAll;
    if (field <= 0.002) { gl_FragColor = vec4(0.0); return; }

    float radius = max(length(q), 1.0);
    vec2 direction = q / radius;
    float travel = uPhase + uAmount * 3.6;
    vec2 drift = vec2(
      uTime * 0.45 * uCell,
      sin(uTime * 1.7 + q.x * 0.013) * uCell * 0.34
    );
    vec2 particleP = q + direction * uCell * travel + drift;
    vec2 gridP = particleP / uCell;
    vec2 tile = floor(gridP);
    vec2 glyphUv = fract(gridP);
    float seed = hash21(tile + 223.41);

    float density = mix(0.10, 0.76, pow(max(falloff, 0.0), 0.72)) *
                    mix(0.28, 1.0, uAmount);
    float present = step(seed, density);
    float glyph = floor(clamp(falloff * 6.35 + (seed - 0.5) * 1.35, 0.0, 6.0));
    float mask = texture2D(uGlyphs, vec2((glyph + glyphUv.x) / 7.0, glyphUv.y)).a;

    float phase = hash21(tile + 47.13) * 6.2831853;
    float pulse = 0.74 + 0.26 * sin(uTime * 3.2 + phase);
    float alpha = mask * present * field * uAmount * pulse;
    gl_FragColor = vec4(uInk, alpha);
  }
`;

export type FieldHandle = { cancel: () => void };

const MAX_CELLS = 8;

/**
 * The gallery-wide liquid field. `hoverEnv` says the pointer can actually
 * hover (fine pointer, hover available): without it the substrate renders one
 * static frame — the fused seams — and no loop is ever scheduled.
 */
export function attachGalleryField(
  gallery: HTMLElement,
  options: { hoverEnv: boolean },
): FieldHandle | null {
  const figures = Array.from(gallery.querySelectorAll<HTMLElement>(".project-detail-figure"));
  if (figures.length === 0) return null;
  const cells = figures.slice(0, MAX_CELLS);

  const substrate = document.createElement("canvas");
  substrate.className = "figure-fx-canvas figure-fx-canvas--substrate";
  substrate.setAttribute("aria-hidden", "true");
  const glyphLayer = document.createElement("canvas");
  glyphLayer.className = "figure-fx-canvas";
  glyphLayer.setAttribute("aria-hidden", "true");
  gallery.prepend(substrate);
  gallery.appendChild(glyphLayer);

  const fxS = makeFxContext(substrate, SUBSTRATE_FS);
  const fxG = options.hoverEnv ? makeFxContext(glyphLayer, GLYPH_FS) : null;
  if (!fxS) {
    substrate.remove();
    glyphLayer.remove();
    return null;
  }
  const glS = fxS.gl;
  const US = (n: string) => glS.getUniformLocation(fxS.program, n);
  glS.enable(glS.BLEND);
  glS.blendFunc(glS.SRC_ALPHA, glS.ONE_MINUS_SRC_ALPHA);
  const ink = readInk(gallery);
  glS.useProgram(fxS.program);
  glS.uniform3f(US("uInk"), ink[0], ink[1], ink[2]);

  let glG: WebGL2RenderingContext | null = null;
  const UG = (n: string) => (glG ? glG.getUniformLocation(fxG!.program, n) : null);
  if (fxG) {
    glG = fxG.gl;
    glG.enable(glG.BLEND);
    glG.blendFunc(glG.SRC_ALPHA, glG.ONE_MINUS_SRC_ALPHA);
    glG.useProgram(fxG.program);
    const atlas = buildGlyphAtlas();
    uploadTexture(glG, 1, atlas);
    glG.uniform1i(UG("uGlyphs"), 1);
    glG.uniform3f(UG("uInk"), ink[0], ink[1], ink[2]);
  }

  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

  // Cursor and hover state, chased at the study's lopsided rates: the field
  // takes a lean quickly and lets go of it slowly — that gap is what reads as
  // something thick being dragged through.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: 0, tInside: 0 };
  const amounts = cells.map(() => ({ value: 0, target: 0 }));
  const phases = cells.map((_, i) => (i * 0.618) % 1);
  let hoverIndex = -1;
  const cellArr = new Float32Array(MAX_CELLS * 4);

  const measure = () => {
    const g = gallery.getBoundingClientRect();
    const sx = substrate.width / Math.max(g.width, 1);
    cells.forEach((figure, i) => {
      const r = figure.getBoundingClientRect();
      cellArr[i * 4] = (r.left - g.left + r.width / 2) * sx;
      cellArr[i * 4 + 1] = (r.top - g.top + r.height / 2) * sx;
      cellArr[i * 4 + 2] = (r.width / 2) * sx;
      cellArr[i * 4 + 3] = (r.height / 2) * sx;
    });
    glS.useProgram(fxS.program);
    glS.uniform4fv(US("uCells"), cellArr);
    glS.uniform1i(US("uCellCount"), cells.length);
    glS.uniform1f(US("uDpr"), dpr());
    if (glG) {
      glG.useProgram(fxG!.program);
      glG.uniform4fv(UG("uCells"), cellArr);
      glG.uniform1i(UG("uCellCount"), cells.length);
    }
    return g;
  };

  const resize = () => {
    sizeCanvas(substrate, gallery.clientWidth, gallery.clientHeight, dpr());
    glS.viewport(0, 0, substrate.width, substrate.height);
    glS.uniform2f(US("uRes"), substrate.width, substrate.height);
    if (glG) {
      sizeCanvas(glyphLayer, gallery.clientWidth, gallery.clientHeight, dpr());
      glG.viewport(0, 0, glyphLayer.width, glyphLayer.height);
      glG.uniform2f(UG("uRes"), glyphLayer.width, glyphLayer.height);
      glG.uniform1f(UG("uReach"), Math.min(130, Math.max(60, gallery.clientWidth * 0.1)) * dpr());
      glG.uniform1f(UG("uCell"), Math.min(20, Math.max(10, gallery.clientWidth / 54)) * dpr());
    }
    measure();
    // One resting frame right away: the fused seams are part of the page even
    // before the pointer arrives — and on a touch device they are the whole
    // show. The frame draws synchronously, so it lands even where animation
    // clocks are suspended.
    drawSubstrate(0);
    if (glG) {
      glG.clearColor(0, 0, 0, 0);
      glG.clear(glG.COLOR_BUFFER_BIT);
    }
  };

  const drawSubstrate = (time: number) => {
    glS.useProgram(fxS.program);
    glS.uniform2f(US("uMouse"), pointer.x * dpr(), pointer.y * dpr());
    glS.uniform1f(US("uMouseIn"), pointer.inside);
    glS.uniform1f(US("uTime"), time);
    glS.clearColor(0, 0, 0, 0);
    glS.clear(glS.COLOR_BUFFER_BIT);
    glS.drawArrays(glS.TRIANGLES, 0, 3);
  };

  const drawGlyphs = (time: number) => {
    if (!glG) return;
    glG.useProgram(fxG!.program);
    glG.uniform1f(UG("uTime"), time);
    const active = hoverIndex >= 0 ? hoverIndex : -1;
    glG.uniform1f(UG("uAmount"), active >= 0 ? amounts[active].value : 0);
    glG.uniform1f(UG("uPhase"), active >= 0 ? phases[active] : 0);
    glG.uniform2f(
      UG("uFocusPos"),
      active >= 0 ? cellArr[active * 4] : 0,
      active >= 0 ? cellArr[active * 4 + 1] : 0,
    );
    glG.uniform2f(
      UG("uFocusHalf"),
      active >= 0 ? cellArr[active * 4 + 2] : 0,
      active >= 0 ? cellArr[active * 4 + 3] : 0,
    );
    glG.clearColor(0, 0, 0, 0);
    glG.clear(glG.COLOR_BUFFER_BIT);
    if (active >= 0 && amounts[active].value > 0.004) {
      glG.drawArrays(glG.TRIANGLES, 0, 3);
    }
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(gallery);

  let raf = 0;
  let running = false;
  let last = -1;
  let idleFrames = 0;

  const frame = (now: number) => {
    raf = window.requestAnimationFrame(frame);
    const dt = last < 0 ? 0.016 : Math.min((now - last) / 1000, 0.1);
    last = now;
    const time = now / 1000;

    const chase = (value: number, target: number, rate: number) =>
      value + (target - value) * Math.min(1, rate * dt * 60);

    // grab 0.14 / release 0.06 per 60fps frame, from the study
    const rate = pointer.tInside > pointer.inside ? 0.14 : 0.06;
    pointer.inside = chase(pointer.inside, pointer.tInside, rate);
    pointer.x = chase(pointer.x, pointer.tx, 0.3);
    pointer.y = chase(pointer.y, pointer.ty, 0.3);

    let alive = pointer.inside > 0.004;
    amounts.forEach((a, i) => {
      const tau = a.target > a.value ? 0.09 : 0.16;
      a.value += (a.target - a.value) * (1 - Math.exp(-dt / tau));
      if (a.value > 0.004 || a.target > 0) alive = true;
    });

    drawSubstrate(time);
    drawGlyphs(time);

    if (!alive) {
      idleFrames += 1;
      if (idleFrames > 30) {
        running = false;
        window.cancelAnimationFrame(raf);
      }
    } else {
      idleFrames = 0;
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    last = -1;
    idleFrames = 0;
    raf = window.requestAnimationFrame(frame);
  };

  const toLocal = (e: PointerEvent) => {
    const g = gallery.getBoundingClientRect();
    pointer.tx = e.clientX - g.left;
    pointer.ty = e.clientY - g.top;
  };

  const onEnter = (i: number) => (e: PointerEvent) => {
    hoverIndex = i;
    amounts[i].target = 1;
    toLocal(e);
    pointer.tInside = 1;
    start();
  };
  const onMove = (e: PointerEvent) => {
    toLocal(e);
    pointer.tInside = 1;
    start();
  };
  const onLeave = () => {
    pointer.tInside = 0;
    amounts.forEach((a) => (a.target = 0));
    hoverIndex = -1;
    start();
  };

  if (options.hoverEnv) {
    gallery.addEventListener("pointermove", onMove, { passive: true });
    gallery.addEventListener("pointerenter", onMove, { passive: true });
    gallery.addEventListener("pointerleave", onLeave, { passive: true });
    cells.forEach((figure, i) => {
      figure.addEventListener("pointerenter", onEnter(i));
      figure.addEventListener("pointerleave", onLeave, { passive: true });
    });
  }

  return {
    cancel: () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      if (options.hoverEnv) {
        gallery.removeEventListener("pointermove", onMove);
        gallery.removeEventListener("pointerenter", onMove);
        gallery.removeEventListener("pointerleave", onLeave);
        cells.forEach((figure, i) => {
          figure.removeEventListener("pointerenter", onEnter(i));
          figure.removeEventListener("pointerleave", onLeave);
        });
      }
      fxS.destroy();
      fxG?.destroy();
      substrate.remove();
      glyphLayer.remove();
    },
  };
}
