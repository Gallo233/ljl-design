# POCKET-NT / Blender replacement — 2026-09-07

The game room and reel frame 03 now load the same Blender-authored handheld. The old
runtime shell, primitive controls and separate Switch-like reel model were removed.
Runtime-generated cartridges remain independent, with their existing labels and input bridge.

## Deliverables

- Editable source: `assets/3d/pocket-nt.blend` (local, intentionally untracked).
- Browser asset: `public/models/pocket-nt.glb` (self-contained materials, Draco compression).
- Rebuild: `sh scripts/blender/build_handheld.sh`. Set `BLENDER_BIN` for another installation.
- Source preview: `docs/design-references/pocket-nt-blender.png`.
- Contract check: `node scripts/dev/verify-handheld-glb.mjs`.

The source includes 28 named assemblies, 338,778 triangles, independent control pivots,
materials, a camera and a Cycles studio setup. Export-only decimation modifiers are removed
before saving the source. Blender 5.1.2 was used; no external generation service or assets.

## Authored changes

- Separate front and rear mouldings, a parting gap and a rear service panel.
- A cut display recess with a layered gasket and satin metal bezel.
- Four D-pad arms, four pastel face buttons, SELECT/START and four shoulder controls.
- Thumb caps with concentric rubber ridges, knurled skirts and separate bearings.
- Actual front speaker bores with recessed dark backing; status lenses and typography.
- Rear fasteners, traction ribs, lower USB-C/headphone trim and a cut top cartridge mouth.

The low camera angle in the game room intentionally makes the back and lower ports subtle.
The source preview shows more depth than the nearly frontal gameplay camera.

## Integration contract

`app/play/night-tide/handheldAsset.ts` owns the loader and socket dimensions. Blender's
Y-up glTF export matches the game room coordinates without runtime model fitting:

| Item | Contract |
| --- | --- |
| Body | 13.91 × 7.642857 × 1.25 |
| Display | 7.85 × 4.415625 (16:9) |
| Live display center | (0, 0.3, 0.755) |
| Control names | `control-up/down/left/right/x/y/a/b/select/start/l1/l2/r1/r2` |
| Press axis | Local Y for shoulders, local Z for other controls |
| Cartridge socket | Existing top-edge axis at Z = -0.12 |

The glTF control root moves with its lettering. Raycasting a child primitive resolves to
the same button. The live screen now uses a direct homography from the WebGL camera and
shell world matrix (`screenProjection.ts`), with no separate CSS3D camera. Its origin is
explicitly top-left and its round clipping matches the aperture. The Godot iframe remains
live DOM. Development-only `data-screen-fit` diagnostics compare four actual DOM corner
probes against the WebGL projection; no layout measurements ship in production.

Loader failure or a 20-second stall invokes the existing playable flat-screen fallback.
Late callbacks dispose assets after unmount. The reel retains its drawn standby screen if
the asset cannot load. The same-origin Draco files already in `public/draco/` are reused.

## Measured results

| Metric | Result |
| --- | ---: |
| Compressed GLB | 664,840 bytes / 649.3 KiB |
| Web asset triangles | 171,401 |
| Material primitives | 61 |
| Game-room rendered triangles, observed | 173,799 |
| Game-room draw calls, observed | 72 |
| Asset textures | 0 |
| Articulated controls | 14 |

The web copy is below the 200k asset triangle budget and 1 MB transfer budget enforced by
the verifier. Existing quality tiers, DPR cap (at most 1.4 here), one optional shadow light,
and offscreen render suspension remain in use. Counts are browser renderer observations,
not a physical-phone FPS or thermal benchmark. No broad AAA/premium score is claimed.

## Validation performed

- `npx tsc --noEmit`: passed.
- `node scripts/dev/verify-handheld-glb.mjs`: passed. Checks compression, budgets, every
  control/pivot, status material and the display's geometry bounds against the DOM plane.
- Follow-up screen fit correction: `node scripts/dev/verify-screen-projection.mjs` passed
  225 mathematical point comparisons across viewport sizes, tilt angles and output scales.
  Live DOM corner probes measured less than 0.02 CSS px error at 1280 × 720, 1920 × 1080
  and 390 × 844, including pointer tilt. This is viewport/DOM evidence, not a separate
  browser-toolbar zoom test. Clicking Night Tide's in-screen start menu entered gameplay.
- Scoped `git diff --check`: passed for the changed model integration files.
- Desktop browser, visible document: compressed model loaded, no normal-path console errors.
- Dragged the physical Night Tide cartridge into the new slot: Godot main menu appeared.
- Clicked the model's SELECT control: game exited and cartridge returned to the rack.
- Clicked the model's A control over its lettering: Snake changed from GAME OVER to SNAKE / 000.
- At 390 × 844: no horizontal overflow; model and DOM display remained aligned; cartridge
  buttons remained available. The existing narrow-screen presentation makes the game screen
  small; this change does not redesign that layout.
- Selected reel frame 03: new matching handheld and readable PRESS PLAY display rendered.
- Temporarily removed the local GLB, reloaded, and confirmed the screen was returned to its
  flat DOM parent; Tetris started through a cartridge button. Restored the GLB and verified
  its contract again, then reloaded the normal page.

Other pre-existing workspace modifications were left in place. No production deployment or
commit was made. A production build was not run alongside the development server.
