# shader.se post-processing chain (SOURCE)

Route: `https://www.shader.se/`
Chunk: `/_next/static/chunks/0nr6lqdt2xw72.js` (2.37 MB, no source map published)
Renderer: `three.js r183` WebGPURenderer, TSL node materials
Component: `D1({renderHandle})` — the final composite pass

All values below are read directly from the minified bundle. Minified identifiers are given in
backticks so they can be re-found; the semantic name follows.

## Composite camera

```js
Tl({ type:"orthographic", left:-1, right:1, top:1, bottom:-1, near:0.1, far:100, basePosition:[0,0,1] })
```

A full-screen orthographic quad. Every page scene is rendered into a texture and composited here.

## Uniform block

```js
{
  texture,                        // scene render target
  bloomIntensity:   1,
  bloomThreshold:   0.1,
  bloomRadius:      0.5,
  bloomSmoothing:   0.2,
  pow:              1,
  sepiaIntensity:   0.3,
  brightness:       1,
  contrast:         1,
  aspectRatio:      1,
  chromaticAbberationStrength: 1,   // spelling is theirs
  motionBlurStrength: 0,
  lightUiTexture, darkUiTexture,    // UI rendered to its own targets
  uiLensDistortion: 0,
  uiLensDistortionBorder: 0,
  uiTransition:     0,
  uiModeTransition: 0,              // light/dark cross-fade
  time:             0,
  noiseIntensity:   0,
  noiseVelocity:    1,
}
```

Every one of these is a live uniform, i.e. the whole CRT identity is animatable per page and per
transition rather than baked.

## Chain order

1. **Selective bloom** — `DX` = `MipMapBlurNode`, called with `levels: 7`.
   Pre-filter keeps only luminance above `bloomThreshold`, feathered by `bloomSmoothing`:
   `mix = smoothstep(threshold, threshold + smoothing, luminance(color))`.
   Result is clamped with `min(bloom, 1)`.

2. **Warm phosphor add** —
   `A = blend(bloom, scene) + bloom * vec3(1.0, 0.8, 0.0) * 0.1`
   A 10% amber tint proportional to bloom. This is what gives lit areas their tube-glow colour
   instead of a neutral white bloom.

3. **Temporal persistence** — `DZ`, a ping-pong pair of `HalfFloatType` RenderTargets with
   `depthBuffer:false`, driven by `motionBlurStrength`, holding `_currentTexture` / `_previousTexture`.
   Resize is debounced by 100 ms.
   **Gated off** when `useSettingsStore.isMobileDevice` or `reducedMemoryMode`.

4. **Gamma** — `pow(color, vec3(pow))`.

5. **Sepia** — standard sepia matrix, mixed by `sepiaIntensity` (0.3), then `* brightness`, clamped:
   ```
   r' = dot(rgb, vec3(0.393, 0.769, 0.189))
   g' = dot(rgb, vec3(0.349, 0.686, 0.168))
   b' = dot(rgb, vec3(0.272, 0.534, 0.131))
   ```

6. **Contrast** — `clamp((c - 0.5) * contrast + 0.5, 0, 1)`.

7. **Lens distortion + rounded bezel** — `DV`, `Dz`, `DW`:
   ```js
   DV(uv, distortion, border):
     n = mix(0.3655, 0.0, border)          // distortion coefficient
     a = vec2(1 - distortion*n)
     s = vec2(distortion*n*0.5)
     return a * barrel(uv, 0, distortion) + s   // rescaled and recentred to stay in frame

   Dz(p, b, r) = rounded-box SDF: length(max(q,0)) + min(max(q.x,q.y),0) - r

   DW(color, uv, distortion, aspect):
     cornerRadius = mix(0.0, 0.04,  distortion)
     feather      = mix(0.0, 0.005, distortion)
     mask  = smoothstep on uv.x, uv.y, 1-uv.x, 1-uv.y   (all four edges)
     mask *= 1 - smoothstep(-feather, feather, Dz(uv-0.5 scaled by aspect, ..., cornerRadius))
     return vec4(color.rgb * mask, color.a)
   ```
   The corner radius and the edge feather are both **driven by the distortion amount**, so the
   bezel tightens as the glass curves. Nothing outside the rounded rect is drawn.

8. **Chromatic aberration** — `Dq` = `ChromaticAberrationNode2`:
   ```
   offset = 0.001 * length((uv - 0.5) * vec2(aspect,1)/max(aspect,1) * 2) * 2 * strength
   ```
   - The split is **vertical**: `r` sampled at `uv + (0,-offset)`, `g` at `uv`, `b` at `uv + (0,+offset)`.
   - Radial: zero at centre, maximum at the edges.
   - **UI-aware**: the UI texture is sampled at the same three offsets; if any of them has
     `alpha > 0` the offset is **halved** (`offset *= 0.5`) so type stays legible.
   - Faded out in the outer 0.005 of each axis via
     `mix(plain, aberrated, min(smoothstep(0,0.005,x), smoothstep(0,0.005,1-x)) * sameForY)`
     to avoid sampling past the edge.

9. **UI composite** — the UI lives in `lightUiTexture` / `darkUiTexture`, sampled through the
   **same `DV()` distortion** as the scene, discarded outside `[0,1]`, cross-faded by
   `uiModeTransition` (light/dark theme), then mixed into the scene by `clamp(uiTransition,0,1)`.
   This is why the typography curves with the glass instead of sitting flat on top of it.

10. **Grain — applied last, after the UI**:
    ```
    seed  = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) + time * noiseVelocity
    g     = gaussian(seed, mean = 0.0, variance = 0.7 * 0.7)
    color.rgb += g * (1.0 - color.rgb) * noiseIntensity
    ```
    The `(1 - color)` term makes grain **inversely proportional to luminance** — dense in the
    shadows, absent in the highlights. It also lands on top of the UI, so text is grained too.

## Supporting facts

- Pixel ratio is clamped to **1.5** (backing 1920×1200 for a 1280×800 CSS box on a dpr-2 display).
  `window.umami.track` reports the real devicePixelRatio separately.
- Quality tiers come from `useSettingsStore`: `isMobileDevice`, `reducedMemoryMode`.
- Pages are portal scenes registered through
  `Tl({pageType, type, fov, near, far, basePosition, baseRotation})`. Observed:
  - `office`   — `perspective, fov 50, near 0.1, far 500, basePosition [0,3.1,5], baseRotation [-0.5,0,0]`
  - `projects` — `perspective, fov 65, basePosition [0,0,5], far 305`
  - also `project`, `about-us`, `contact`, `fwa`
- Pointer input is routed by a central registry
  `GN({pageType, type:"drag"|"button", listeners:{onWheel,onPointerDown,...}, disableCursorChanges})`
  which also sets `document.body.style.cursor`.
- Animation uses motion values (`animate(value, target, {duration: 0.15})` for hover states),
  not hand-rolled lerps.
