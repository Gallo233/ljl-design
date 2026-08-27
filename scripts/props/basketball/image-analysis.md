# Image analysis — basketball
Reference: docs/design-references/room-props/basketball.png (crop of about-room-selected.png)

## L1 identification
Work type: basketball (inflated panelled sport ball). Classification: sports equipment prop.
primaryDomain: object. Confidence 0.97.

## L2 form & silhouette
Bounding volume: sphere, 1:1:1. Symmetry: radial about the ball centre, broken only by the seam
layout, which is bilateral about the seam plane. Shape language: geometric. Footprint: tangent
circle on a plank floor, with a contact shadow reading roughly one third of the ball radius.

## L3 macro → meso → micro
- macro: ball body (one sphere).
- meso: seam system — one great-circle seam plus a second orthogonal to it, and four curved
  panel seams, giving the standard eight-panel layout; pebbled surface field.
- micro: pebble grain across every panel; embossed lettering on the lateral panel; the seam
  channel's own bevel.

## L4 spatial relationships
`<seam channel, recessed-into, ball body>` (embed). `<lettering, embossed-on, ball body>`
(relief overlay). `<ball body, rests-on, floor>` (tangent contact).

## L5 materials (PBR)
Substrate: composite rubber/leather. metalness 0 (dielectric, F0 ≈ 0.04). roughness ≈ 0.82 —
observable: a broad, low-intensity specular lobe across the upper hemisphere, no sharp highlight.
Seam channels: same substrate, lower albedo, roughness ≈ 0.75. Relief: pebble micro-bump (normal
scale detail, not geometry); seam channels read as real depth (~2 mm at ball scale), not painted.

## L6 colour & finish
Burnt orange, mid value, moderate saturation. Observed stops: key-lit ~#c46a3a → terminator
~#8a4526 → shadow ~#3e1f14. Seams near-black ~#17100d. Finish: satin.
Inference: the value range is dominated by a single warm key from upper-front-left; albedo with
the lighting removed sits near #a9522c.

## L7 identity-defining features
Eight-panel seam layout with the two orthogonal great circles; embossed lateral lettering;
seam channels dark enough to read as line work at small scale.

## What this single view hides
The far hemisphere, the exact lettering, and whether the pebble grain varies by panel.
