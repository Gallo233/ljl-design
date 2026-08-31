# Scroll and gesture model

## Global input normalization (`SOURCE`)

| Constant | Value | Purpose |
|---|---:|---|
| wheel scale | `1.25` | Common gain after `deltaMode` normalization |
| touch scale | `3.25` | Touchmove gain |
| touch release | `35` | Last touch delta impulse |
| discrete delta threshold | `40` | Candidate physical wheel notch |
| burst gap | `30ms` | Separates rapid event streams |
| discrete reset | `500ms` | Prevents burst events being treated as isolated notches |
| discrete multiplier | `2` | Extra impulse for isolated wheel ticks |
| inertia blend | `0.22` | Per-60Hz-frame inertia release |
| arrow key | `100px` | Keyboard step |
| page / space | `0.9 × viewportHeight` | Keyboard page step |

`deltaMode` is normalized first: pixel `×1`, line `×16`, page `×viewportHeight`. Continuous touchpad input is applied directly after the 1.25 gain. An isolated large wheel event enters an inertia accumulator at twice that gain.

Inertia release per frame:

```js
step = inertia * (1 - (1 - 0.22) ** min(frameRatio, 4));
```

Residual inertia below `0.05` is flushed.

## Home carousel (`SOURCE`)

The document remains fixed. Wheel `deltaX + deltaY`, drag and keyboard update a virtual `target`. `current` follows it:

```js
current += (target - current) * (0.1 * min(frameRatio, 2));
current = Math.round(current * 100) / 100;
```

Each card is wrapped modulo the total track width and translated by its local wrapped shift. A large single input is softened relative to current position with a viewport-sized `tanh` envelope, preventing abrupt one-frame excursions without imposing a permanent hard clamp.

The visual velocity channel is not raw input:

```js
const x = Math.tanh((target - current) / 550); // 245 on mobile
const velocity = x * Math.abs(x);
```

This signed squared shape suppresses noise near rest and grows decisively under fast input. It drives sheet depth and deformation; observed source parameters include desktop/mobile sheet span `1.15 / 1`, depth `.2 / .18`, door `-.12 / 0`, and spread `1 / .6`.

## Drag (`SOURCE`)

- Intent threshold: more than 10px and horizontal magnitude greater than vertical.
- Move gain: `1.5`.
- Release impulse: most recent delta `×12` if it occurred within 100ms.
- A completed drag suppresses the following click.

## Vertical project column (`SOURCE`)

The detail page and mobile home use a vertical version of the same target/current follower. Items outside the viewport plus a 25% margin are parked. Detail media are duplicated until the stack is at least `1.15 × viewportHeight`, making desktop/fine-pointer wrapping seamless. Touch/coarse-pointer mode is finite and clamped.

## Project-to-project swipe (`SOURCE`)

- Gesture begins after 10px, and aborts when vertical intent wins.
- Raw distance is normalized against `0.8 × viewportWidth`.
- Visual scrub is compressed with `0.4x / (1 + 0.8|x|)`.
- Navigation commits after `|rawNormalized| > 0.25`.
- Otherwise it rolls back over `0.6s` with `expo.out`.
- ArrowLeft and ArrowRight provide an equivalent keyboard path.

## Reduced motion (`EVIDENCE GAP`)

No `prefers-reduced-motion` branch was found in the inspected public chunks. This absence is not a recommendation; any adoption in Gallo should add a static/short transition path.
