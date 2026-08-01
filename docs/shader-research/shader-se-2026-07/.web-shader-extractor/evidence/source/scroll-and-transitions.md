# shader.se scroll, snap and transition model (SOURCE)

Chunks: `/_next/static/chunks/0nr6lqdt2xw72.js` (main), `03r54qy_a1k2c.js` (stores)
No source maps published. All values below are read from the bundle.

---

## Scroll driver

```js
new Lenis({
  autoRaf: false,          // driven from the app's own frame loop, not its internal rAF
  orientation,             // switched dynamically
  wrapper: document.getElementById("scroll-container"),
  syncTouch: true,
  syncTouchLerp: 0.05,
  touchMultiplier: 1,
})
```

Lenis **1.3.3**. Defaults kept: `lerp: 0.1`, `smoothWheel: true`, `wheelMultiplier: 1`, no
`duration`/`easing` (so it runs in lerp mode, exponential smoothing at `1 - exp(-60 * lerp * dt)`).

The scroller is a **container** (`#scroll-container`, `fixed inset-0 overflow-y-auto`), not the
window.

### Scroll is locked until the intro finishes

```js
if (initialPage === "main" || initialTransitionDone) { container.focus(); lenis.start() }
else lenis.stop()
```

The CRT boot screen holds the page still. The container is also explicitly `.focus()`ed so
keyboard scrolling works — unless focus currently sits inside `#a11y-overlay`.

### Progress is measured in viewport heights

```js
onScroll({ scroll, velocity }) {
  const vh = cachedInnerHeight
  scrollProgress.set(scroll / vh)     // 2.4 means "2.4 screens down"
  scrollVelocity.set(velocity / vh)
}
```

Not normalised to 0..1. Sections are placed at whole-ish screen positions, which makes the
numbers readable and independent of total page length.

**Velocity is tracked as a first-class value**, not just position.

### Both are motion values, not React state

`scrollProgress` and `scrollVelocity` are `motionValue(0)` from motion/framer. Nothing re-renders
per frame; consumers subscribe. Total page height is pushed to CSS instead:

```js
document.documentElement.style.setProperty("--page-height", lastPage.range.end)
document.documentElement.style.setProperty("--page-width", "1")
```

---

## Snap points

From the store (`03r54qy_a1k2c.js`), `mainPage.snapPoints`:

```js
[
  { id: "start", position: 0,
    range: { forward:  { range: [-10000, 0.1], multiplier: 1 },
             backward: { range: [-10000, 0.8], multiplier: 1 } },
    keyboard: { autoSnapToNext: 2000 } },

  { id: "projects", position: 1,
    range: { forward:  { range: [-0.9,  0.3], multiplier: 1 },
             backward: { range: [-0.22, 0.6], multiplier: [3, 0.3] } },
    keyboard: { autoSnapToPrevious: 2000, autoSnapToNext: 3000 } },

  { id: "about",  position: 3.4 },
  { id: "footer", position: 5 },
]
```

### Only the first two actually snap

`getSnaps()` returns `null` for any entry without a `range`, and those are filtered out. `about`
and `footer` carry a position but no range, so **they are nav targets, not snap targets**.

The reading: you get snapped *into* the machine's viewing position, and once you are past the reel
you scroll freely. Snapping a long reading section would fight the reader.

### How the ranges work

- `position` is in viewport heights.
- The active window is `[position + range[0], position + range[1]]`, chosen by scroll **direction** —
  `forward` when scrolling down, `backward` when scrolling up.
- Candidates are sorted by `currentDistance / multiplier`, so a higher multiplier wins from
  further away.
- `multiplier` may be `[a, b]` — `a` when the snap point is ahead of you, `b` when behind.

Reading the `projects` entry: scrolling **down** into the reel, it grabs you from 0.9 screens
before to 0.3 screens after, at normal strength. Scrolling **up** out of the reel, it grabs you
only from 0.22 before but with multiplier **3** — strongly pulling you back to the reel — while
the value for the other direction drops to **0.3**, making it easy to leave downward.

The asymmetry is the whole trick: easy to enter, hard to accidentally fall out, easy to
deliberately continue.

### Keyboard

Arrow up/down snap between sections rather than scrolling by a line:

- `autoSnapToNext` / `autoSnapToPrevious`, in ms, default 1000 if unset
- start → projects: **2000 ms**
- projects → about: **3000 ms** down, **2000 ms** back up

`snapLockTarget` / `snapLockedUntil` keep repeated presses from fighting an in-flight snap.

---

## What ours does differently (as of 2026-07-25)

| | shader.se | ours |
|---|---|---|
| Smoothing | Lenis 1.3.3 on a container | native scroll, none |
| Progress unit | viewport heights | normalised 0..1 |
| Progress storage | motion values | React `useState`, re-renders the tree every frame |
| Velocity | tracked and used | not tracked |
| Snap | hero↔reel, directional, asymmetric | none |
| Keyboard | arrows snap sections, 2–3 s | arrows step the reel only |
| Nav click | snap with duration | `scrollTo({behavior:"smooth"})`, browser easing |
| Scroll lock | held until intro completes | none |
