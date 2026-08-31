# Extraction Report

## Source

- URL: <https://jesperlandberg.com/>
- Captured at: 2026-08-29
- Permission boundary: public

## Target Visual

A route-persistent Three.js surface renders the site's visible images and rasterized text. DOM elements remain responsible for layout, semantics and hit testing. Scroll intent, pointer feedback, card deformation and shared-element route flights are synchronized by one application clock.

## Target Surface Group

- `surface-1`: the unique full-viewport WebGL2 canvas (`three.js r185`), visible-pixel owner.
- `surface-2`: DOM layout and interaction group, measured by the renderer.
- Effect boundary: route-coupled/site-level.

## Evidence Summary

- Runtime surface and DOM inventory.
- Public production bundle hashes and source anchors.
- Home, sampled project and full-index asset inventories.
- Input constants, target/current follower, wrap and gesture thresholds.
- Shared-plane transition and timing choreography.
- Four screenshots documenting the current browser's GPU-capture limitation.

## Replay Route

`BEHAVIOR_REBUILD`

## Captured Facts

- Surface: one 1280×720 CSS canvas, 2560×1440 backing at DPR 2 in the sampled desktop state.
- Runtime/backend: main-thread Three.js r185 / WebGL2, Nuxt/Vue and GSAP.
- Render graph: direct scene/overlay path plus scene-target/post/overlay path; low-resolution trail feedback and reflection target.
- Resources: KTX2-first texture pipeline with fallback, bounded concurrency, Mux video lifecycle management.
- Timing: 60Hz-normalized virtual scroll, 50ms renderer delta cap, staggered 0–1.25s route choreography.
- Inputs: normalized wheel modes, discrete-wheel inertia, touch and drag release impulses, keyboard and project swipe.
- Output/composite: transparent visible DOM paint with WebGL imagery/text; color enum symbolic name remains `PARTIAL`.

## Baseline

- Path: `capture-baseline/`
- Status: verified interaction-only baseline. Wheel, keyboard, drag/release, infinite wrap, parking, metrics and reset passed local browser QA.

## Editable Project

- Path: not created.
- Status: outside the requested research scope. Existing Gallo application files were not modified.

## Known Gaps

The baseline does not reproduce original imagery, fonts, shaders, post-processing, touch-on-device behavior or shared-element routing. Source screenshots are black because the available browser capture path did not return GPU-composited pixels.

## Deferred Work

- Prototype a reel-scoped input normalizer and lag-shaped deformation inside Gallo's existing FilmCanvas.
- Prototype a reduced-motion-safe held-plane transition from reel to case study.
- Consider KTX2 only after production measurements show texture transfer or memory pressure.
