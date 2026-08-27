# About room asset pipeline

The room ships like the visual reference: Blender-authored geometry plus external,
shared baked-light atlases. Three.js is the loader and interaction layer, not the
source of visual detail.

Run the deterministic source build and bake:

```sh
scripts/blender/build_about_room.sh
```

Optional QA overrides:

```sh
ABOUT_ROOM_ATLAS_SIZE=1024 ABOUT_ROOM_BAKE_SAMPLES=4 scripts/blender/build_about_room.sh
```

Outputs:

- `assets/3d/about-room.blend` — editable source with authored PBR materials,
  `SourceUV`, `BakedUV`, and named hotspot hierarchy.
- `assets/3d/about-room-bakes/` — lossless bake working files.
- `public/models/about-room.glb` — geometry, UVs, normals, hierarchy and extras only.
- `public/models/about-room/baked-blue-hour-*.webp` — shared architecture,
  furniture and prop atlases.
- `public/models/about-room/manifest.json` — hashes and asset budget evidence.
- `docs/design-references/about-room-blender-preview.png` — unlit baked-output QA.

The default release bake is 4096 px with 16 Cycles samples. Use a smaller atlas only
for pipeline debugging; do not ship the QA override as the final room.

If only the web UV contract or GLB settings change, reuse the saved bake source and
skip the expensive lighting pass:

```sh
"$BLENDER_BIN" assets/3d/about-room.blend --background \
  --python scripts/blender/export_about_room_web.py
```
