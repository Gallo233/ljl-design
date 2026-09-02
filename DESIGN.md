---
name: Gallo Living Signal
description: A CRT portfolio that opens real projects through route-specific Nordic liquid glass.
colors:
  lab-smoke: "#17201f"
  joi-ice: "#d6e1e1"
  joi-ice-edge: "#6f979d"
  joi-paper: "#eef2f1"
  mobile-taro: "#4b4356"
  mobile-lilac: "#bba9c9"
  mobile-paper: "#eee9f0"
  game-sky: "#306c8a"
  game-air: "#9ed4ea"
  game-paper: "#e7f0f4"
  archive-oak: "#a28b70"
  glass-highlight: "#29312f"
  joi-surface: "#dfe5e1"
  joi-surface-deep: "#d1dbd6"
  reel-cream: "#fff6e8"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(3.625rem, 9vw, 9.75rem)"
    fontWeight: 400
    lineHeight: 0.82
    letterSpacing: "-0.055em"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "clamp(0.8125rem, 1.2vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "clamp(0.5625rem, 0.72vw, 0.6875rem)"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.15em"
rounded:
  detail: "5px"
  media: "12px"
  surface-sm: "14px"
  surface-compact: "24px"
  surface-md: "26px"
  surface-transition: "30px"
  surface-signal: "32px"
  surface-lg: "42px"
  surface-fluid: "clamp(24px, 3vw, 42px)"
  control-pill: "999px"
spacing:
  compact: "8px"
  related: "16px"
  surface: "24px"
  section: "44px"
components:
  aperture-surface:
    backgroundColor: "route-specific glass base"
    textColor: "adaptive light or dark foreground"
    rounded: "{rounded.surface-lg}"
    padding: "{spacing.surface}"
  action-pill:
    backgroundColor: "transparent"
    textColor: "inherit"
    rounded: "{rounded.control-pill}"
    padding: "8px 14px"
  signal-chip:
    backgroundColor: "transparent"
    textColor: "inherit"
    rounded: "{rounded.control-pill}"
    padding: "5px 10px"
---

# Design System: Gallo Living Signal

## Overview

**Creative North Star: "The Living Signal"**

Gallo has two deliberately connected worlds. The homepage, reel, About and Contact live inside an old CRT machine; project experiences emerge onto cool limestone paper while carrying a responsive signal medium out of that machine. The contrast is part of the identity, not a mismatch to be normalized.

Living Aperture is the reusable signature outside the CRT. It is a real interface material: route-colored Nordic glass surfaces fuse, stretch, form capillary bridges and break in response to scroll, drag, pointer proximity and product state. Directional edge light, restrained translucency and a quiet paper reflection give the medium optical depth without an expensive backdrop pass. The real product always stays above and independent of the effect so an iframe, canvas, 3D model or semantic document remains truthful and operable.

**Key Characteristics:**

- Quiet pale grounds carrying four distinct glass identities: ice white, taro violet, sky blue and Nordic smoke.
- Editorial display type paired with restrained body copy and operational mono labels.
- One real product or research object leads each destination.
- Motion communicates ownership, connection, release and state rather than decorating every element.
- CRT closing panels retain their own denser world; Contact releases it onto plain ruled paper rather than another dark screen.

## Colors

The neutral field is cool paper. Each destination owns a distinct glass body and one related edge-light accent.

### Primary

- **Joi Ice:** Luminous ice-white glass with a blue-grey refractive edge and dark typography.
- **Mobile Taro:** Clouded taro-violet glass with a pale lilac edge.
- **Game Sky:** Clear sky-blue glass with an airy cyan edge.
- **Lab Smoke:** The retained near-black Nordic smoked glass with mineral-oak signal details.

### Secondary

- **Joi Ice Edge:** A desaturated glacial blue for Joi Web connectivity and focus.
- **Companion Lilac:** A cloudy lilac for Joi Mobile and device-well state.
- **Archive Oak:** A quiet mineral brown for Lab status and learning arrows.
- **Pocket Air:** A pale cyan for Game Center controls and machine state.

### Neutral

- **Ice Paper:** Joi Web's brightest ground.
- **Taro Paper:** Joi Mobile's cool violet-tinted ground.
- **Sky Paper:** Game Center's blue-tinted ground.
- **Nordic Limestone:** Lab's retained neutral ground.

### Named Rules

**The One Signal Rule.** A destination uses one glass family at a time; its body, edge, focus and selection tones are derived from that family.

**The Truthful State Rule.** Offline, retired, killed and loading states name themselves directly; color never pretends a product is available.

**The Quiet Ending Rule.** Contact is the release after the reel and the room, not another index. One invitation, one direct address and the existing lanyard badge own the frame. About is burned through by a scroll-driven noisy aperture: the old room remains outside, an overexposed Contact field appears inside, and its white-hot edge recovers before the semantic invitation enters. The stock underneath is neutral — no wash of colour over it in either direction, warm or cool — so the only colour on the page is the blue-grey of the ruling and the ink. The sheet is ruled, not gridded, and a spiral binding runs down the left margin the copy starts after; the ruling, the coil pitch and that margin all read one set of variables so holes never drift across lines. The transition follows shader.se's recovered threshold graph and timing while keeping every heading, address, link and focus surface out of WebGL. Once settled, only a moving fine pointer may refract the ruling; at rest it is flat. Contact's invitation uses the rounder body face while machine labels retain mono. Reduced motion, rendering failure and context loss expose the complete semantic page over its static CSS field.

## Typography

**Display Font:** Instrument Serif (with Georgia fallback)
**Body Font:** DM Sans (with system sans fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** Display type is large, editorial and slightly fragile against the engineered mono voice. Body text is quiet and practical, leaving the product and material transition as the visual proof.

### Hierarchy

- **Display** (400, fluid 58–156px, 0.78–0.88 line-height): project identities and world titles.
- **Headline** (400, fluid 34–78px, about 0.9 line-height): next destinations and open-file guidance.
- **Title** (400, fluid 20–38px): archive rows and operational state names.
- **Body** (400, fluid 13–19px, 1.45–1.62 line-height): short positioning and dossier copy, generally no wider than 58ch.
- **Label** (500, 9–11px, 0.14–0.18em tracking): navigation, state, input ownership, indices and machine metadata.

### Named Rules

**The Clear Text Rule.** Semantic headings and controls remain crisp DOM text. Melting, blur and signal softening belong only to `aria-hidden` visual copies.

## Layout

The shared outer grammar is a bright full-bleed field with a fixed metadata/navigation layer and a small number of large, overlapping living surfaces. Surfaces are deliberately asymmetrical and use viewport-aware `clamp()` sizing rather than a repeated card grid. Negative spacing may bring surfaces close enough to fuse, but interactive controls cannot be covered by a higher-z decorative surface.

Desktop project experiences may use a sticky short-scroll stage or a compact operational document. At 700–800px breakpoints, surfaces become nearly full width, overlap is reduced, secondary metadata yields and the real object receives the available height. Game Center landscape is a special operational mode: chrome and liquid effects step out so the handheld owns the complete viewport.

## Elevation & Depth

Depth is hybrid. The shader supplies topology, asymmetric rim light, restrained transmission and material continuity; DOM fallbacks use a directional surface gradient plus a soft downward ambient shadow until the first GPU draw. Shadows confirm that a surface is floating over paper and never substitute for structure.

### Shadow Vocabulary

- **Living surface lift** (`0 28px 78px rgba(23, 32, 31, 0.13–0.16)`): only on fallback or non-shader large surfaces.
- **Floating preview lift** (`0 18px 44px -18px rgba(25, 23, 20, 0.35)`): pointer-following Lab evidence preview.

### Named Rules

**The Shader Owns the Surface Rule.** Once a liquid renderer has completed a real frame, matching DOM fills and shadows become transparent; never stack CSS backdrop glass over the aperture.

## Shapes

Primary surfaces use responsive 20–42px corners. Inner product wells use 13–27px corners. Small statuses and controls use true pills. Living shapes connect through explicit swept-box bridges whose neck can pass below zero and break; ordinary rounded rectangles must not imitate that transition with opacity alone.

## Components

### Buttons

- **Shape:** Compact pills for product actions; text-only controls inside identity surfaces.
- **Primary:** Light text on graphite or transparent dark wells with a project accent for the directional detail.
- **Hover / Focus:** Fill inversion or a one-axis transform; visible focus is never removed.
- **Disabled:** Input ownership is expressed with `inert`, `aria-hidden` and disabled state, not only opacity.

### Chips

- **Style:** Mono labels with a 1px tinted border; selected Game cartridges add a low-opacity accent fill.
- **State:** Status text remains literal (`ONGOING`, `RETIRED`, `KILLED`, loading and input ownership).

### Cards / Containers

- **Corner Style:** Responsive large radii, normally 24–42px.
- **Background:** Directional route-colored fallback, transparent after the shader is ready.
- **Shadow Strategy:** Ambient lift only before or outside the shader.
- **Border:** Internal dossier and control divisions use low-opacity white lines; large living surfaces do not combine border and shadow.
- **Internal Padding:** Usually 24–60px, reduced to 16–28px on phones.

### Navigation

Navigation is fixed, 10px mono and high-tracking. Difference blending lets the same white voice cross paper and graphite. Hover/focus draws a 1px underline from the direction of travel.

### Living Aperture

Four DOM-aligned SDF shapes and three capillary links form the shared implementation vocabulary. The material can respond to scroll progress, product phase or file disclosure, but it never consumes pointer input. Every page keeps a solid CSS fallback and a reduced-motion document layout.

## Do's and Don'ts

### Do:

- **Do** let one real experience, device or body of research dominate the destination.
- **Do** derive liquid geometry from the visible DOM so fallback and enhanced layouts share one structure.
- **Do** cap render resolution to actual screen coverage and stop hidden or offscreen loops.
- **Do** preserve project-specific composition inside the shared material language.
- **Do** keep About and Contact in the CRT closing-panel world unless a future brief explicitly reopens them.

### Don't:

- **Don't** flatten an iframe, live canvas or interactive DOM screen into a decorative WebGL texture.
- **Don't** restore cleared case-study prose, screenshots or metrics as placeholders.
- **Don't** add independent liquid canvases to every element; one shared field owns a surface family.
- **Don't** add particle fog or a decorative grid unless the product surface itself is an operational workspace that requires it.
- **Don't** hide essential content behind shader readiness, entrance animation or remote service availability.
