# Known Gaps

| Gap | Severity | Unknown Class | Evidence | Impact | Next Step |
|---|---|---|---|---|---|
| Seeded noise replaces the source PNG pixels | P3 | resource | `evidence/source/contact-burn.md` | Boundary microstructure differs while scales and motion remain matched | Capture the public texture only if exact pixel identity becomes a requirement |
| Local soft band replaces shared post bloom | P3 | render graph | `evidence/source/contact-burn.md` | Glow falloff is approximate | Move the overlay before the local bloom chain in a future full-stage refactor |
| Fixed origin replaces tracked handshake point | P3 | input binding | `evidence/source/contact-burn.md` | The hole starts from the local room focal point rather than moving with hands | Bind to a room object projection if the About camera composition changes |
| Product generalizes the source's fixed 9/16 scale to live height/width | P3 | responsive coordinates | mobile QA | Desktop is source-identical; portrait remains physically round instead of becoming a vertical slit | Keep unless the product adopts a fixed 16:9 render plane |

## Fidelity Tier

`PIPELINE_REPLAY`

## Non-Blocking Assumptions

- The visual target is the burn mechanism, not Shader's handshake or telephone assets.
- Essential Contact text remains semantic DOM and is sequenced after the flash rather than burned as a texture.
