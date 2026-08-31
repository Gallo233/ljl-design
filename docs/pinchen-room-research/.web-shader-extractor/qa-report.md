# QA Report

## Source -> Baseline

| Level | Result | Evidence | Notes |
|---|---|---|---|
| Build | passed | `evidence/qa/baseline-verification.json` | `node --check` passed; HTML/CSS/JS served successfully |
| GPU | not applicable to declared tier | `replay-manifest.json` | Baseline explicitly downgrades WebGL visual replay to Canvas2D behavior rebuild |
| Structural | passed | `evidence/runtime/initial-surface.json`, baseline DOM snapshot | Fixed canvas + DOM-measured card group preserved at the conceptual boundary |
| Visual | passed with gap | `evidence/qa/baseline-verification.json`, `known-gaps.md` | Proxy is legible and renders; no target pixel-fidelity claim |
| Temporal | passed | `evidence/interaction/scroll-model.md`, `evidence/qa/baseline-verification.json` | Source frame-ratio follower and inertia equations implemented and observed settling |
| Interaction | passed | `evidence/qa/baseline-verification.json` | Wheel, keyboard, drag/release, wrapping, parking and reset verified |

## Source -> Baseline Comparisons

| Scenario | Source Evidence | Baseline Evidence | Diff Or Difference Record | Viewport/DPR/Backend | Time/Input/Scroll/Route |
|---|---|---|---|---|---|
| Initial state | `initial-surface.json` | target/current/lag = 0 | Source WebGL appearance unavailable; baseline proxy intentionally distinct | 1280×720 / 2 / WebGL2 → Canvas2D | rAF idle, route `/` |
| Later frame | `scroll-model.md` | target 900.88, current 846.32 after 500ms | State relationship and one-viewport soft limit match; source pixels not comparable | 1280×720 / 2 / WebGL2 → Canvas2D | wheel 520 |
| Relevant interaction | public input source | ArrowRight contributes a normalized 100 step before soft limiting; drag produces release impulse | Touch release not implemented in desktop baseline | 1280×720 / 2 / main thread | keyboard + mouse drag |
| Scroll state | home route source | wrapped transforms and parked states observed | Proxy omits Three sheet deformation; velocity metric is exposed numerically | 1280×720 / 2 | virtual horizontal scroll |
| Route transition | `route-structure.md` | not implemented | Deliberate fidelity downgrade; shared-plane flight is a recommendation, not a baseline claim | source route-coupled / baseline single route | deferred |

## Baseline -> Editable

No editable project was requested or created. The user asked for capture, analysis and material organized for later borrowing.

| Level | Result | Evidence | Notes |
|---|---|---|---|
| Build | not run | — | No projectization |
| Structural | not run | — | No projectization |
| Visual | not run | — | No projectization |
| Temporal | not run | — | No projectization |
| Interaction | not run | — | No projectization |
| Regression | not run | — | Existing site files were not edited |

## Issues

| Severity | Category | Symptom | Return State | Status |
|---|---|---|---|---|
| high | capture | Source GPU canvas screenshots are black | visual capture | documented / downgraded |
| low | local server | `/favicon.ico` returns 404 | build | accepted; no functional effect |

## Repair Rounds

| Round | Hypothesis | Change | Result |
|---|---|---|---|
| 1 | Source behavior can be validated without original pixels | Built an asset-free Canvas2D state visualizer using source constants | passed |

## Truth Audit

| Check | Result | Evidence |
|---|---|---|
| Critical facts have SOURCE/PARTIAL/GUESS labels | passed | `replay-manifest.json`, evidence documents |
| Leaf facts and wiring facts were audited separately | passed | `replay-manifest.json#truth` |
| No fitted value is labeled SOURCE | passed | Proxy color/amplitude marked `GUESS` |
| Known gaps state the blocking unknown and required evidence | passed | `known-gaps.md` |

## Gate Decisions

| Gate | Decision | Required Artifact | Evidence |
|---|---|---|---|
| TARGET_LOCK_GATE | passed | `scout-card.json` | unique canvas + DOM group, source/owner/effect boundary attributed |
| REPLAY_READY_GATE | passed for explicit downgrade | `replay-manifest.json` | `BEHAVIOR_REBUILD`, no blocking unknowns |
| BASELINE_VERIFY | passed with gaps | `qa-report.md` | build and interaction checks passed; visual GPU gap documented |
| PROJECT_VERIFY | not applicable | `qa-report.md` | no editable-project scope |

## Plateau

- Rounds without progress: 0
- Decision: stop after verified behavior baseline; additional work would change the requested scope into visual replay or project implementation.

## Known Gaps

See `known-gaps.md`. The decisive limitation is GPU-frame capture; it is non-blocking for the declared interaction-only tier.

## Final Status

`DONE_BASELINE_WITH_GAPS`
