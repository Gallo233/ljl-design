# About room — the deck, the headphones and the desk

Date: 2026-08-31
Scope: `/about-me` (`app/joi-signal-lab/roomPlatter.ts`, `room3d.ts`)

## What was wrong

Three separate intersections, all in the same corner of the desk, all measured off the live
scene rather than eyeballed.

**1. The deck was standing in the headphones.** The replacement turntable is scaled from the
record on the captured platter, not from the plinth — a listener knows how big a twelve-inch
record is, and that is the point of anchoring to it. The consequence is that the machine is
larger than the one it replaces: 4.74 x 5.35 against the captured 3.90 x 4.64, so its front edge
lands 0.376 past where the captured plinth stopped. The capture had left 0.202 of clearance to
the headphones, so the replacement crossed 0.174 straight through the near earcup.

**2. The headphones were inside the desk.** Authored 0.079 below the surface — everything else on
the desk floats a few thousandths *above* it, so this one prop is the outlier, and at the framing
the deck is played at the buried earcup is unmissable.

**3. The captured deck was not fully retired.** `POWER_DIAL_SPEED_LIGHT_GLASS_Circle.105` and
`POWER_DIAL_SPEED_LIGHT_LIGHT_Circle.109` — the old machine's power dial and speed light — were
never in the retirement list. They do not carry "turntable" in their names and they are ~0.13
across, so they survived every previous pass. Both sat sealed inside the replacement's plinth
with only their tips clear of its top face: two small glass nubs on the case that read as a
modelling error rather than as the previous machine still being in the room.

This one was not found by looking. It came out of testing the moved deck's box against *every*
mesh in the room instead of only against the props it was expected to touch.

## What changed

`seatPropsOnDesk(model)` raycasts down from each desk prop and lifts it until its lowest point
rests on whatever is actually beneath it. Only penetration is corrected, and only vertically:
a prop that floats is not wrong enough to move, and a horizontal correction would be — the
room's lighting is baked into the desk atlas, so a prop that slides leaves its own contact
shadow behind.

It found three, and the second and third are the argument for doing this by raycast rather than
by a table of offsets:

| Prop | Lift | Rests on |
|---|---:|---|
| `headphones` | 0.0792 | the desk |
| `film.001` | 0.2408 | `film` — a canister stacked on the other canister, not the desk |
| `pen` | 0.0236 | `StackOfPaper_blinn2_0` |

`clearDeckOfDeskProps(model, deckGroup, margin)` measures the deck against those props and backs
it off along depth until it clears. The deck moves rather than the prop, for the same shadow
reason inverted: the deck is procedural and casts nothing baked. It gave way 0.233, leaving
0.059 of clearance, and its back edge is still 0.307 clear of the desk's own.

Both passes measure the scene, so they stay correct if the capture is re-exported or the deck
model changes shape. The margin scales off the record radius rather than being a constant. If a
prop ever appears on *both* sides of the machine, it reports that instead of shunting the deck
into the other one.

The two POWER_DIAL nodes were added to `RETIRED_DECK_NODES`.

## Verified

Measured in the running room, after the fix:

- deck box vs headphones box: `intersects: false`, z gap `0.0589`
- headphones lowest point `4.7809` against a desk surface of `4.7809` — sink `0`
- deck box against every visible mesh in the room: only `env`, whose bounding box encloses the
  whole room and therefore encloses everything in it
- `npx tsc --noEmit`, `git diff --check` clean

Not verified: a render at the deck's close-up framing. The preview browser here runs occluded,
and the camera move into player mode needs about a second of real frames to arrive. The
bounding-box results are a stronger statement than a screenshot would be — disjoint boxes cannot
interpenetrate — but they are not a picture.
