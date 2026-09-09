# Original artwork holographic badge

The final badge preserves `public/media/badge-card-back.png`. The earlier generated character was rejected because its details changed. Blender crops the original at the existing cover frame, applies an independent alpha matte, and derives registered contours from the same RGB. Original background pixels remain intact; the generated clean plate is used only underneath opaque foreground pixels. A small original-colour edge guard prevents a stationary duplicate fringe when the layers move apart.

Before typography and optical shading, the resting foreground/background composite matches the original crop at every pixel. Both the visible character RGB and visible background RGB have zero error. Read `assets/3d/holo-badge-original/pixel-fidelity.json` and `independent-verification.json` for the numerical evidence.

The editable card is `assets/3d/holo-badge-original/card.blend`. It retains the requested skill's unapplied X=90° image planes, signed depths, subject-alpha material mix, independent edge material and connected high-quality compositor glow. Its rounded body and lanyard slot are real geometry. The public GLB has 1,064 triangles and four material roles. Web GLSL reproduces the layered optical material; offline and browser renders are not claimed to be pixel-identical.

The browser preserves the source print's sRGB brightness without ACES, applies coloured angle-dependent foil and sparse glints, and keeps contour glow below the level that obscures the original art. The same renderer survives flips; a lost context reveals the original printed image underneath.

Performance fixes remove the retired Contact pointer effect's full-screen dirty updates, skip burn noise once the transition is complete, and stop repeatedly pausing dormant video. Lanyard pointer input is merged once per frame, with cached layout and unchanged-value CSS writes omitted. The badge reverse stops drawing when hidden and limits render submissions on high-refresh inputs. These are workload reductions, not a claim of a measured GPU frame-rate improvement.

Validation: TypeScript and both GLB integrity checks pass. Browser checks confirmed loaded original layers, visible foil after ten repeated flips, both view-vector signs, distinct moving highlights, and no reported shader/runtime errors. Blender front and both tilted views are saved in the source project's `renders/` directory. The room's revised baseball, glove and basketball retain baked contact AO and two receiver shadows within the existing 280k triangle budget.
