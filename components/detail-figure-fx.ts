/**
 * Detail-page figure effects: the one-shot particle condensation on a figure and
 * the reversible glyph shadow that gathers behind a hovered figure.
 *
 * Ported from the viscose study (docs/shader-research/viscose-carousel-2026-08):
 * ICE WORKS' intro assembly and hover shadow, stripped to raw WebGL2. Origin:
 * Yousuf Soomro's Viscose Carousel and MegD1's ICE WORKS derivative, both MIT —
 * the shader math here follows their planeShaders.js. Three is
 * deliberately not imported here — the detail pages carry no WebGL dependency
 * today and a full-screen quad does not justify one. GLSL is kept in ES 1.00
 * style, which a WebGL2 context accepts as-is.
 *
 * Both effects follow the study's particle discipline: particles belong to a
 * bounded beat only — one condensation per page load, one shadow behind the
 * single hovered figure — and both are additive over content that is already
 * fully visible without them. Every entry point returns null or a cleanup; a
 * failed context, a narrow window, or reduced motion simply means the static
 * figure stands alone.
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
  } catch {
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
   spread 3.8 pulled to 2.4 to fit the canvas, cell 13px).
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
    return { w, h };
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
   The hover shadow. One canvas over the whole gallery; the glyph field
   belongs to the single figure under the pointer and enters and exits on
   that figure alone — an exit in flight never jumps to the next card. The
   field only exists outside the figure's rect, so it can sit above the
   figures without ever covering one.
   ------------------------------------------------------------------------- */

const SHADOW_FS = `
  precision mediump float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform sampler2D uGlyphs;
  uniform vec3 uInk;
  uniform vec2 uFigPos;
  uniform vec2 uFigHalf;
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

  void main() {
    vec2 q = vUv * uRes - uFigPos;
    float cardD = max(abs(q.x) - uFigHalf.x, abs(q.y) - uFigHalf.y);
    float outside = smoothstep(1.5, 5.0, cardD);
    float falloff = 1.0 - smoothstep(0.0, uReach, cardD);
    float field = outside * pow(max(falloff, 0.0), 1.25);
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

export type ShadowHandle = { cancel: () => void };

/**
 * The gallery-wide hover shadow. Fine pointers only (the caller checks the
 * media queries); every figure gets its own amount, so a leaving shadow dies
 * on the card it belonged to while the next one gathers.
 */
export function attachFigureShadow(gallery: HTMLElement): ShadowHandle | null {
  const figures = Array.from(gallery.querySelectorAll<HTMLElement>(".project-detail-figure"));
  if (figures.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "figure-fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  gallery.appendChild(canvas);

  const fx = makeFxContext(canvas, SHADOW_FS);
  if (!fx) {
    canvas.remove();
    return null;
  }
  const { gl, program } = fx;
  const U = (name: string) => gl.getUniformLocation(program, name);
  const atlas = buildGlyphAtlas();
  uploadTexture(gl, 1, atlas);
  gl.uniform1i(U("uGlyphs"), 1);
  const ink = readInk(gallery);
  gl.uniform3f(U("uInk"), ink[0], ink[1], ink[2]);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
  const amounts = figures.map(() => ({ value: 0, target: 0 }));
  const phases = figures.map((_, i) => (i * 0.618) % 1);

  let raf = 0;
  let running = false;
  let galleryVisible = true;
  let disposed = false;

  const resize = () => {
    sizeCanvas(canvas, gallery.clientWidth, gallery.clientHeight, dpr());
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.uniform2f(U("uRes"), canvas.width, canvas.height);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(gallery);

  const io = new IntersectionObserver((entries) => {
    galleryVisible = entries.some((entry) => entry.isIntersecting);
  });
  io.observe(gallery);

  const onEnter = (i: number) => () => {
    amounts[i].target = 1;
    start();
  };
  const onLeave = (i: number) => () => {
    amounts[i].target = 0;
    start();
  };
  figures.forEach((figure, i) => {
    figure.addEventListener("pointerenter", onEnter(i));
    figure.addEventListener("pointerleave", onLeave(i));
  });

  let last = -1;
  const frame = (now: number) => {
    raf = window.requestAnimationFrame(frame);
    const dt = last < 0 ? 0.016 : Math.min((now - last) / 1000, 0.1);
    last = now;

    // Asymmetric on purpose, straight from the study: a card takes the field
    // up quickly and lets go of it slowly.
    let alive = false;
    amounts.forEach((a) => {
      const tau = a.target > a.value ? 0.09 : 0.16;
      a.value += (a.target - a.value) * (1 - Math.exp(-dt / tau));
      if (a.value > 0.004 || a.target > 0) alive = true;
    });
    if (!alive || !galleryVisible || document.hidden) {
      // Fully idle: one clearing frame, then the loop stops being scheduled.
      // A pointer entering the gallery is what wakes it again.
      running = false;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      window.cancelAnimationFrame(raf);
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1f(U("uTime"), now / 1000);
    const galleryRect = gallery.getBoundingClientRect();
    const sx = canvas.width / galleryRect.width;

    figures.forEach((figure, i) => {
      const amount = amounts[i].value;
      if (amount <= 0.004) return;
      const rect = figure.getBoundingClientRect();
      const cx = (rect.left - galleryRect.left + rect.width / 2) * sx;
      const cy = (rect.top - galleryRect.top + rect.height / 2) * sx;
      const halfW = (rect.width / 2) * sx;
      const halfH = (rect.height / 2) * sx;
      gl.uniform2f(U("uFigPos"), cx, cy);
      gl.uniform2f(U("uFigHalf"), halfW, halfH);
      gl.uniform1f(U("uAmount"), amount);
      gl.uniform1f(U("uReach"), Math.min(130, Math.max(60, rect.width * 0.14)) * sx);
      gl.uniform1f(U("uCell"), Math.min(20, Math.max(10, rect.width / 54)) * sx);
      gl.uniform1f(U("uPhase"), phases[i]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
  };

  function start() {
    if (running || disposed) return;
    running = true;
    last = -1;
    raf = window.requestAnimationFrame(frame);
  }

  return {
    cancel: () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      figures.forEach((figure, i) => {
        figure.removeEventListener("pointerenter", onEnter(i));
        figure.removeEventListener("pointerleave", onLeave(i));
      });
      fx.destroy();
      canvas.remove();
    },
  };
}
