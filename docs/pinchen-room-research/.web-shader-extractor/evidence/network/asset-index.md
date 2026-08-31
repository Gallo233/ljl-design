# Network and asset index

## Home capture

Observed through the page asset inventory after the page settled:

| Type | Count | Notes |
|---|---:|---|
| JavaScript | 9 | Nuxt application, home route, helpers, loaders |
| Font | 1 | ABC Diatype variable font |
| Images | 7 | original/fallback image requests |
| Video | 0 | none on the initial home surface |
| Other | 25 | includes KTX2 textures, manifest and Basis transcoder assets |
| Total | 42 | initial observed set |

## Project detail sample

`/projects/the-lookback` produced 49 observed assets, including 3 Mux high-resolution MP4 requests, 9 images and 10 scripts. Videos are created muted, looped and `playsInline`; the source pauses them when the document is hidden or when their plane is parked/offscreen.

## Full index sample

`/full/` produced 20 observed assets and 10 scripts. It did not need a full project-media payload during the sampled state; hover preview assets are mediated by the preview rail.

## Texture pipeline (`SOURCE`)

```text
/textures/manifest.json
      │
      ├─ matching compressed entry → /textures/*.ktx2
      │                              + Basis transcoder JS/WASM
      └─ failure / missing entry ──→ original image URL
```

- Resolved textures are cached.
- Color space, mipmaps and anisotropy are configured after load.
- Anisotropy is capped at `min(8, renderer capability)`.
- Initial asset concurrency is approximately 6; thumbnail work approximately 2; project media approximately 4.
- `saveData` and 2G connections skip speculative prefetch.

## Performance interpretation

The KTX2 pipeline is useful because the site puts nearly all imagery into GPU textures. It is not automatically useful to Gallo's current film reel, where two frames are real-time render targets and two are video textures. Adopt only after measurements show static texture transfer or GPU memory is a real bottleneck.

## Repository note

Other files already present in this directory belong to the earlier Pinchen room research and were not overwritten or reclassified by this study.
