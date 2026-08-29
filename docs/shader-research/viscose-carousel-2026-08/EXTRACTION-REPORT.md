# Viscose Carousel / ICE WORKS — extraction report

 date: 2026-08-29
 method: source-level extraction (both targets are open-source repos; full unobfuscated
 source read directly rather than intercepted at runtime — for these two, the repos are
 strictly better evidence than a live-site pass). Skill used: web-shader-extractor,
 installed to `~/.zcode/skills/web-shader-extractor/`.
 source clones (ephemeral): `/tmp/viscose-extract/{Viscose-carousel,Ice-works-showcase}`

---

## Provenance and relationship

| | Viscose Carousel | ICE WORKS |
|---|---|---|
| repo | github.com/Yousuf-developer/Viscose-carousel | github.com/MegD1/Ice-works-showcase |
| author | Yousuf Soomro (16 y/o, Pakistan; "crafting websites that feel Alive") | MegD1, declared derivative research version |
| license | MIT (c) 2026 Yousuf Soomro — code only | MIT (c) 2026 Yousuf Soomro — code only |
| stack | Next.js 16, React 19, three r185, GSAP 3.15, Tailwind v4, lil-gui | identical (package name is also `viscose`) |

ICE WORKS **is** Viscose plus a particle layer. It says so itself ("衍生关系与署名"):
same ring shader with three added ASCII-particle functions, new monochrome art, a
particle-to-image opening, a breathing seed field, and a hover particle shadow.

Not reusable regardless of MIT: `public/*.webp` (other people's artwork in both repos),
PP Neue Monteal (commercial font, bundled for evaluation only). Reusable: all shader/JS
code with attribution; Satoshi + Geist fonts (free licenses).

## The rendering idea (one shader, one draw call)

A single full-screen fragment shader owns every pixel. Cards do not exist as objects —
each pixel asks "how far am I from the nearest card rectangle?" and the answers are fused
with a **smooth minimum** (`smin`, polynomial, blend radius `k` in px). The goo is that
one number. Everything liquid follows from shapes being distance fields:

- merge = `smin(d1, d2, k)` — two cards近了 fuse into one surface with a fillet
- threads = a separate swept-box SDF between neighbour pairs (not a capsule — a capsule
  bulges past the flat card sides at full merge; the box stays inside the silhouette)
- refraction = warp `p` in place *before* the field is evaluated (glass lip, cursor tag)
  — no second pass, no render target; everything downstream of the warp is refracted free
- per-pixel inverted type on the cursor tag: label colour picked per pixel from local
  luminance so a glyph flips black/white halfway across

## Motion grammar (the "liquid life", phase table)

Entry (GSAP timeline over four scalars: progress → launch → spread → shift):

| phase | driver | what happens |
|---|---|---|
| birth | `progress` 0→1, 1.2s power2.out | seed card swells from 0 at centre; every other card is already inside it |
| gate | loader counter | counter = `min(assets loaded, animation progress)`; ring launches on the exact frame it reads 100 — the number landing and the ring moving are one event |
| launch | `launch` 0→1, 1.95s | ring radius grows from 0; cards peel out of their parent in fan order, alternating left/right, each dragging a thread (`stagger` 0.34s, per-gen smoothstep travel) |
| spread | `spread` 0→1, 3.6s power2.out | all generations in flight at once — one continuous unfurl, some pairs fused, some necking, some thread-thin, some snapped |
| stage | `shift` 0→1 + one full spin, 2.2/2.6s | ring slides left (`posX: -2` half-view-widths) and scales to `endScale: 4.46`; you only ever see an arc of a much bigger wheel |
| heading | `textAt` 0.42 of spread | per-glyph wipe, power4.out, 0.015s stagger; fades out 0.5s *before* the ring lands |

Steady state:

- wheel/drag add angular velocity (`scrollSpeed` 0.0022 rad/s per px, `damping` 0.94 per
  frame, `maxSpeed` 12 rad/s cap), snap to nearest slot below 1 rad/s (`snapTime` 0.8)
- hover: cursor softens `k` in a halo (`melt` +34px within `meltReach` 260px), nearest
  card leans in (`pull` 26px) and swells (`swell` 0.09), its neighbours back off
  (`sidePush` 17px) and dim (`sideDim` 0.15) — that contrast is what reads as *picked up*
- **rates are lopsided on purpose**: `grab` 0.14 / `release` 0.06 per 60fps frame. Equal
  rates read as a mechanism following the cursor; the gap reads as something thick being
  dragged through
- fast pointer leaves a capillary wake: `sin(dist·freq − t·speed)·amp·exp(−dist/reach)`
  ringing out through the field, outliving the movement

The thread model (per neighbour pair, driven from JS into `uLinkPar`):

| property | behaviour as separation `v` goes 0→1 |
|---|---|
| width | `max((1−v)^0.4, hoverWeb)` — thins fast then lingers |
| pinch | middle narrows faster (`rMid` at `smoothstep(0,0.7,v)`) — the neck |
| sag | droop `·v^1.5`, hangs under its own weight |
| dissolve | radius driven **past zero** by 2.9px so the field fades out of AA range — the thread *breaks*, it doesn't flicker off |

Text melting (DOM, the same trick in a different medium): two copies of the word stack,
one blurring out as the other blurs in (blur up to 8.5px), both run through one alpha
threshold (`feComponentTransfer`-style cut at 0.33, gain 400). Two soft edges crossing one
cut fuse into a single shape — smin wearing DOM clothes. A third copy lives *outside* the
filter so unchanged words ("2025"→"2025") don't thicken under the threshold.

ICE WORKS particle layer (all inside the same pass, composited *behind* the card alpha):

1. **intro assembly** — first image as a 4-way-mirrored ASCII diamond (glyph atlas
   `.:+x*#@` rasterised to a 7×128px CanvasTexture), contracted from 3.8× card size,
   diamond→rect morph, colour/luminance adopted over 1.55s, hands off to the card at 2.6×
2. **seed breathing** — a second mirrored field streams in behind the lone card, breathes
   (alpha pulse 0.76–1.0 at ~3Hz), and exits *reversed through the diamond tips* —
   in and out are the same path run backwards
3. **hover shadow** — loose, non-mirrored glyph field behind only the hovered card,
   density falloff `pow(1−dist/reach, 1.25)`, drifts (t·0.45 cell/s + sin wobble),
   fully reversible, latches to its card so an exit can't jump cards mid-flight

Particle discipline: particles belong to exactly two bounded beats (entry, hovered card).
The ring and bridges stay clean. No ambient fog. Skipped entirely under
`prefers-reduced-motion`.

## Key numbers (reference window 1512×870, all px quoted there and scaled by `fit`)

card 90×60 (3:2), corner 6 · ring radius 340, 18 cards, final ring scale 4.46 ·
goo `k` 35px · wobble 3px (decays to 0 as the seed settles) · art crossfade 14px ·
glass lip: top/bottom 8% bands, refract 60px, squeeze 0.05, ripple 5px @ 0.02 freq,
chromatic fringe 1.5px, sheen 0.05 · cursor: melt +34px over 260px reach, pull 26px,
swell 0.09, lean reach 1.7 card-widths, grab 0.14/release 0.06, wake 4px @ 0.05/7 ·
side cards: push 17px, dim 0.15, reach 2.4 widths · thread: thin 0.4, pinch 0.35,
sag 6, dissolve 2.9, fillet 14, hover web 0.2 @ 1.15 reach · tag: frost 0.16, rim 0.02,
refract 39.5, offset (64, −38) · morph: 1.2s circ.out, blur 8.5, cut 0.33, gain 400,
soften 0.35 · entry: stagger 0.34, launch 1.95s, spread 3.6s, stageAt 0.7, spin 1 turn,
endScale 4.46 · ICE particles: intro 1.55s power3.inOut, spread 3.8×, cell 13px,
opacity 0.96; hover reach 82px, cell 11px, opacity 0.58, enter 0.16s / exit 0.11s

## The four bugs that were really design decisions (from the author's BREAKDOWN)

1. **Hover never feeds the goo.** Threads are measured between *rest* positions and birth
   scales, never the leaned/swollen ones — hover moves what you see, never what the
   material is computed from. Otherwise a hover fattens the thread which moves the card…
2. **Deal art by ring slot, not plane index.** Fan order alternates ±, so index order
   deals every other project side by side.
3. **The loader is the gate**, not a readout. `min(assets, progress)`; launch on 100.
4. **Held words need a copy outside the filter**, or the shared threshold thickens them.

## Integration constraints for this repo (ljl.design)

- The film reel's geometry/interaction numbers are `SOURCE`-labeled shader.se facts —
  do not rebuild the reel as a goo ring; it would discard both the measured geometry and
  the video textures of frames 01/02.
- `postfx.ts` is the measured nine-step chain — no extra passes bolted onto it.
- The CRT world is deliberately rigid/mechanical; the *light editorial* world
  (`/work/<slug>`, `/lab`, the ArrivalFade handoff) is where liquid belongs — the
  contrast between the two is the site's existing transition concept.
- Anything new must tier through `quality.ts`, degrade to static, and respect
  `prefers-reduced-motion` (Viscose itself has no reduced-motion path — that gap is ours
  to close, per the house rule: never hide content behind machinery that can fail).
- Attribution: MIT header naming Yousuf Soomro (Viscose) in any ported file; a credit
  line on the /lab page if the prototype ships there.
