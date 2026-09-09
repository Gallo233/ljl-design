# Room sports props — September 9 revision

The user rejected the first generated sports props: the basketball channels and baseball stitching were inaccurate, the glove looked assembled from tubes, and the objects lacked grounding.

## Construction

- Basketball: eight leather panels defined by real recessed channels and inset rubber. A spherical figure-eight curve partitions the covers; two orthogonal great-circle bisectors are rotated 45° relative to its axes so all eight panels have the same area. The uniform spherical mesh stays round through the deeply curved U-shaped joins. This follows the construction shown in [Spalding's manufacturer drawing, US2843383](https://patents.google.com/patent/US2843383A/en), rather than drawing arbitrary bands over a sphere.
- Baseball: the diameter is 74/242 of the basketball's diameter. A single continuous spherical curve separates two figure-eight leather panels; 108 equally spaced stations are measured by arc length. Each station has two diagonal red stitch legs, paired needle punctures and a recessed leather split. The two-cover / 108-double-stitch construction is also documented in [UCLA's pitching research](https://escholarship.org/content/qt6mz24386/qt6mz24386.pdf).
- Glove: four padded finger sleeves with rounded inward-curled tips, a curved thumb, a concave palm, flat stitched H-web, continuous edge lacing and punched eyelets. The finger roots taper into the palm and the leather body is fused and smoothed in Blender. Geometry and pocket proportions are informed by [Wilson's A2000 infield glove family](https://www.wilson.com/en-us/baseball/baseball-gloves/a2000/a2000-infield?p=0); this is an original unbranded model.

## Shading and grounding

`optimize_room_glove.py` reduces only redundant leather-surface density, preserving every baseball vertex, stitch, lace and eyelet. The accepted high-density sculpt is retained in `assets/3d/about-room-props-sculpt.blend`; the final `.blend` and GLB share the optimized geometry.

`build_room_props.py` ray-samples the actual meshes into a `RoomAO` vertex attribute. That survives glTF as `COLOR_0` and darkens local contact and creases through an opt-in `roomSurface` path. Fine leather grain is editable in the Blender materials and reproduced by the web surface shader, with distance filtering.

The Blender script also generates two transparent 256 × 256 receiver masks. They include contact occlusion and area-light penumbra, using the same key direction `(0.38, 0.86, 0.34)` as `roomSurface.ts`. These are placed on the existing floor/table. The baked room receives no additional real-time light. The old basketball shadow remains until its replacement texture loads.

## Files and checks

- Editable source: `assets/3d/about-room-props.blend` (local source, intentionally untracked).
- Build: `scripts/blender/build_room_props.py` (Blender 5.1.2).
- Runtime: `public/models/about-room-props.glb` and `public/models/room-props/*-shadow.png`.
- Close-up Blender QA renders: `assets/3d/room-props-qa/`.
- Integrity check: `node scripts/dev/verify-room-props.mjs` verifies named assemblies, normals, AO, compressed mesh budget and RGBA masks.
- Web budget: at most 1.5 MiB for the compressed GLB and 280k triangles across all three assemblies, including the retained MacBook. This is a deliberate increase from the rejected coarse props.

MacBook geometry and the `screen.001` live-screen handoff are retained.
