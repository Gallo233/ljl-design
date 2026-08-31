# Living Aperture — Optimization and Extension QA

Date: 2026-08-30
Scope: `/work/joi`, `/work/joi-mobile`, `/play/night-tide`, `/lab`
No-redesign boundaries: `/about-me`, `/contact`

## Outcome

The accepted Work visual is frozen and retained. Its scroll/input driver and render scheduling were optimized, then the Living Aperture language was extended to Game Center and The Lab without flattening or removing their real content.

## Work optimization

- Native scroll now owns the current position directly; the old secondary `0.17` visual low-pass was removed.
- Snap waits for true scroll rest (`scrollend` plus a 280ms fallback) and uses gesture direction for decisive wheel/drag input.
- Snap duration is distance-aware (`300–520ms`) instead of a fixed `720ms`.
- A 360px downward test gesture moved `0 → 359px → 1176px → 1307px`, settling at progress `0.5`; it did not snap back to Identity. The reverse gesture settled at `0`.
- Track geometry is cached and remeasured only on resize. `inert` and `aria-hidden` update only when a state threshold changes.
- Liquid geometry is read before inherited CSS variables are written and is reused during pointer-wake decay.
- The aperture-to-fullscreen transition keeps the accepted 620ms opening but uses a FLIP transform, causing one layout resize instead of continuously animating width and height.

### iPhone render cost

Desktop Identity at 1280 × 720:

| | Before | After |
|---|---:|---:|
| Displayed phone | ~265 × 156 | ~265 × 156 |
| Drawing buffer | 1411 × 830 | 423 × 249 |
| Buffer pixels | 1,171,130 | 105,327 |

The Identity buffer is approximately 91% smaller while retaining 1.6 rendered pixels per displayed CSS pixel. Experience and interact states automatically return to full screen-appropriate resolution. The soft shadow map updates only after a visible pose threshold; hidden/offscreen scenes stop their render loop.

Mobile remained 3.9 screens at 390 × 844. Identity used a 104 × 186 iPhone buffer for a 77 × 137 displayed phone in the test harness; Experience returned to the full device-well tier.

## Game Center extension

- Living Aperture now connects the identity, 3D console well, input monitor and next-Lab signal.
- The existing Three.js handheld and CSS3D live screen remain separate and interactive; no iframe or canvas was converted into a texture.
- All four cartridges remain accessible as both 3D objects and semantic buttons.
- Tested `贪吃蛇`: insertion reached `phase=play`, mounted the real 800 × 450 canvas and exposed the eject control.
- Godot remains an iframe path for Night Tide; WebGL failure still falls back to the live flat screen.
- Portrait retains the full archive and controls. At 844 × 390 landscape, page chrome and the liquid renderer step out and the 3D console occupies the complete viewport.
- Desktop liquid DPR is capped at 1.0 and handheld DPR at 1.4 so the new shared language does not exceed the former page's approximate pixel budget.

## Lab extension

- Hero, open-file guide, filing drawer and footer are four states of the same coral/graphite aperture.
- All four real entries, statuses, summaries, lessons, links and existing images remain.
- Fixed a pre-existing disclosure bug: author CSS had overridden the `hidden` attribute, so all closed dossiers still occupied layout. Closed page height dropped from about 2825px to 1385px at 1280 × 720; only the selected dossier now expands.
- Floating preview rAF now runs only while a fine pointer is actually hovering a row.
- Desktop and 390 × 844 mobile disclosure tests passed; the Live2D dossier rendered its real 303 × 404 image on mobile.

## Preserved boundaries

- `/about-me` deep-linked to `scrollY ≈ 3744`, retained six sections and its WebGL room context.
- `/contact` deep-linked to `scrollY ≈ 5472`, retained the call sheet, email and GitHub content.
- No About or Contact component or stylesheet was edited for this extension.

## Checks

- `npx tsc --noEmit`
- `git diff --check`
- Desktop and 390 × 844 Work captures
- Desktop, portrait and 844 × 390 landscape Game Center captures
- Desktop and 390 × 844 Lab captures, closed and expanded
- Runtime console: no application errors; the sole CSS warning found during QA was fixed (`align-items: flex-end`).
- Impeccable detector: the Lab layout-transition warning was fixed by replacing padding animation with transform. The remaining Work grid advisory is an already accepted product-workspace surface inside the frozen visual baseline.

`npm run build` was not run because the local dev server was active and the repository explicitly prohibits sharing `.next/` between those processes.
