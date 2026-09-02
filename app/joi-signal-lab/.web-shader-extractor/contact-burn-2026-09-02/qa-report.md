# QA Report

## Source -> Baseline

| Level | Result | Evidence | Notes |
|---|---|---|---|
| Build | passed | `capture-baseline/index.html` | Independent local page loads without external script dependencies |
| GPU | passed | `evidence/baseline/initial.png`, `early.png`, `middle.png`, `final.png` | WebGL2 shader compiles and all fixed states paint |
| Structural | passed | `replay-manifest.json` | Old surface remains outside a premultiplied noisy threshold; new field is inside |
| Visual | passed-with-gaps | source `evidence/video/burn-sequence.png`; replay `evidence/baseline/early.png`, `middle.png` | Expanding ragged white-hot boundary matches; content intentionally differs |
| Temporal | passed | `evidence/baseline/early.png`, `early-later.png` | Same fixed scroll progress produces different time-driven edge hashes |
| Interaction | passed | fixed `?p=0`, `.25`, `.45`, `1` states | Scroll progress is represented as deterministic fixed-state input for validation |

## Source -> Baseline Comparisons

| Scenario | Source Evidence | Baseline Evidence | Diff Or Difference Record | Viewport/DPR/Backend | Time/Input/Scroll/Route |
|---|---|---|---|---|---|
| Initial frame | `evidence/video/burn-sequence.png` | `evidence/baseline/initial.png` | Old surface is intact; overlay alpha is zero | 1280×720 / 1.5 / WebGL2 | p=0 |
| Early burn | `evidence/video/burn-sequence.png` row 1 | `evidence/baseline/early.png` | White interior and noisy hot perimeter agree; local content differs by scope | 1280×720 / 1.5 / WebGL2 | p=.25 |
| Middle burn | `evidence/video/burn-sequence.png` row 2 | `evidence/baseline/middle.png` | New surface dominates inside; old surface persists in irregular corners | 1280×720 / 1.5 / WebGL2 | p=.45 |
| Temporal edge | sequential source frames | `early.png`, `early-later.png` | SHA-256 differs at fixed progress, proving time-driven boundary motion | 1280×720 / 1.5 / WebGL2 | p=.25, +0.6s |
| Final frame | `evidence/video/burn-sequence.png` row 3 | `evidence/baseline/final.png` | New surface is fully opaque | 1280×720 / 1.5 / WebGL2 | p=1 |

## Baseline -> Editable

| Level | Result | Evidence | Notes |
|---|---|---|---|
| Build | passed | `npx tsc --noEmit` | TypeScript completed with exit code 0 |
| Structural | passed | `contactField.ts`, `JoiSignalLab.tsx` | Shared stage composites the old room outside a premultiplied threshold without clearing it, and the Contact field inside; all essential copy remains DOM |
| Visual | passed-with-gaps | `evidence/project/desktop-continuity-start.png`, `desktop-cream-transition.png`, `desktop-cream-final.png`, `mobile-cream-final.png` | About remains visible outside the white-hot aperture; the destination resolves into warm cream with a contrasting dark lattice and rounded invitation type |
| Temporal | passed | `evidence/project/desktop-continuity-start.png`, `desktop-continuity-middle.png`, `desktop-continuity-reverse.png` | Forward and reverse states remain scroll-bound; the first burn pixel overlays the intact About frame rather than a black interstitial |
| Interaction | passed | `evidence/project/desktop-cream-wake.png`, `desktop-pointer-settled.png`, `mobile-deeplink.png` | Fine-pointer wake refracts the higher-contrast dark lattice on cream; coarse layout retains scroll burn; `/contact` lands at field/contact 1.0000 |
| Regression | passed | `evidence/project/desktop-final.png`, `mobile-final.png` | Contact copy and badge do not overlap; 390x844 panel spans y=289..574 and all actions remain in the viewport; badge internals were not modified |

## Issues

| Severity | Category | Symptom | Return State | Status |
|---|---|---|---|---|
| P3 | resource | Product will generate a same-distribution noise texture instead of shipping the source PNG | PROJECTIZE | accepted-known-gap |
| P3 | render graph | Product overlay requires a local outer band because it sits after the existing post chain | PROJECTIZE | accepted-known-gap |
| P3 | responsive coordinates | Source fixed 9/16 scale becomes live height/width in product | PROJECTIZE | accepted-known-gap |

## Repair Rounds

| Round | Hypothesis | Change | Result |
|---|---|---|---|
| 1 | Uniform random noise made the field positive too early | Tested the source texture rather than changing progress | Confirmed the source mean is about .25 rather than .5 |
| 2 | Missing high-frequency detail came from shader constants | Switched the isolated baseline from WebGL1 to WebGL2 so NPOT repeat sampling is valid | Ragged source-like boundary restored; constants unchanged |
| 3 | Source's fixed 9/16 radial scale becomes a vertical slit in portrait | Generalized the same ratio to live height/width | Desktop remains source-identical; mobile aperture remains physically round |
| 4 | The first burn pixel appeared over black instead of the About room | Disabled renderer auto-clear only while compositing the Contact overlay, restoring it immediately afterwards | About survives outside the aperture in forward and reverse scroll; final Contact still clears once before taking ownership |
| 5 | The pointer wake lacked contrast on the dark destination | Moved the destination to warm cream, inverted the lattice to brown-black and gave Contact's invitation the rounder body face | Wake has stable edges to bend; desktop and 390x844 copy remain legible and unobstructed |

## Truth Audit

| Check | Result | Evidence |
|---|---|---|
| Critical facts have SOURCE/PARTIAL/GUESS labels | passed | `replay-manifest.json`, `evidence/source/contact-burn.md` |
| Leaf facts and wiring facts were audited separately | passed | `replay-manifest.json` truth section |
| No fitted value is labeled SOURCE | passed | fixed origin, generated noise and local glow are GUESS/PARTIAL |
| Known gaps state the blocking unknown and required evidence | passed | `known-gaps.md` |

## Gate Decisions

| Gate | Decision | Required Artifact | Evidence |
|---|---|---|---|
| TARGET_LOCK_GATE | passed | `scout-card.json` | target-bound current bundle and prior single-canvas attribution |
| REPLAY_READY_GATE | passed | `replay-manifest.json` | no blocking unknowns; fallbacks documented |
| BASELINE_VERIFY | passed-with-gaps | `qa-report.md` | five fixed/temporal baseline frames |
| PROJECT_VERIFY | passed-with-gaps | `qa-report.md`, `evidence/project/` | desktop/mobile forward, reverse, direct-route and pointer-field states verified |

## Plateau

- Rounds without progress: 0
- Decision: project verification complete.

## Known Gaps

- See `known-gaps.md`.

## Final Status

`DONE_PROJECTIZED`
