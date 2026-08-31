# Screenshot capture note

The four PNG files in this directory were captured from the Codex in-app browser while inspecting `jesperlandberg.com`.

| File | SHA-256 | Result |
|---|---|---|
| `source-top.png` | `5bcca5cc3114282fa53fd144471fee342d6ea18c041ccf83a94591e9c2f9f3d0` | black GPU layer |
| `source-top-late.png` | `2038b638509715bb24f3f26e8624d3f749592863b5733df5f35329f0004173a5` | black GPU layer after delay |
| `source-wheel-520.png` | `8a0745749e9319119a0bba22195fe4a1a7044d27fefae70b40a0b4e80b0ddc83` | black GPU layer after input |
| `source-project-the-lookback.png` | `dca5801a26e044fdca7237a07c43664e2468b29b82c48be29177261f78b2e3ed` | black GPU layer on detail route |

This is a tooling limitation: runtime inspection showed a live, correctly sized WebGL2 canvas, while the public build explicitly makes DOM paint transparent and draws visible pixels in WebGL. The screenshots are retained to document the failed visual-capture path. They are not treated as evidence that the source site is visually black.
