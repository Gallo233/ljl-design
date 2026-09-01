# About room — the chair's missing bake, and the whiteboard

Date: 2026-08-31
Scope: `/about-me`

## The chair was never baked

The backrest read as a pale streaked panel. It is not a bad bake — there is no bake.

Measured off the live meshes rather than guessed:

| node | slot 0 UVs | slot 1 UVs |
|---|---|---|
| `top chair` | spans 0.0015 → 0.9986, the whole atlas | **−1.3994 → 2.3994** |
| `top chair.002` | spans 0.0011 → 0.999, the whole atlas | **degenerate — every vertex on (0, 1)** |

Both are wrong, in different ways. Slot 1 on `top chair` runs well outside texture space, so
it wraps the atlas several times over and smears it into bands. Slot 1 on `top chair.002` is a
single point, so the whole panel samples one texel. And slot 0 spans the entire atlas on both,
which no bake layout ever does — a bake gives every mesh its own island.

Sampling the group2 atlas at those coordinates returns **#c5c5c5** in every case: the light grey
the packer leaves *between* islands. The chair's UVs point at empty space.

`roomBase.ts` previously routed the chair to slot 1 on the theory that its bake was packed
there. That was the wrong conclusion from the right symptom.

**Fix.** The chair panels take a flat `#1f1d19` — the median ink of the group2 atlas, which is
the near-black the turntable and the ceiling tubes beside them bake to. It is fed through the
same 1×1 texture, colour space, exposure and lift a sampled texel would take, so it lands in the
room's tonal world instead of beside it. `bottom chair` is untouched: it renders correctly.

**The same check found a second one.** The ceiling tubes (`Tube_Light Grey_0.001/.002/.003`)
carry a second UV set and were not in the override table, so they sampled slot 0 — which
straddles the grey background. Slot 1 is solid ink. They are now routed to it.

The method is the point: which slot holds the bake is a question with an answer. Read the mesh's
UVs, sample the atlas at them, and see whether you land on ink or on the packer's background.

## The whiteboard

Built to the reference site's own behaviour, from
`docs/pinchen-room-research/room-miniapps-2026-08.md`: DOM overlay, five inks
(`#222222 #c0392b #2471a3 #27874a #d4a017`), a 4px nib, a clear button, and the drawing kept in
IndexedDB (`room-local-state` / `artifacts` / `whiteboard-snapshot-v1`) with a localStorage
fallback (`room-whiteboard-v1`), dual-written and read newest-first.

Two things it does that the reference does not:

**The drawing is on the board, in the room.** `whiteboard face` is a four-vertex quad, so its
atlas island could be read exactly and the drawing laid over the bake in place. The island is
turned a quarter — `u` runs up the wall, `v` runs along it toward −Z — which is why the remap is
`vec2(board.y, 1 - board.x)` rather than a guess. The drawing *multiplies* the bake rather than
replacing it, so the board keeps the room's own light across it and ink reads as ink on a lit
surface instead of as a bright rectangle in the wall.

*Corrected 2026-09-01.* The remap shipped as `vec2(1 - board.y, 1 - board.x)` on the claim that
`v` grows toward the viewer's left, and every mark came out mirrored on the wall. The claim was
the error, not the reading: the camera stands at `FULL_HOME` (36, 17.5, 26) and looks at
`HOME_LOOK` (4.2, 5.6, −4.4), so `cross(forward, up)` is (0.667, 0, −0.698) — **−Z is the
viewer's right**, and `v` therefore grows to the right. Decoded off the quad: `u` is 0.447 at
y 9.43 and 0.027 at y 5.23; `v` is 0.001 at z 4.35 and 0.342 at z 0.94.

**The board is a board.** The surface holds ink and nothing else — transparent where untouched,
so the 3D board shows its own bake through it and the sheet shows its own white. One canvas,
shared: the panel is looking at the same pixels the wall is.

The picture went somewhere better; see below.

`ROOM_OBJECTS` gained a `whiteboard` entry, which is only the 3D hover label; it adds no chip.

## The poster beside the bookshelf

The picture belongs in the frame on that wall, where the original site hung a film poster — and
that frame was already broken in a way worth naming, because it is the third instance of the
same fault as the chair and the tubes.

`poster.002` is the sheet inside the frame: sixteen vertices whose UVs run the full 0..1. That
is what a mesh authored to carry *one whole image* looks like, and it is nothing like a bake
island. Routed to the group1 atlas it sampled the entire 2048px sheet, which is the garble that
was sitting in the frame.

So it takes a picture, not a bake: a plain textured material, shown as it is rather than
multiplied into the atlas, because at those coordinates there is no bake to read. The print is
dark, so an unlit surface still sits in the room rather than glowing out of it.

`mirrorU` is set: on the sheet's corners `u = 0` sits at `z = +2.02`, and the claim at the time
was that `+Z` is the viewer's right, so the print needed flipping.

*Flagged 2026-09-01, not yet changed.* That claim is the same one the whiteboard's remap rested
on, and it is wrong — `+Z` is the viewer's **left**. `u = 0` at `z = +2.02` therefore already
puts the image's left edge on the viewer's left, so `mirrorU` is hanging the print back to
front. The whiteboard was never a control for it: the whiteboard was mirrored too.

The fit needs no letterboxing: the sheet is 5.22 x 4.04, an aspect of 0.774 against the image's
0.75, so it maps corner to corner with about 3% of horizontal stretch.

## Checks

- `npx tsc --noEmit`, `git diff --check` clean; five routes 200
- Chair panels resolve to `About room · group2 · flat #1f1d19`; tubes to `· uv1`;
  `bottom chair` unchanged
- `/about-me` loads with the GLB, all seven atlases and `whiteboard-art.jpg` fetched, no
  hotspot warnings, no 500s

## Confirmed on a real screen

The preview browser in this environment runs occluded — it composites nothing and
`requestAnimationFrame` never fires — so none of this could be rendered to a screenshot here.
Everything above was a measurement or a load-time assertion. The author checked it in their own
browser:

- the chair reads as one solid black object, no streaked panel
- the print was on the board, upright and unmirrored, which is the orientation the remap was
  derived from rather than guessed at — and is the evidence the poster's mirror rests on
- the hover label resolves (`画板 / DRAW ON IT`), so the hotspot binds

Still only checkable by the author, not here: the picture in the frame beside the bookshelf and
which way round it hangs, the board reading as clean white, opening the sheet, a stroke landing
under the pointer, and the drawing surviving a reload.
