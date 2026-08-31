# Living Aperture — the second optimization pass

Date: 2026-08-30
Scope: `/work/joi`, `/work/joi-mobile`, `/play/night-tide`, `/lab`
Follows: `living-aperture-optimization-and-extension-qa-2026-08.md`

## Why a second pass was needed

The first pass optimized the JS: it removed a second low-pass on progress, made the snap
duration distance-aware, cached track geometry and shrank the iPhone's drawing buffer. The
scroll still felt heavy afterwards, which is the signal that the work was aimed at the wrong
layer.

Measured on the page, style recalculation plus layout for one progress tick costs **0.42 ms**
(60 iterations of "write the four `--work-*` variables, then force layout"). Reading the five
liquid-card rects costs **0.31 ms**. Against a 16.7 ms frame that is under 5% — the JS driver
was never the bottleneck. Everything expensive was in **paint and composite**, and all of it was
being redone on every single scroll frame.

## What was actually costing the frames

| Surface | Cost per frame | Fix |
|---|---|---|
| `.ambient` background | Full-viewport repaint: the accent bloom was `radial-gradient(circle at calc(16% + var(--work-spread) * 22%) …)`, so a three-layer gradient over the whole stage was re-rasterised every tick | Base gradient is now static and cached; the bloom is its own layer moved by `translate3d`, which is compositor-only |
| `.ambient::after` grain | `mix-blend-mode: multiply` over a backdrop that changed every frame | Grain moved to `::before`, *below* the bloom, so it blends against a static backdrop once |
| `.titleMelt` | `filter: blur(calc(1px + var(--work-spread) * 13px))` — a changing blur radius re-rasterises *and* re-blurs a 138px display glyph every frame | Blur held at a constant `13px`; the spread is carried by `scale()` and `opacity`, which the compositor applies for free |
| `.experienceSurface` | `filter: blur(…) saturate(…)` was always present. `filter` is a render surface even when it evaluates to `blur(0px)`, which pinned the live Joi iframe and the WebGL iPhone out of the compositor fast path for the entire browse range | Switched at a threshold via `data-release`, with a 240 ms transition. Off for progress < 0.68 |
| `.apertureGate` | `backdrop-filter: blur(2px) saturate(.75)` over ~86vw × 72svh, re-reading and re-blurring the animating liquid canvas beneath it, the whole time it is on screen | Flat scrim at a slightly higher opacity |
| `.nav`, `.hud`, Lab and Game Center navs | `mix-blend-mode: difference` on full-width bars (1265 × 68 and 1188 × 12), forcing a bar-wide backdrop readback every frame the field moved underneath | Blend moved onto the marks themselves — 38 × 34 and 90 × 34 boxes instead of the bar |

## The shader

- **`discard` removed.** The GPU here is an Apple M5 (`ANGLE Metal Renderer: Apple M5`), a
  tile-based deferred renderer where `discard` disables the tile fast path. The material already
  draws with blending on and depth off, so the transparent case now writes `vec4(0.0)` instead.
- **The quad is bounded.** The vertex shader takes `uBounds` (centre and half-extent in clip
  space) and the renderer computes, each frame, the union of the active shapes and link bridges
  plus headroom for the smin blend radius, the pointer's extra blend, the ripple amplitude and
  the AA band, clamped to the viewport. Dead background no longer pays for four rounded boxes
  and three swept bridges. With no active state the quad is degenerate.
- **Pixel ratio 1.5 → 1.15**, and it is now re-read on resize. Fragment cost is the square of
  this, so that alone is ~41% fewer fragments; the field is antialiased by `fwidth()` in device
  pixels, so edges are unchanged. Re-reading on resize also fixes a stage constructed while the
  window was narrow rendering at the phone tier for the life of the page — observed live as
  `qualityTier: "low"` with a 1.25 buffer on a 1280px desktop viewport.

Shader validity was confirmed by compiling and linking the exact final GLSL through a raw WebGL
context: both stages compile with empty logs, the program links, and `uBounds` resolves.

## Scroll feel: the browser now owns the snap

The old driver watched for scroll rest (`scrollend`, plus a 280 ms fallback timer), projected a
coast velocity, picked an anchor and then animated `window.scrollTo` on the main thread for
300–520 ms. Every step of that runs *after* the compositor has already committed a frame, so the
page was always answering an input it had finished handling. On a discrete mouse wheel the 280 ms
timer re-armed on every notch, which is the "stuck, then lurch" feeling.

That is all gone. Three 1px sentinels carry `scroll-snap-align: start` and
`scroll-snap-stop: always` at `0`, `--work-track / 2` and `--work-track`; the component sets
`scroll-snap-type: y mandatory` on the scrolling element while it is mounted and in browse mode,
and clears it on unmount, in interact mode, and while a pointer drag owns the position. Fling
curves, rubber-banding and touch tracking are now native and run on the compositor.
`scroll-snap-stop: always` gives one state per gesture, which is what the velocity projection was
reimplementing.

Track geometry and snap positions come from the same `--work-track` variable, so they cannot
drift apart. Verified live: `window.scrollTo({top: 700})` was pulled by the browser to **1280**,
and `--work-progress` resolved to exactly `0.50000`. Sentinels sit at `[0, 1280, 2560]` against a
`maxScroll` of `2560`.

Removed with it: `settleTo`'s rAF animation loop, `snapFromRest`, `cancelSettle`, the gesture
model (`beginGesture`, travel accumulators, direction latching), the velocity integrator, and the
`wheel`, `touchstart` and `scrollend` listeners. The scroll listener now only reads where the page
is. Drag-to-scroll is kept: it suspends snapping while the pointer owns the position and resolves
to one state in the direction of the pull on release. A pointerdown that cancels a pending settle
takes back the promise to re-enable snapping, so a plain click mid-settle cannot leave the page
permanently unsnapped.

## Not verified here

Frame timings. The preview browser in this environment runs occluded: `document.hidden` is
permanently true and `requestAnimationFrame` does not fire at all (measured: 0 frames in 300 ms),
so there is no way to record a real frame budget or an FPS figure from it. A screenshot forces a
single frame, which is enough to read committed state but not to measure motion. Everything above
is either a measured static cost, a structural change with a known compositor consequence, or a
live assertion about committed values — no FPS number is claimed.

## Checks

- `npx tsc --noEmit` — clean
- `git diff --check` — clean
- GLSL compile + link against ANGLE Metal / Apple M5 — clean
- `/work/joi`, `/work/joi-mobile`, `/lab`, `/play/night-tide` render; `data-liquid-ready="true"`,
  `qualityTier: "full"`, canvas pixel ratio 1.149
- Remaining blend/filter surfaces audited in the live DOM: the largest is now `titleMelt`
  (443 × 166, constant blur); every `mix-blend-mode` is on a mark under 200px wide; no
  `backdrop-filter` remains on any Living Aperture surface
