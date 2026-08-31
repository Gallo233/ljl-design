# Public build index

The files below were fetched from public production URLs on 2026-08-29 for source analysis. Full third-party/site bundles are not committed; this index records hashes, byte counts and useful minified offsets so findings remain auditable.

| Role | Public chunk | Bytes | SHA-256 |
|---|---|---:|---|
| application / renderer | `/_nuxt/CAAmp8x9.js` | 1,086,068 | `9e2566d0fe4357a5e1167693654bbb8234402c2a842ef5913168a45bb35aab09` |
| home route | `/_nuxt/BnF6-OO_.js` | 6,725 | `beb8d7fdbae005b78de1fe3ac4a6a0f458e2d616a4dbb46780077d72e83586f8` |
| vertical column helper | `/_nuxt/I5RRiRwe.js` | 4,404 | `b9f07da02b078aea59834335933ee8923b2b5ed9406ed905e4aae309a46bcdf8` |
| prefetch helper | `/_nuxt/DJ3rQJAD.js` | 685 | `0b0ab1cc30c57f07d5c7f1db5dfb56d90cc43e206be4c661f5ecc1959237b5ef` |
| sampled project route | `/_nuxt/Cm_C3SRB.js` | 11,489 | `e40b44fbbbc176e366be70141659a6a23dcea5f07b0ed0b49e6a236317a7983b` |
| full index route | `/_nuxt/Dw5E6d85.js` | 3,680 | `d73e6bb459788a30f93fbb675847d94a7f9d91f355f21b4c64e1a210085f8855` |
| Three GLTF loader | `/_nuxt/CLXCqztB.js` | 44,763 | `f80da30207466c0a26c0f7abe08b8b3251088a688cdc221c34db5947565ad9e4` |

URLs are relative to `https://jesperlandberg.com` and may change on a future deployment.

## Useful anchors

Offsets refer to UTF-8-decoded minified JavaScript strings and are approximate search anchors, not stable API positions.

### `CAAmp8x9.js`

| Anchor | Approx. offset | Finding |
|---|---:|---|
| `class Z3` | 862130 | application renderer class |
| `new $3({antialias:!0` | 862581 | WebGLRenderer construction |
| `rasterize(){` | 917404 | DOM text measurement / CanvasTexture path |
| `setScroll(e)` | 997009 | shared visual scroll setter |
| `openHole(e)` | 997713 | overlay hole transition |
| `setVelocity(e)` | 1000817 | lag-to-deformation channel |
| `fly(e,t)` | 1012675 | shared-plane route flight |
| `every pixel` console message | 1035466 | public architecture statement |
| wheel listener | 1039968 | input normalizer registration |

### `BnF6-OO_.js`

| Anchor | Approx. offset | Finding |
|---|---:|---|
| wrapped `translate3d` | 2214 | infinite horizontal placement |
| `r.on("vs",A)` | 2818 | virtual-scroll subscription |
| `velocity:e=>r.setVelocity(e)` | 4142 | home lag forwarded to renderer |

### `I5RRiRwe.js`

| Anchor | Approx. offset | Finding |
|---|---:|---|
| `d.on("vs",_)` | 3069 | vertical virtual-scroll subscription |
| `f*et` | 3457 | drag release impulse |

### `Cm_C3SRB.js`

| Anchor | Approx. offset | Finding |
|---|---:|---|
| `Ue=({commit:o})` | 3993 | adjacent-project gesture |
| `ArrowRight` | 7487 | keyboard navigation |
| `finite:N(()=>!d.mouse)` | 7985 | desktop infinite / touch finite behavior |

### `Dw5E6d85.js`

| Anchor | Approx. offset | Finding |
|---|---:|---|
| `n.rail.bind` | 1698 | hover preview rail binding |
| `n.setScroll(0)` | 1954 | fixed full-index initial state |

## Evidence policy

- Numeric constants copied from these anchors are labeled `SOURCE`.
- Semantic names inferred from minified variables are only used where call sites and runtime behavior agree.
- No source maps were discovered during this pass; shader visuals are therefore described structurally, not claimed pixel-exact.
