# AGENTS.md

Working context for agents on this repo. Read this before touching the site.

**`README.md` and `GEMINI.md` are stale.** They describe the earlier "Joi Doorway" entrance
(iPhone → knocks → peephole → door). That flow is no longer the site. Treat them as history
until someone rewrites them.

---

## What this is

Gallo's personal site. A Next.js App Router project.

The site is one continuous scroll through four sections, presented as an old CRT terminal you are
inside. Clicking a project takes you *out* of the machine into a light editorial case study. The
contrast between the two is deliberate — it is the transition, not an inconsistency.

Reference for the visual and interaction language: `https://www.shader.se/`. It has been
reverse-engineered; see **Research** below before re-deriving anything.

---

## Routes

```
/                CRT hero — "I design how AI enters human life."
/selected-work   the film reel (6 frames)
/about-me        closing panel (skeleton)
/contact         closing panel (skeleton)
/work/<slug>     project detail — light editorial layout
/classic         the previous light homepage, kept intact and unlinked
/joi-signal-lab  redirects to /selected-work (old link)
```

The first four are **the same page**. One scroll, four addresses. `ExperienceShell` mounts the
experience with an `initialSection`; scrolling rewrites the address bar with `replaceState`.

---

## Layout of the code

```
app/
  page.tsx, selected-work/, about-me/, contact/   thin route wrappers
  joi-signal-lab/
    ExperienceShell.tsx     fonts + mounts the experience at a section
    JoiSignalLab.tsx        the scroll experience, the film reel, closing panels
    Joi9000Hero.tsx         the CRT terminal scene (Three.js)
    sections.ts             section table and scroll math   <-- start here
    joi-signal-lab.module.css
    three.d.ts
  work/[slug]/page.tsx      project detail
  classic/page.tsx          previous homepage
components/
  projectData.ts            case-study content model, bilingual
  NativeProjectDemos.tsx    code-drawn device mockups — PLACEHOLDERS, not finished
  Live2DGate.tsx, Live2DRouteMount.tsx, ParticlePrologue.tsx, ...
docs/
  design-audits/            content design + asset spec   <-- read before designing
  shader-research/          shader.se reverse engineering  <-- read before re-deriving
```

---

## Scroll architecture

`app/joi-signal-lab/sections.ts` owns all of it. Four sections with `start`/`end` positions along
a 0..1 scroll, total 7 viewport heights.

```
hero           0     – 0.28
selected-work  0.28  – 0.62
about-me       0.62  – 0.84
contact        0.84  – 1
```

### The one constraint that will bite you

```ts
export const REEL_ANCHOR = SECTIONS[1].start;
```

The hero's camera flight and the film's entrance were both tuned against a 0..1 range that ends
when the reel has fully arrived. `entry = scrollProgress / REEL_ANCHOR` remaps onto that range so
those components keep their original timing while the page grows.

`REEL_ANCHOR` **must** equal where Selected Work begins. Set it later and deep-linking to
`/selected-work` lands between the hero fade and the film entrance — hero at opacity 0, film at
reveal 0, nothing on screen. This has already happened once.

If you change section boundaries, re-check that deep-linking to each route shows something.

---

## Rendering

Two `WebGLRenderer` instances, two canvases, Three.js **r178**, WebGL2:

- `Joi9000Hero.tsx` — the terminal scene, DPR capped 1.65 / 1.25 mobile
- `FilmCanvas` in `JoiSignalLab.tsx` — the reel, DPR capped 1.7 / 1.25

CRT texture is CSS overlays: `.scanlines`, `.vignette`, `.grain` in the module CSS.

### Do not merge the canvases without asking

A refactor to one canvas + one `EffectComposer` running the ported shader.se post chain was built
and then **rejected by the user**. The code is not in the repo. Do not redo it on your own
initiative.

The reasoning that killed it is worth keeping: the post chain was being applied to six placeholder
frames. **Content before rendering.** Get real assets into the reel first; the grade is worth
doing only once there is something to grade.

---

## The film reel

Six frames, defined in the `projects` array at the top of `JoiSignalLab.tsx`.

Geometry and interaction were matched against shader.se at the source level in an earlier pass —
seven-point chordal `CatmullRomCurve3` tension 1, 160-segment strip, half-height 3.75, frame width
`(4/3) * 7.36 + 0.06`, perspective camera fov 65 / `[0,0,5]` / far 305, drag clamped to 20% of the
viewport crossing at a 10% threshold, one frame per release. **Do not "improve" these numbers.**
They are `SOURCE`-labeled facts, not guesses.

Frame art is currently drawn procedurally onto a `4096 × 512` atlas — **683 × 512 per frame**.
That is too low for real content. The plan is per-frame textures at `1024 × 768`, with the three
video frames as prebaked AVIF sprite sheets rather than `<video>`. See the asset spec.

---

## Content plan

Read `docs/design-audits/reel-content-design.md` and `reel-asset-spec.md`. Short version:

```
01 JOI            Windows screen recording, agent trace, the pause before approval
02 JOI MAP        iOS recording: NEARBY -> VISION -> ROUTE
03 零刻：夜潮      Godot action game, ~/Documents/godot/ashen_blade
04 实验室 LAB      contact sheet; 司天监 VN lives here until it has a vertical slice
05 我的房间        cartoon 3D desk; clicking an object jumps to that interest
06 联系            clapperboard; the reel needs an ending
```

Decided and closed: `leitower` is not used. The Joi character-system material folds into
`/work/joi` rather than getting its own frame.

**Blocked on assets.** The three recordings are the critical path. Do not fabricate placeholder
content that pretends to be real footage — the reel's whole premise is "this was filmed."

---

## Research

`docs/shader-research/shader-se-2026-07/` — a full reverse-engineering pass on shader.se, done with
the `web-shader-extractor` skill. Before deriving anything about that site again, read:

- `gap-report.md` — architecture comparison and what we are missing
- `.web-shader-extractor/evidence/source/post-processing-chain.md` — the complete CRT node graph
  with every constant, including the exact lens-distortion formula
- `.web-shader-extractor/evidence/network/asset-index.md` — their asset pipeline
- `.web-shader-extractor/scout-card.json` — target lock and hypothesis ledger

Facts there are labeled `SOURCE` / `PARTIAL` / `GUESS`. Respect the labels. Anything unlabeled is a
guess.

`app/joi-signal-lab/.web-shader-extractor/` is an older pass covering the reel only, and is
untracked (7.4 MB of screenshots).

---

## Conventions and gotchas

**Package manager.** There is a `pnpm-lock.yaml`, but pnpm is not installed on the author's
machine. Use `npm`. `node_modules` is already populated.

```bash
npm run dev      # next dev -H 127.0.0.1
npx tsc --noEmit # typecheck
```

**Three.js is untyped here.** `app/joi-signal-lab/three.d.ts` declares `three` and its jsm
submodules as bare modules. `THREE.Foo` works as a *value* but not as a *type* — use `any` in type
positions, matching the surrounding code. Add new jsm imports to that file.

**Don't run dev servers in ways that leave them orphaned.** `.claude/launch.json` defines the dev
server config.

**Git.** `app/joi-signal-lab/` was untracked until recently; it is tracked now, so `git restore`
works. Large media directories stay untracked on purpose: `live2d-working/` (130 MB),
`assets/3d/` (64 MB), `deliverables/` (25 MB), `assets/source/` (16 MB). Do not add them.

`tsconfig.tsbuildinfo` regenerates on every `tsc` run and is not ignored — do not commit it.

---

## Open questions

Recorded in `docs/design-audits/reel-content-design.md` §4. The live ones:

1. Does 司天监 stay inside the LAB frame until it reaches M1?
2. Does the killed `leitower` prototype go into LAB as a "why I stopped" entry?
3. `/about-me` and `/contact` are structure only — layout depth is undecided pending assets.

---

## How to work here

The author is building this as their own portfolio and has clear opinions. Two patterns from prior
sessions worth carrying forward:

- **Verify with numbers, not screenshots.** Read the DOM, computed styles, and CSS variables. The
  visual state of this page is easy to misread from a still frame.
- **Agent browser panes usually report `document.visibilityState === "hidden"`, which suspends
  `requestAnimationFrame` entirely.** Everything on this page is rAF-driven — both Three.js loops
  and the scroll driver — so nothing animates and nothing paints there. A blank screenshot or a
  frozen CSS variable in that environment is almost always the harness, not a bug. Check
  `document.visibilityState` and whether a bare rAF loop ticks before diagnosing anything else.
  What *can* be checked: deep-link landing values, route responses, DOM structure, typecheck.
- **When a decision has been made, it is made.** Rejected approaches are recorded above so they do
  not get quietly reintroduced.
