/**
 * Procedural surfaces for the deck, drawn to canvases.
 *
 * The machine surfaces are painted here rather than loaded. The one exception is the
 * provider artwork printed onto the record label at runtime; if it is unavailable, the
 * same canvas falls back to the cream paper label. The routines are adapted from a
 * code-built turntable study, restyled onto the editorial palette the light half of the
 * site already uses — `--cream`, `--ink` and `--coral` out of `app/lab/lab.module.css`.
 *
 * ## The one thing to know before editing a colour here
 *
 * These canvases are sampled **raw**. `roomTurntable.ts` never sets `colorSpace` on the
 * textures and never decodes them in the shader, because the room does not either: the
 * baked atlases in `roomBase.ts` are sRGB images read straight into `gl_FragColor` and
 * handed to `postfx` to encode once more. That double encode is the room's authored
 * look, not a bug to fix, and a machine that decoded correctly would sit in the shot
 * looking darker and harder than everything around it.
 *
 * So: the numbers written here are screen numbers. What you type is close to what you
 * see, and no conversion happens anywhere between here and the frame.
 */

/** The palette, as it should read on screen. Keyed down from the CSS tokens — see below. */
export const DECK_PALETTE = {
  /**
   * `--cream` is #fff6e8, and pure #fff6e8 on this machine blows out: the deck stands
   * on a near-white table, and the room's own brightest wood only reaches #b39c7d. The
   * body is that cream carried down into the room's range, which is what lets it read
   * as a light object in a lit room rather than as a hole cut in the picture.
   */
  cream: "#e4d8c4",
  creamLit: "#f0e6d6",
  creamShade: "#c8bba4",
  /** `--ink` #191714, warmed a shade so it belongs to the same daylight as the desk. */
  ink: "#221f1a",
  inkSoft: "#3a352c",
  inkFaint: "#6b6154",
  /** `--coral` #e0733f. One accent, used where a machine would put its one accent. */
  coral: "#e0733f",
  coralDeep: "#b4542a",
  /** Warm metals, because every metal in this room is photographed in warm daylight. */
  steel: "#b9b2a4",
  steelLit: "#d8d1c2",
  steelDark: "#8a8578",
} as const;

/** A canvas at `w × h`, or a square at `w` when `h` is left out. */
function makeCanvas(w: number, h = w) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Salt-and-pepper, to keep a flat fill from reading as plastic. */
function addGrain(ctx: CanvasRenderingContext2D, amount = 16, count = 2400) {
  const { width, height } = ctx.canvas;
  for (let i = 0; i < count; i += 1) {
    const v = Math.round((Math.random() - 0.5) * amount);
    ctx.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},.05)`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1.4, 1.4);
  }
}

/**
 * The body: a cream painted laminate, the way a nice deck's plinth is finished.
 *
 * Not wood. The study this came from wore walnut, which is the one finish that would
 * put a second brown next to the desk's oak and make the machine look like furniture
 * that failed to match rather than an object sitting on it.
 */
export function deckSurface(size = 1024) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, size * 0.7, size);
  base.addColorStop(0, DECK_PALETTE.creamLit);
  base.addColorStop(0.55, DECK_PALETTE.cream);
  base.addColorStop(1, DECK_PALETTE.creamShade);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Very fine directional brushing, so a large flat face has something to catch light on.
  for (let i = 0; i < 300; i += 1) {
    const y = Math.random() * size;
    ctx.strokeStyle =
      Math.random() > 0.5 ? "rgba(255,250,240,.05)" : "rgba(120,104,80,.045)";
    ctx.lineWidth = 0.5 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let t = 0; t <= 1; t += 0.15) {
      ctx.lineTo(size * t, y + Math.sin(t * 5 + i) * 1.4);
    }
    ctx.stroke();
  }
  addGrain(ctx, 14, 2600);
  return canvas;
}

export function vinylFace(size = 2048) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const mid = size / 2;
  ctx.fillStyle = "#0b0a09";
  ctx.fillRect(0, 0, size, size);

  const labelWellR = size * 0.155;
  const grooveInnerR = size * 0.205;
  const outerR = size * 0.492;

  // The flat land between the label and the first groove.
  ctx.fillStyle = "#121110";
  ctx.beginPath();
  ctx.arc(mid, mid, grooveInnerR, 0, Math.PI * 2);
  ctx.arc(mid, mid, labelWellR, 0, Math.PI * 2, true);
  ctx.fill("evenodd");

  // The lead-out spiral, drawn as one continuous line rather than a ring.
  ctx.strokeStyle = "rgba(200,190,175,.13)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let a = 0; a < 22; a += 0.05) {
    const r = grooveInnerR - 3 - a * 1.1;
    ctx.lineTo(mid + Math.cos(a) * r, mid + Math.sin(a) * r);
  }
  ctx.stroke();

  // ~2000 grooves with a slow brightness wave across them, which is what reads as
  // banding on a real pressing when the light rakes it.
  for (let r = grooveInnerR + size * 0.004; r < outerR; r += 1.35) {
    const t = (r - grooveInnerR) / (outerR - grooveInnerR);
    const lum = 9 + (Math.sin(t * 260) * 0.5 + 0.5) * 7 + Math.random() * 5;
    ctx.strokeStyle = `rgb(${lum + 1},${lum},${lum - 1})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(mid, mid, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Track separations.
  [0.3, 0.52, 0.74].forEach((f) => {
    ctx.strokeStyle = "#201e1b";
    ctx.lineWidth = size * 0.004;
    ctx.beginPath();
    ctx.arc(mid, mid, grooveInnerR + (outerR - grooveInnerR) * f, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.strokeStyle = "#24221e";
  ctx.lineWidth = size * 0.005;
  ctx.beginPath();
  ctx.arc(mid, mid, outerR - size * 0.006, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mid, mid, grooveInnerR + size * 0.003, 0, Math.PI * 2);
  ctx.stroke();

  // Warm glints, and dust that got pressed in.
  ctx.strokeStyle = "rgba(150,138,120,.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const a0 = Math.random() * Math.PI * 2;
    const span = 0.15 + Math.random() * 0.5;
    const r = grooveInnerR + Math.random() * (outerR - grooveInnerR);
    ctx.beginPath();
    ctx.arc(mid, mid, r, a0, a0 + span);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(215,205,188,.15)";
  for (let i = 0; i < 80; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = grooveInnerR + Math.random() * (outerR - grooveInnerR);
    ctx.fillRect(mid + Math.cos(a) * r, mid + Math.sin(a) * r, 1.3, 1.3);
  }
  return canvas;
}

export function platterMetal(size = 1024) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const mid = size / 2;
  ctx.fillStyle = DECK_PALETTE.steel;
  ctx.fillRect(0, 0, size, size);
  for (let r = 6; r < size * 0.5; r += 1.5) {
    const v = 176 + Math.random() * 54;
    ctx.strokeStyle = `rgba(${v},${v - 4},${v - 14},.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mid, mid, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = DECK_PALETTE.ink;
  const dotR = size * 0.472;
  for (let i = 0; i < 140; i += 1) {
    const a = (i / 140) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(mid + Math.cos(a) * dotR, mid + Math.sin(a) * dotR, size * 0.004, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** The slipmat: dark felt with the concentric pressing rings a mat picks up. */
export function slipmatFelt(size = 1024) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const mid = size / 2;
  ctx.fillStyle = DECK_PALETTE.ink;
  ctx.fillRect(0, 0, size, size);
  for (let r = size * 0.06; r < size * 0.5; r += size * 0.024) {
    ctx.strokeStyle = "rgba(240,230,214,.055)";
    ctx.lineWidth = size * 0.006;
    ctx.beginPath();
    ctx.arc(mid, mid, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,.45)";
    ctx.lineWidth = size * 0.004;
    ctx.beginPath();
    ctx.arc(mid, mid, r + size * 0.007, 0, Math.PI * 2);
    ctx.stroke();
  }
  // A single coral hairline, at the radius the stylus meets the first groove.
  ctx.strokeStyle = "rgba(224,115,63,.5)";
  ctx.lineWidth = size * 0.004;
  ctx.beginPath();
  ctx.arc(mid, mid, size * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  addGrain(ctx, 14, 1800);
  return canvas;
}

/**
 * The nameplate on the front edge.
 *
 * The study wore a brass plaque reading "Analogic", which is the one part of a borrowed
 * design that cannot simply be recoloured — it is someone else's name on the front of
 * the object. This says what the machine actually is.
 */
export function namePlate(w = 768, h = 224) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, DECK_PALETTE.creamLit);
  bg.addColorStop(1, DECK_PALETTE.creamShade);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = DECK_PALETTE.inkFaint;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.textAlign = "center";
  ctx.fillStyle = DECK_PALETTE.ink;
  ctx.font = `400 ${h * 0.36}px "Instrument Serif", Georgia, serif`;
  ctx.fillText("Signal Deck", w / 2, h * 0.5);

  ctx.strokeStyle = DECK_PALETTE.coral;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.61);
  ctx.lineTo(w * 0.6, h * 0.61);
  ctx.stroke();

  ctx.font = `500 ${h * 0.115}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = DECK_PALETTE.inkFaint;
  ctx.save();
  try {
    ctx.letterSpacing = `${h * 0.055}px`;
  } catch {
    /* Safari < 17.4 has no letterSpacing; the plate reads fine tracked normally. */
  }
  ctx.fillText("GALLO · GUANGZHOU", w / 2, h * 0.82);
  ctx.restore();
  return canvas;
}

/**
 * A control label, printed onto the deck top.
 *
 * Transparent everywhere but the type, so it lies on the cream rather than patching it.
 */
export function controlDecal(text: string, corners: [string, string] | null = null, w = 512, h = 256) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(34,31,26,.9)";
  ctx.font = `500 ${h * 0.17}px "IBM Plex Mono", monospace`;
  ctx.save();
  try {
    ctx.letterSpacing = `${h * 0.05}px`;
  } catch {
    /* see namePlate */
  }
  ctx.fillText(text, w / 2, h * 0.24);
  ctx.restore();
  if (corners) {
    ctx.font = `500 ${h * 0.12}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "rgba(34,31,26,.62)";
    ctx.textAlign = "left";
    ctx.fillText(corners[0], w * 0.03, h * 0.92);
    ctx.textAlign = "right";
    ctx.fillText(corners[1], w * 0.97, h * 0.92);
  }
  return canvas;
}

/** The two speeds, stacked beside the speed knob. */
export function speedDecal() {
  const canvas = makeCanvas(160, 220);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 160, 220);
  ctx.fillStyle = "rgba(34,31,26,.9)";
  ctx.textAlign = "center";
  ctx.font = `500 48px "IBM Plex Mono", monospace`;
  ctx.fillText("33", 80, 72);
  ctx.fillText("45", 80, 168);
  return canvas;
}

/**
 * The record's centre label.
 *
 * Driven by whichever side is on the platter, so the deck's own mix colour is what the
 * reader sees turning. Text is set the way the site sets a label: serif title, mono
 * everything else.
 */
/**
 * The record's centre label.
 *
 * Paper, not paint. The first version filled the whole label with the side's own colour
 * and it came back muddy, because a lit surface in this room only reaches about half
 * value — a mid-tone like coral multiplied by that lands in brown. So the label is cream
 * stock with the side's colour as the rim band and the type in ink, which is both how a
 * label is actually printed and the only version that reads from where the camera sits.
 */
export function recordLabel(
  {
    title,
    artist,
    color,
    artwork,
  }: {
    title: string;
    artist: string;
    color: string;
    artwork?: CanvasImageSource | null;
  },
  size = 512,
) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const mid = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(mid, mid, mid, 0, Math.PI * 2);
  ctx.clip();
  if (artwork) {
    const source = artwork as HTMLImageElement;
    const sourceWidth = source.naturalWidth || source.width || size;
    const sourceHeight = source.naturalHeight || source.height || size;
    const scale = Math.max(size / sourceWidth, size / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    ctx.drawImage(artwork, (size - width) / 2, (size - height) / 2, width, height);

    // The type crosses every kind of artwork in this collection. A narrow smoked band
    // preserves the photograph while giving the record its own readable identity.
    const shade = ctx.createLinearGradient(0, size * 0.2, 0, size * 0.64);
    shade.addColorStop(0, "rgba(9,8,7,.05)");
    shade.addColorStop(0.45, "rgba(9,8,7,.62)");
    shade.addColorStop(1, "rgba(9,8,7,.15)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, size * 0.16, size, size * 0.52);

    const vignette = ctx.createRadialGradient(mid, mid, size * 0.18, mid, mid, mid);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.7, "rgba(0,0,0,.02)");
    vignette.addColorStop(1, "rgba(8,5,2,.56)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#f4ead6";
    ctx.beginPath();
    ctx.arc(mid, mid, mid * 0.87, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // A paper label is never flat: it is brightest where the light lands near the spindle.
  const sheen = ctx.createRadialGradient(mid * 0.72, mid * 0.66, 0, mid, mid, mid);
  sheen.addColorStop(0, "rgba(255,252,244,.4)");
  sheen.addColorStop(1, "rgba(120,104,80,.16)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(mid, mid, mid * 0.87, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = artwork ? "rgba(255,248,236,.55)" : "rgba(34,31,26,.22)";
  ctx.lineWidth = size * 0.006;
  ctx.beginPath();
  ctx.arc(mid, mid, mid * 0.78, 0, Math.PI * 2);
  ctx.stroke();

  const ink = artwork ? "#fff8ec" : "#221f1a";
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = `400 ${size * 0.125}px "Instrument Serif", Georgia, serif`;
  ctx.fillText(ellipsize(title, 16), mid, size * 0.45);

  ctx.font = `500 ${size * 0.052}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = artwork ? "rgba(255,248,236,.82)" : "rgba(34,31,26,.66)";
  ctx.fillText(ellipsize(artist, 22).toUpperCase(), mid, size * 0.56);

  ctx.font = `500 ${size * 0.04}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = artwork ? "rgba(255,248,236,.62)" : "rgba(34,31,26,.44)";
  ctx.fillText("33 \u2153 RPM", mid, size * 0.73);

  // The spindle hole, punched as dark rather than transparent — the label lies on a black
  // slipmat, and a hole would show its rings through the paper.
  ctx.fillStyle = "#0d0c0a";
  ctx.beginPath();
  ctx.arc(mid, mid, size * 0.032, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** Trim to `max` characters on a word boundary where one is close enough. */
function ellipsize(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
