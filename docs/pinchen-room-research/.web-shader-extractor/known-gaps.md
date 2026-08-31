# Known Gaps

| Gap | Severity | Unknown Class | Evidence | Impact | Next Step |
|---|---|---|---|---|---|
| In-app browser screenshots contain a black GPU layer | high for visual fidelity, none for interaction study | important | `evidence/screenshots/README.md` | Cannot perform source-pixel or multi-frame shader comparison | Capture with a GPU-aware browser/frame debugger if a visual shader reconstruction is later requested |
| Source shaders and post chain were not replayed | high for visual fidelity | deferred | `evidence/runtime/render-architecture.md` | Baseline does not reproduce warping, sheet shading, pointer trail or holes | Start a separate `PIPELINE_REPLAY` only if those visuals become an implementation goal |
| Shared element route flight is documented but absent from baseline | medium | deferred | `evidence/dom/route-structure.md` | Baseline validates scroll feel, not route continuity | Prototype a bounded reel-to-case-study handoff in the actual site behind a flag |
| Original imagery and ABC Diatype are not included | low | non-blocking assumption | `capture-baseline/README-run.md` | Proxy deliberately does not resemble the target brand | Keep baseline asset-free; use Gallo's own project media in implementation |
| Touch constants are documented but the desktop baseline implements mouse drag only | medium | important | `evidence/interaction/scroll-model.md` | Physical mobile gesture feel is not validated | Add PointerEvent touch handling and test on a physical iOS device before adoption |
| No `prefers-reduced-motion` path found in inspected source | high for adoption | important | `evidence/interaction/scroll-model.md` | Direct copying would leave a motion-accessibility gap | Preserve Gallo's reduced-motion behavior and add static shared-element fallback |
| No production source maps were available | low | important | `evidence/source/build-index.md` | A few minified enum names, including output color space, remain `PARTIAL` | Re-check only if a future deployment exposes source maps |
| Mobile visual state was not captured on a physical device | medium | important | route/source analysis only | Responsive constants are source-backed, visual balance is not | Validate compact layout and touch inertia on-device |

## Fidelity Tier

`BEHAVIOR_REBUILD` — interaction-only/source-derived-scroll.

## Non-Blocking Assumptions

- The source's main output color enum is consistent with Three.js's sRGB path, but remains labeled `PARTIAL` without source maps.
- Canvas2D gradients, typography and the small velocity offset in the baseline are `GUESS` placeholders used only to expose motion state.
- No original assets are required to validate the virtual-scroll equations.
