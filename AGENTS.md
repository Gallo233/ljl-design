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
/about-me        closing panel — copy, the 3D room, the lanyard badge
/contact         closing panel — the call sheet
/lab             research and retired prototypes, light editorial
/play/night-tide Game Center — the 3D handheld and its five cartridges
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
    JoiSignalLab.tsx        the scroll experience, the stage renderer, the reel, the panels
    heroScene.ts            the CRT terminal, as a renderer-free scene
    room3d.ts               the desk scene: reel frame 05 and the About inset
    roomObjects.ts          desk object ids <-> interest chips, one source of truth
    postfx.ts               the nine-step CRT chain  <-- read its header before editing
    quality.ts              device tiers: DPR caps, bloom levels, persistence, shadows
    badge/                  the lanyard: verlet rope + the CSS holographic card
    roomBase.ts             the desk capture: node names and atlas ids, pure data
    roomRecords.ts          the record rig — retired, see the note in its header
    oceanScene.ts           the sea behind the hero, tier-aware throughout
    solarSystem.ts          the hero's sky: planets, nebula, star field
    heroLightOrb.ts         the orb the reader can pick up in the hero
    JoiMusicPlayer.tsx      the deck UI over the room
    useScrollDriver.ts      smoothing, velocity, snapping, the boot lock
    sections.ts             section table and scroll math   <-- start here
    joi-signal-lab.module.css
    three.d.ts
  work/[slug]/page.tsx      project detail
  play/night-tide/          Game Center: a WebGL+CSS3D 3D handheld (console3d.ts builds the
    GameHandheld.tsx        machine, drag-a-cartridge to play), games/ holds three canvas
    console3d.ts, games/    games (snake/tetris/pacman) + two Godot builds in iframes
                            (night-tide, star-vein) described by `godotGames`, each carrying
                            its own build path and its own shell-button-to-key map. The screen
                            stays live DOM (CSS3DRenderer) because an iframe cannot be a
                            WebGL texture; on WebGL failure the shell folds to a flat screen.
                            Godot exports live in public/games/<id>/ and are re-patched with
                            scripts/godot/patch-web-shell.mjs after every export — that script
                            injects the postMessage input bridge the shell talks to.
  classic/page.tsx          previous homepage
  site.ts                   SITE_URL, canonicalPath(), SHARE_CARD   <-- see below
  robots.ts, sitemap.ts     generated /robots.txt and /sitemap.xml
  icon.svg                  favicon — the header wordmark at 32px
  opengraph-image.png       share card (+ .alt.txt); source in scripts/
  lab/                      /lab — the filing drawer of research and postmortems
components/
  projectData.ts            case-study content model, bilingual
  SiteHUD.tsx               the fixed metadata strip, both worlds
  RevealRoot.tsx            scroll-entry reveals — read its header before touching
  ArrivalFade.tsx           the landing half of the reel -> detail transition
  NativeProjectDemos.tsx    code-drawn device mockups — PLACEHOLDERS, not finished
  Live2DGate.tsx, Live2DRouteMount.tsx, ParticlePrologue.tsx, ...
scripts/
  opengraph-image.tsx       satori source for the committed share card, not a route
docs/
  design-audits/            content design + asset spec   <-- read before designing
  shader-research/          shader.se reverse engineering  <-- read before re-deriving
```

---

## Site metadata

`app/site.ts` holds the site's own address. It exists because `metadataBase` used to say
`gallo.design` while the site served from `ljl.design`, which silently pointed every relative
canonical and every share image at a domain that is not this one.

Two rules that are easy to get wrong here, both learned by getting them wrong:

- **Metadata set on a layout propagates to every route beneath it.** A `canonical` or an
  `og:url` in `app/layout.tsx` reaches `/classic` and `/play/night-tide` too, and tells them
  they are the homepage. Canonicals are therefore declared per page, `app/page.tsx` included.
- **A page's `openGraph` replaces the layout's rather than merging into it** — and takes the
  file-convention `opengraph-image.png` with it. Any route that declares `openGraph` must also
  name `SHARE_CARD`, and repeat `siteName` / `type`.

`trailingSlash: true` means canonicals end in `/` — that is what `canonicalPath()` is for — and
it is also why the share card is a committed `.png` rather than a generated `opengraph-image.tsx`
route. See the header comment in `scripts/opengraph-image.tsx`.

---

## Scroll architecture

`app/joi-signal-lab/sections.ts` owns all of it. Four sections, each with a `position` measured
**in viewport heights** — not a 0..1 fraction. `TOTAL_SCREENS` is the last position plus one
screen to read it in, and `JoiSignalLab` sets the page height from it inline.

```
hero           position 0     ← snaps
selected-work  position 2     ← snaps, asymmetric window
about-me       position 5.2   ← nav target only, snap: null
contact        position 7.6   ← nav target only, snap: null

TOTAL_SCREENS = 7.6 + 1 = 8.6
```

The gap report asked for 8–12 screens against the reference's 17.8; this is the low end of
that, and the room went where it was most needed. The hero→reel handoff now breathes across
roughly 1.0→1.7 screens instead of finishing inside 0.22, and the reel holds about 2.4 screens
of interactive dwell for six frames.

Only the first two snap. About Me and Contact carry a position but no snap window, so they never
yank a reader who is partway through reading them.

### The one constraint that will bite you

```ts
const reelSection = SECTIONS.find((section) => section.id === "selected-work");
export const REEL_ANCHOR = reelSection.position;
```

The hero's camera flight and the film's entrance were both tuned against a 0..1 range that ends
when the reel has fully arrived. `entry = scrollProgress / REEL_ANCHOR` remaps onto that range so
those components keep their original timing while the page grows.

`REEL_ANCHOR` **must** equal where Selected Work begins. Set it later and deep-linking to
`/selected-work` lands between the hero fade and the film entrance — hero at opacity 0, film at
reveal 0, nothing on screen. This has already happened once, which is why `sections.ts` throws in
development if the anchor is not also `SECTIONS[1]`.

The lookup is by id on purpose. The guard used to read `SECTIONS[1].position` into the constant
and then assert it against `SECTIONS[1].position`, which cannot fail — inserting a section above
Selected Work would have moved the anchor silently, which is the exact accident the guard is
there to catch.

If you change section boundaries, re-check that deep-linking to each route shows something.

---

## Rendering

One stage `WebGLRenderer`, Three.js **r178**, WebGL2. The scenes are renderer-free modules
the stage composites:

- `heroScene.ts` — the terminal: GLB, CRT screen material, beam, fog
- `oceanScene.ts` — the sea drawn into the terminal's screen: Gerstner cascade, sky, sea states
- the reel scene, built inside `FilmCanvas` in `JoiSignalLab.tsx`
- `room3d.ts` — the desk, used twice: as reel frame 05's render target and, separately,
  as the About panel's interactive inset

`FilmCanvas` owns the canvas, the loop and the pointer routing. It draws the hero into the
post chain's slot A and the reel into slot B, blends them by the reel's own reveal, and puts
the result through `postfx.ts`. `quality.ts` holds the tier decisions (DPR 1.5 / 1.25 mobile,
bloom levels, persistence, shadows, MSAA).

**The About room keeps its own small context on purpose.** It is a panel widget in a box, not
a fullscreen layer that cross-fades with anything; folding it into the stage would buy a
scissor rectangle and no seam. Two contexts, not one, and that is the intended number.

### The post chain

`postfx.ts` runs the reference's nine steps in the documented order: selective bloom → warm
phosphor add → temporal persistence → gamma → sepia → brightness and contrast → lens
distortion with a rounded bezel → vertical chromatic aberration → gaussian grain last. Numbers
come from `docs/shader-research/`, and they are measurements. The CSS `.scanlines` and `.grain`
layers are gone; `.vignette` stays, because it is the tube's edge over the DOM as well.

Three r178 behaviours this depends on, all verified in `node_modules` rather than remembered:

- **Rendering into a render target forces linear output and disables tone mapping** (both
  selections test `_currentRenderTarget === null`). So the chain owns the single linear→sRGB
  conversion, and it sits between the light transport and the grade — bloom is physical and
  belongs in linear, while contrast pivoting on 0.5 and grain scaled by `(1 - colour)` were
  authored on encoded values. Never add `<colorspace_fragment>` to a chain shader: that is a
  second encode and it lifts the whole picture into milk.
- The hero was authored under `NeutralToneMapping`, which a render target drops. The blend
  pass re-applies three's own mapper **to the hero tap only** — the reel and the room never
  had it.
- three's injected common chunk already declares `luminance()`. Chain helpers are namespaced
  (`postLuma`, `postLinearToSrgb`) for that reason.

The light half of the chain runs once, in a base pass, rather than once for the persistence
path and once for the direct path. That is not tidiness: two copies of an encode is how a
chain like this ends up converting twice.

**What is still DOM, deliberately.** The reference renders its UI into a texture and pushes it
through the same distortion, then halves the aberration where UI alpha is non-zero. Our
typography stays DOM above the canvas, so the headings are not curved or aberrated. The CSS
backdrops (`.heroField`, `.blueField`) are likewise outside the glass. Both are known gaps,
recorded rather than hidden.

### The record this replaces

An earlier attempt at this merge was rejected, and the reasoning was right at the time: the
post chain was being graded against six placeholder frames. **Content before rendering.** That
condition is now met — every frame carries real content — and the merge was redone in that
order, content first. The old warning no longer applies; this section is what does.

---

## The film reel

Six frames, defined in the `projects` array at the top of `JoiSignalLab.tsx`.

Geometry and interaction were matched against shader.se at the source level in an earlier pass —
seven-point chordal `CatmullRomCurve3` tension 1, 160-segment strip, half-height 3.75, frame width
`(4/3) * 7.36 + 0.06`, perspective camera fov 65 / `[0,0,5]` / far 305, drag clamped to 20% of the
viewport crossing at a 10% threshold, one frame per release. **Do not "improve" these numbers.**
They are `SOURCE`-labeled facts, not guesses.

Every frame is a real destination now, and three of the six are live rather than atlas art:

```
01  JOI            video texture      -> /work/joi
02  JOI MOBILE     video texture      -> /work/joi-mobile
03  GAME CENTER    live 3D handheld   -> /play/night-tide      (render target)
04  THE LAB        drawn folder       -> /lab
05  MY ROOM        live 3D desk       -> scrolls to /about-me  (render target)
06  CONTACT        drawn call sheet   -> scrolls to /contact
```

Frames 05 and 06 are sections of this same page, so the open handler scrolls instead of
pushing a route — a push would remount the lab and replay the boot. The two render-target
frames are only drawn while the reader is within one frame of them.

The placeholder desaturation that used to wash frames 04–06 is gone: nothing is a placeholder
any more, so the film-stock desaturation is uniform across all six.

Atlas art still lives on a `4096 × 512` sheet — **683 × 512 per frame** — which is fine for the
drawn frames and would not be for photography. If real stills ever replace them, go to per-frame
`1024 × 768` textures; see the asset spec.

---

## Content plan

### The prose was cleared, and has now been rewritten

Four surfaces were emptied on purpose so the rewrite could start from a blank page instead of
editing around a skeleton. **That clearing is done.** The copy on them now is a fresh draft, not
a restoration from git — the old prose stays gone deliberately.

| Surface | State |
|---|---|
| `/work/joi` | Full bilingual case study, plus the live Joi session. |
| `/work/joi-mobile` | Full bilingual case study. No figures yet — the four iOS screenshots it wants are in `docs/asset-requests.md`. Do not stand in Joi Map imagery; that is a retired, different product. |
| `/about-me` | Copy, the interest chips, the 3D room and the lanyard badge. The internship timeline is still an explicit placeholder slot. |
| `/contact` | The call sheet: email, GitHub, resume. |

Two rules that outlived the clearing:

- **Only wire assets that exist.** Every `src` in `projectData.ts` points at a file in `public/`
  today. The previous version referenced five images that had never been committed, so the page
  rendered broken figures for weeks without anyone noticing.
- **The slots are load-bearing.** The closing `<section>`s in `JoiSignalLab.tsx` are scroll
  positions (`sections.ts`), nav targets, and the elements `--about-progress` /
  `--contact-progress` animate. Deleting one means re-deriving the scroll layout.

Drafted copy carries a `// COPY-REVIEW` marker. It is written to be read, not to be filler, but
it has not been through the author yet.

### The reel

`docs/design-audits/reel-content-design.md` and `reel-asset-spec.md` planned this, and both are
**partly superseded** — read them for the reasoning, not for the current line-up. What changed,
and why:

- **03 is the Game Center, not a Night Tide screen recording.** The frame renders the actual 3D
  handheld live into a target and links to `/play/night-tide`, where five cartridges are
  playable. The planned gameplay capture is not needed and not wanted.
- **04 dropped 司天监.** The lab files four real things instead: the CRT/shader research, the
  Live2D binding work, the particle prologue retrospective, and the leitower postmortem — which
  reverses the old "leitower is not used" decision. Knowing why you stopped is the entry.
- **05 is live**, a procedural 3D desk rather than a planned asset, and it doubles as the About
  panel's interactive room.
- **06 is drawn** rather than photographed.

Still true, and the reason 01 and 02 look the way they do: **do not fabricate content that
pretends to be real footage.** Those two frames play genuine recordings. The drawn frames are
drawn — labelled, abstract, obviously graphic — precisely so they never pass as photography.

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

**Package manager.** Use `npm`. `node_modules` is already populated. (The `pnpm-lock.yaml` and
`pnpm-workspace.yaml` that used to sit here were traps — pnpm is not installed on the author's
machine — and have been removed.)

```bash
npm run dev      # next dev -H 127.0.0.1
npx tsc --noEmit # typecheck
```

**Never `npm run build` while a dev server is running.** They share `.next/`, and the build
overwrites the chunk map the running dev server is serving from — every route starts answering
500 with `Cannot find module './vendor-chunks/…'`. It looks exactly like a code regression and is
not one. Stop the dev server first, or restart it after the build.

**Three.js is untyped here.** `app/joi-signal-lab/three.d.ts` declares `three` and its jsm
submodules as bare modules. `THREE.Foo` works as a *value* but not as a *type* — use `any` in type
positions, matching the surrounding code. Add new jsm imports to that file.

**Don't run dev servers in ways that leave them orphaned.** `.claude/launch.json` defines the dev
server config.

**Git.** `app/joi-signal-lab/` was untracked until recently; it is tracked now, so `git restore`
works. Large media directories stay untracked on purpose: `live2d-working/` (130 MB),
`assets/3d/` (64 MB), `deliverables/` (25 MB), `assets/source/` (16 MB). Do not add them.

`tsconfig.tsbuildinfo` regenerates on every `tsc` run. It is in `.gitignore` now, so it no longer
turns every typecheck into a diff you have to remember not to commit.

---

## Open questions

The three that used to live here are all answered: 司天监 is out of the reel entirely,
`leitower` is in the LAB as its postmortem, and the closing panels have their depth.

What is actually open:

1. **Assets the author owns.** `docs/asset-requests.md` is the list, and it is short: a portrait
   for the badge front, the interest copy, four Joi Mobile screenshots, and a reference image
   for the LAB page's layout. The holographic badge-back art has landed. The internship timeline
   no longer has a slot in the markup: the About prose was removed on purpose and is being
   rewritten as labels hanging off the room's objects, so that copy lands in `roomObjects.ts`.
   Everything ships without them; each has a stable slot to drop into.
2. **The drafted copy** carries `// COPY-REVIEW` and has not been through the author.
3. **The post chain's grade** is set to measured defaults driven by scroll. Distortion, grain,
   sepia and aberration are the knobs, all in the `post.uniforms` block in `FilmCanvas`.
4. **~35 MB of orphaned assets** in `public/` — the doorway-era art, a stale duplicate reel
   directory, a duplicated Live2D vendor copy. Confirm before deleting; git can undo it.

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
  not get quietly reintroduced — and when one is deliberately reversed, the record says so and
  why, rather than being quietly deleted.
- **Never hide content behind machinery that can fail.** Reveal animations arm elements from
  JavaScript, one at a time, only while off-screen; the boot lock releases on a timer; the
  handheld folds to a flat screen when WebGL refuses. A lost animation costs nothing. A blank
  page costs everything.
