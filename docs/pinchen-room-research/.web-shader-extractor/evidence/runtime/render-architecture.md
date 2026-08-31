# Render architecture

Status labels: `SOURCE` is directly present in the public build or runtime; `PARTIAL` is supported but a minified symbol cannot be named with full certainty; `INFERENCE` is derived from multiple observations.

## Surface ownership

- `SOURCE` — One full-viewport canvas is appended to `.gl` by the main application renderer.
- `SOURCE` — Renderer construction uses `WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })` and a device pixel ratio cap of 2.
- `SOURCE` — Canvas reports `data-engine="three.js r185"`; the bundled Three renderer uses WebGL2.
- `SOURCE` — No iframe or worker owns the primary surface. The render loop and DOM measurement run on the main thread.
- `SOURCE` — Perspective camera: FOV `53.4`, z `41.18`, near `0.1`, far `2000`.

## DOM/WebGL contract

The site's public console statement accurately summarizes the contract: DOM remains real and owns layout and clicks, while visible pixels are WebGL. Planes follow DOM rectangles, CSS supplies dimensions/corners/colors, and matching `data-id` values let a plane move between routes.

Text is not a conventional DOM overlay. The build measures character ranges, draws glyphs into a DPR-capped Canvas2D texture, and builds segmented geometry (32 × 8 subdivisions per line) that shaders can deform. The source DOM paint is transparent.

## Render graph

```text
DOM measurement / route registry
          │
          ├─ image + video + text planes
          │
Three scene ─────────────┐
                        ├─ direct path → canvas
ground reflection target┤
                        └─ post path:
                           scene target
                             → pointer feedback / distortion pass
                             → overlay scene
                             → canvas
```

- `SOURCE` — Direct mode renders scene then overlay.
- `SOURCE` — Post mode renders the scene into a full-size target, processes it, then renders the overlay.
- `SOURCE` — Pointer trail uses two ping-pong targets with a width of 256.
- `SOURCE` — Ground reflection uses about 10% of drawing-buffer dimensions.
- `SOURCE` — Frame delta is clamped to `1 / 20s` to contain long-frame jumps.
- `PARTIAL` — Output color space is explicitly set; the minified enum matches the Three.js sRGB output path, but no source map was available for a symbolic-name proof.

## Persistent route layer

The renderer has application-level lifetime. Pages claim visual planes through stable `data-id` values. On navigation, the registry retains the old measured state until the new owner attaches, then interpolates position, quaternion, scale, color, alpha, shade, sheet progress and corner radius. The same plane therefore survives a route transition instead of being recreated as a visually similar copy.

## Capture caveat

The in-app browser could inspect DOM, network assets and public bundles, but its screenshot pipeline returned black for the GPU-composited canvas. Four screenshots are retained as evidence of that limitation in `../screenshots/`. Visual shader fidelity is consequently not claimed by the replay baseline.
