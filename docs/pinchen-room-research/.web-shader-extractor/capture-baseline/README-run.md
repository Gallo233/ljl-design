# Interaction baseline

This is an interaction-only, asset-free replay of the source site's home-page
virtual-scroll model.

Run from this directory:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

What is source-derived:

- wheel delta normalization and discrete-wheel inertia;
- 60 Hz-normalized target/current following;
- one-viewport `tanh` soft limiting around the displayed position;
- horizontal infinite wrapping;
- mouse-drag threshold, scale, and release impulse;
- keyboard increments;
- velocity signal normalization.

What is deliberately not reproduced:

- original imagery or typefaces;
- Three.js/WebGL shaders and post-processing;
- DOM-to-WebGL text rasterization;
- route transitions, detail-page scrolling, and pointer trail;
- target branding or content.

The Canvas2D cards are a `GUESS` visual proxy. The interaction equations are
`SOURCE` facts linked from `evidence-links.md`.
