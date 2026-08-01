# shader.se asset index (SOURCE — network panel, first load)

113 resources, **5.2 MB** transferred before the boot screen releases.

## 3D props (GLB)

`/models/` — `deskbox.glb`, `shredder.glb`, `tie.glb`, `phones.glb`, `trophy2.glb`, `bank.glb` (377 KB)

## Textures

- `/textures/rgba_noise.png` — the shader noise source
- `/textures/bank_wall.webp`, `bank_scratches.webp`, `bank_metal.webp` — PBR set for the bank scene
- `/textures/dashed_border_horizontal_dark.png`, `dashed_border_vertical_dark.png`, `dashed_frame.svg`
- `/textures/group_3x2.webp`, `jake_computer.webp`, `jacob_presenting.webp`, `simon_presenting.webp`,
  `simon_calling.webp`, `filip_footer_5.webp`, `computer.webp`, `scissors.png`, `trophy2.webp`,
  `customers_logo_cloud.png`, `footer_certificate.png`, `copyright_footer.png`,
  `accessibility_statement.webp`
- `/textures/icons/` — `pointing_hand_light.svg`, `arrow_right_white.svg`, `spinner.png`,
  `old_phone.svg`, `old_phone_dark.svg`, `menu.svg`, `menu_dark.svg`, `close_icon.svg`

Note the `_dark` variants: the whole UI ships in two themes and is cross-faded in the shader by
`uiModeTransition`.

## Fonts — bitmap/MSDF atlases, not webfonts

```
/fonts/stix_regular.json + stix_regular.png
/fonts/stix_medium.json  + stix_medium.png
/fonts/stix_bold.json    + stix_bold.png
```

`.json` + `.png` pairs are glyph-metric + atlas files. All page typography is drawn as textured
geometry inside the canvas, which is what lets it go through the lens distortion and grain.

## Project stills — Mux

```
/api/mux-image/<playback_id>/w800-h600-fpreserve-t0
```

11 requests. Same-origin proxy over Mux, `fitMode: "preserve"`, `time: 0` (poster frame),
**800 × 600**. Fallback is `/textures/thumb_fallback.png`.

## Video — prebaked AVIF sprite sheets

```
/videos/prebaked/handshake_avif/handshake.manifest.json
/videos/prebaked/handshake_avif/handshake_sheet_000.avif   135 KB
/videos/prebaked/handshake_avif/handshake_sheet_001.avif   402 KB
/videos/prebaked/handshake_avif/handshake_sheet_002.avif
```

Video frames are baked into AVIF sheets plus a manifest rather than played from a `<video>`.
This makes playback scrub-accurate against scroll and avoids codec/autoplay dependencies inside
the render loop.

Detached `<video>` elements still exist for the Mux streams (0 attached to the DOM, 36 media
entries in the resource timeline). Console shows a `Slave video play failed on sync` warning
pattern, i.e. a master/slave video sync system. In the Claude Code in-app browser this is what
stalls the boot preloader at roughly 70–80%.
