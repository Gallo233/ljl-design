# About room — the guitar corner becomes a basketball (2026-09-01)

The capture came with a guitar leaning in a stand at the open end of the desk. The room is a
portrait of the person whose desk it is, and that person plays ball rather than guitar, so the
corner is a basketball now. Third code-built object in the room after the deck and the drawable
board, and it follows the same two rules those set.

## What went, and why both meshes

`guitar` is named. Its stand is not — it arrives as `polySurface7_standardSurface1_0.001`, which
says nothing. It was read off its own geometry rather than guessed, by slicing the mesh's
vertices into height bands:

```
y [-1.61, -0.70]  n=269   x [2.02, 5.64]  z [3.82, 7.42]   base, on the floor
y [-0.70,  0.21]  n= 28   x [2.98, 3.32]  z [4.67, 5.02]   pole
y [ 0.21,  4.75]  empty                                     pole, no vertices between rings
y [ 4.75,  5.66]  n=238   x [2.64, 3.98]  z [4.40, 5.58]   cradle
```

and the guitar's neck sits at `x 3.40–3.82, z 4.89–5.48` — inside that cradle's footprint. It is
a guitar stand holding a guitar. Hiding only the guitar would have left the stand holding
nothing, which reads as a bug rather than as a room.

Both are hidden, not deleted, for the reason `roomPlatter.ts` gives about the deck: the geometry
is baked into the capture and its lightmap, so hiding *is* the retirement. The `env` atlas was
checked before committing to this — it is a soft gradient with one small mark elsewhere in the
room and carries no strong contact shadow under either mesh, so nothing is left behind on the
floor when they go. The ball brings its own, drawn as an unlit mark rather than cast, because
the room has no lights.

## The ball

Sized off the twelve-inch record, not off the guitar. The capture is not to scale with itself —
its guitar is about a third the size a guitar would be beside its own desk — so the ball takes
the one dimension in the shot that is exact and that a reader already knows, which is the same
pressing `roomTurntable.ts` scales the deck from. A size 7 ball is 0.242 m against the record's
0.305, so `radius = recordRadius × 0.7934` ≈ 1.17 units, and the two code-built objects cannot
drift apart.

It stands at the stand's own floor centre, `(3.83, −1.61, 5.62)`, measured on the way out rather
than typed in.

The skin is one equirectangular canvas: a leather wash, a jittered pebble lattice thinned towards
the poles so the density stays even on the sphere, and the real eight-panel seam pattern — two
great circles through the poles (four evenly spaced meridians, since a meridian pair half a turn
apart is one circle) plus a sine completing two cycles for the wavy seam, so it crosses every
meridian on the equator and the eight panels come out equal. Drawn straight it would be a beach
ball.

## `roomSurface.ts`

The shading model came out of `roomTurntable.ts` into its own module on the way, unchanged. It
was already the room's answer to "no lights, and a render target that forces linear output"; a
second copy of it in the basketball would have drifted the first time either object was tuned,
and the entire point of the model is that a painted plinth, a turned platter and a rubber ball
agree with each other about what the room's daylight is.

The one behaviour change: the 1×1 white pixel an un-mapped surface samples is module-level now
and is never disposed, because the room can be built and torn down repeatedly across a dev
session and handing it back with the first rig would leave the second sampling a dead texture.

## Still open

`ROOM_OBJECTS` has no chip for it. The list has always said an interest with no object in the
room gets no chip, and the ball games were named in it as one of the three with nothing to point
at — that is no longer true, and a `basketball` hotspot is now a five-line change. It waits on
the interest copy, which is item 3 in `docs/asset-requests.md`.

## Checks

- `npx tsc --noEmit` clean; `git diff --check` clean
- Rendered on `/lab/room-preview`: `ball-wide`, `ball-close`. The ball stands clear of the desk
  (`Cube.001_mate_0` ends at z 3.41; the ball spans z 4.45–6.79) and clear of the floor lamp
  (which starts at z 7.40), occludes the leg rail correctly, and leaves no guitar-shaped gap.
- Skin and shadow canvases sampled from the live material rather than read off a still:
  mean skin `rgb(200, 97, 36)`, shadow centre alpha 76.
