# Gemini Front-End Context

You are helping refine the front end for **Joi Doorway**, an interactive personal-site entrance for the All Joi ecosystem.

## Product Intent

This is not a normal portfolio landing page. It is a ritualized entrance with game-like timing:

1. The visitor begins on an iPhone home screen and taps the Joi Map app icon.
2. Joi Map opens into its main interface.
3. Three knocks play, then the camera turns toward the door and pushes into an interactive peephole.
4. The visitor swipes or drags upward to open the peephole.
5. A generated first-person video shows Joi Map near the door and turns toward the handle.
6. The last frame freezes seamlessly on the door handle.
7. A transparent sprite cut from the final frame appears exactly over the static handle.
8. The visitor presses the handle and drags downward; the original video handle pixels rotate.
9. The door transition opens into the All Joi studio homepage.

The emotional goal is: **Joi is not just a product page; she feels like a real partner arriving at the edge of the user's world.**

## Hard Character Constraints

- Joi App and Joi Map are the same character in different outfits/contexts.
- Both versions have honey-amber eyes.
- Joi App has no side braid.
- Joi Map has the side braid with coral ribbon. This is a Map-only identity marker.
- Keep the Japanese anime style, but avoid sci-fi, robot, cyberpunk, excessive gloss, and spaceship/dashboard aesthetics.
- Avoid making Joi overly childish or sexualized.
- Do not add subtitles/caption overlays inside the generated video.
- Do not add long in-app explanations of how the interface works.

## Current Implementation

The site has been refactored into a small Next.js App Router project because the reference site `haoqi.design` is also Next.js. Keep this structure unless there is a strong reason to change it.

Next.js shell:

- `app/layout.tsx`
- `app/page.tsx`
- `app/[slug]/page.tsx`
- `components/projectData.ts`
- `components/legacyMarkup.ts`
- `public/script.js`
- `public/assets/`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `next.config.mjs`
- `tsconfig.json`

Preserved source/static files:

- `index.html`
- `styles.css`
- `script.js`
- `assets/iphone-home-joi-map.png`
- `assets/iphone-home-joi-map@2x.png`
- `assets/joi-map-main-ui.png`
- `assets/joi-map-main-ui@2x.png`
- `assets/doorway-bg.png`
- `assets/doorway-qte-intro.mp4`
- `assets/door-handle-final-frame.png`
- `assets/door-handle-clean-frame.png`
- `assets/door-handle-lever-sprite.png`
- `assets/three.module.js`
- `assets/stickers/joi-cursor-sticker.png`
- `assets/stickers/joi-star-sticker.png`
- `assets/stickers/joi-pin-sticker.png`
- `assets/joi-app-v3.png`
- `assets/joi-map-v3.png`
- `assets/joi-peephole-closeup.png`
- `design-qa.md`
- `docs/research/haoqi.design/`
- `docs/design-references/`

Legacy/experimental assets still present:

- `assets/intro-phone.mp4`
- `assets/peephole-joi.mp4`
- `joi-doorway-video/`

## Interaction Model

The active intro state machine is in `script.js`:

```text
phoneHome -> mapOpening -> mapHome -> knocking -> doorTurn -> peepholeApproach -> peepholeLocked -> peepholeDragging -> peepholeOpening -> videoIntro -> qteLocked -> qteDragging -> doorOpen -> home
```

Important behavior:

- `?skipIntro=1` should enter the homepage directly.
- The first interaction is clicking/tapping the Joi Map app icon inside the iPhone visual.
- The two iPhone screenshots are temporary design placeholders. Later, the app icon and main UI can be replaced without changing the state machine.
- The `@2x` screenshot files are deterministic upscales of the same source screenshots for sharper display; they are not generative redesigns.
- Joi Map opens with an iOS-style icon-to-app expansion mask, not a generic fade or visible QTE ring.
- The screenshot's simulator toolbar is intentionally cropped away in CSS; do not re-expose the "iPhone 17 Pro / iOS 26.5" simulator chrome.
- The three knocks are synthesized with Web Audio after the app-icon user gesture.
- The current intro timing is intentionally compact: roughly 4.3 seconds from app tap to peephole lock in normal motion.
- The door approach should feel like a camera turn and push toward the peephole.
- The peephole interaction is required: upward drag/touch swipe or mouse-wheel up opens it. Its material should stay richer than a flat brown circle, using layered metal, glass, highlight, and shutter cues.
- The video starts only after the peephole reaches `peepholeOpening` and hands off to `videoIntro`.
- When the video ends, `door-handle-final-frame.png` overlays it immediately.
- The visible freeze state uses `door-handle-clean-frame.png` plus `door-handle-lever-sprite.png`.
- The transparent handle hotspot and pixel sprite layer should align with the actual handle in the final frame.
- Dragging downward should visibly rotate the source-frame handle pixels before entry, especially on mobile.
- Avoid adding visible instruction copy; use visual affordances instead.

## Homepage Direction

The current site is an original light All Joi ecosystem studio inspired by the full interaction grammar of `haoqi.design`:

- fixed HUD navigation
- pointer coordinate metadata
- GMT+8 time display
- pale full-screen grid/crosshair field
- no standalone decorative "all joi" 3D wordmark on the homepage first screen until the identity direction is redesigned
- floating glossy sticker bitmap assets, foreground impact typography, real project thumbnails, and sticky scroll beats
- a source-style long work grid
- a dark speed-line interlude translated into "Build with a human touch"
- a principle fragment section with orbit marks
- internal project detail pages only at `/joi` and `/joi-map`
- large editorial typography
- project cards only for Joi and Joi Map that update Joi dialogue and shader accent state

Do not switch the homepage to the reference site's dark blue palette unless explicitly requested. The current target is a light All Joi interpretation of the reference site's mechanics.

## Front-End Improvement Priorities

Good areas to improve:

- Refine the iPhone-to-door camera turn so it feels continuous with the peephole video.
- Refine the peephole opening material/lighting while preserving the upward gesture gate and richer lens/ring texture.
- Replace the temporary Joi Map app icon and main UI screenshots with final approved art.
- Refine the video-to-pixel-handle seam if a better final-frame asset is generated.
- Tune the pixel sprite pivot, cleanup mask, and hotspot position for more device sizes.
- Make the push-door transition feel more physical.
- Improve homepage scroll choreography and shader response.
- Refine the Joi and Joi Map project detail routes with richer All Joi-specific images/case-study copy.
- Replace placeholder links with real GitHub/Demo/Essay URLs.
- Optimize video loading and poster strategy.
- Use `design-qa.md` before major visual changes so the light All Joi interpretation does not drift back into a generic portfolio or a dark clone.

Avoid:

- Undoing the Next.js refactor or splitting the experience into unrelated pages.
- Removing the phone-to-Joi-Map-to-door intro; it is now the primary flow.
- Removing or bypassing the interactive peephole gate.
- Replacing the source-frame pixel handle with a mismatched 3D prop or decorative QTE outline.
- Adding new product claims or fake links.
- Turning the site into a generic SaaS landing page.
- Putting the main experience inside decorative card containers.
- Adding subtitles to the video.

## Validation Commands

Run from the repository root:

```bash
node --check script.js
pnpm exec next build
```

Optional if Remotion sources change:

```bash
cd joi-doorway-video
npm run lint
```
