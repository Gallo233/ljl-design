# AetherTwin Studio — what it has that `/work/joi-mobile` does not

Date: 2026-08-30
Source: [joa-chance/aether-twin-studio](https://github.com/joa-chance/aether-twin-studio) — "Real-time
physical-to-digital device twin built with Three.js". MIT for code, CC BY 4.0 for the 3D assets,
© 2026 Joa Chance. 37 files, ~5 MB, TypeScript + Vite, last pushed 2026-08-28.

Read: `src/main.ts`, `src/model.ts`, `src/assetModel.ts`, `src/sync.ts`, both READMEs.

## What it actually is

A workbench, not a portfolio page. A SwiftUI companion app on a real iPhone streams Core Motion
attitude and a ReplayKit screen broadcast over a LAN WebSocket relay; the web app slerps a GLB
iPhone to that attitude and paints the broadcast onto the display mesh. Around that sit studio
controls: light/dark stage themes, seven camera presets, a "director" auto-orbit with a timeline,
part picking, and 2K/4K PNG capture.

## Where we already stand level

Our `createIPhone17ProScene.ts` is not the naive version of this. We already have a PMREM
environment, ACES tone mapping, a real Apple GLTF with a cosmic-orange finish pass, shadow
casting, part naming with an explode rig, and mesh/triangle diagnostics published to the DOM.
Several things that look like gaps are not.

## Five things worth stealing

1. **The screen is alive.** This is the real gap. Ours is
   `new THREE.TextureLoader().load(options.posterUrl)` — one still PNG. Theirs carries a
   three-state screen (`model` / `live` / `freeze`) whose material swaps between the baked GLB
   material and a `MeshBasicMaterial({ map, toneMapped: false })` fed by either a `CanvasTexture`
   (pushed frames) or a `VideoTexture` (a MediaStream). We do not need their relay to use the
   idea: a Joi Mobile screen capture as a `VideoTexture`, started when the aperture takes input,
   turns a product shot into a product demo on the device it is about. `toneMapped: false` is the
   detail that keeps UI colour from being crushed by ACES.

2. **`camera.setViewOffset` for optical centring.** When their side console covers part of the
   canvas they offset the projection by half the panel width instead of moving the camera, so the
   phone sits centred in the *visible* area with no perspective change. Our phone lives inside a
   card with a chrome bar and a gate overlay — the same trick would centre it in the area the
   visitor can actually see.

3. **Calibrated device orientation.** `resetOrientation()` stores `calibrationQ = rawQ.invert()`
   and every later sample is `calibrationQ * rawQ`, so "hold it however you like, tap to zero"
   works without any absolute frame. We cannot ship their LAN relay, but `DeviceOrientationEvent`
   in the visitor's own browser gives the same input for free: on a phone, `/work/joi-mobile`
   could let the device in your hand turn the device on screen.

4. **Camera presets over free orbit.** `views` is a flat record of seven named positions
   (`front`, `rear`, `three`, `left`, `right`, `topview`, `bottom`) plus a timed orbit. A visitor
   who is not a 3D artist gets a good angle in one click instead of tumbling the model into a
   bad one.

5. **`preserveDrawingBuffer: true` plus a capture button.** They re-render at 3840×2160 with
   `setPixelRatio(1)`, `toBlob`, then restore. Self-service press shots from the live scene, which
   is exactly what a design portfolio keeps needing.

## Two patterns worth borrowing regardless of the phone

- **Newest-frame-only decode.** `enqueueFrame` keeps a single pending blob and drops anything
  older, so a decoder stall cannot build a seconds-long backlog. Correct for any streamed texture.
- **Scored screen-mesh detection.** Rather than hardcoding a mesh name, they score every mesh by
  panel-ness (`dims[0] > 6 && dims[1] > 2.5 && dims[2] < 1.2`), darkness, Z position and name
  match, then take the winner. Ours builds its own screen plane so this is not needed today, but
  it is the right shape for surviving a model swap.

## What not to take

- The WebSocket relay, the pairing token flow and the SwiftUI/ReplayKit app. That is a LAN tool
  with a security note telling you not to expose it; none of it belongs on a public site.
- Their lighting rig as-is. Two orbiting point lights plus `RoomEnvironment` is a studio look
  built for a neutral turntable. Ours is tuned to the Living Aperture's palette.
- The assets. The GLB and its textures are CC BY 4.0 © Joa Chance, and we already ship Apple's
  own iPhone 17 Pro model.

## What was taken (2026-08-31)

One of the five. The live screen was built and then removed at the author's call; the
reasoning for that and for the other three is worth keeping.

**Calibrated device orientation — taken and kept.** A `TILT TO TURN` control, offered only
where `DeviceOrientationEvent` exists *and* the pointer is coarse, so it is never a button that
does nothing. The calibration is the source's: the first sample after enabling becomes the zero
and every later one is read against it, which is what makes "hold it however you are already
holding it, then tap" work without an absolute frame to agree on. It drives the same yaw/pitch
targets the drag does rather than a quaternion, so the smoothing, the clamps and RESET VIEW all
keep working; the idle drift stands down while the sensor has the pose.

**The live screen — built, then reverted.** The mechanism worked: two coplanar layers
cross-faded by opacity, a compositor-side blend of two finished textures with no canvas and no
per-frame upload. It was driven by a content argument — the page about Joi Mobile was showing an
iOS home screen with no Joi app on it — so the device woke into the real product capture when
the visitor opened the device gallery.

The author's verdict on seeing it: two screenshots on one phone reads as crude and out of place.
Then, on seeing the single screenshot that was left: no image at all.

That is the right call, and it generalises past this page. A still pasted onto a rendered device
cannot read as a screen, because it is lit differently from everything around it and it holds a
moment that does not belong to the room — the eye reads it as a sticker on an object rather than
as the object's own surface. The 720x1566 product capture made it worse by upscaling 1.7x onto a
1206x2622 panel, but a pixel-perfect still would have had the same problem for the same reason.

There is no display plane at all now. Apple's model already carries its own front glass — a
zero-thickness panel across the whole face — so the plane that stood 0.024 in front of it was
always a second screen over the real one. With a screenshot on it that read as a sticker; with
dark glass on it, it read as a black slab with a lit seam down the side where it parted company
with the body, visible from any angle off-axis. Deleting it is not a compromise, it is the
correct geometry: the device had a screen the whole time.

What it would take to earn a live screen: a portrait capture at the panel's own resolution, and
moving. A moving screen is lit by its own content frame to frame, which is what makes it read as
emitting rather than as printed. Then the two-layer surface is worth rebuilding — about fifteen
lines — and `setScreenStream` is where it plugs in.

**`camera.setViewOffset` — not taken.** It earns its place in the source because a full-height
side console covers roughly a third of the canvas. Our occlusion is two 36px pills in a corner;
offsetting the projection for that would move the phone more than the controls ever hide.

**Camera presets and PNG capture — not taken.** Studio tooling for a workbench. The scene
already has `resetView()`, and a portfolio page has no use for a 4K export button.

**Newest-frame-only decode — not taken.** It exists to survive a stalled network decoder, and
nothing here streams.

## The one-line version

The transferable idea was the live screen, and the transferable lesson is that it needs a source
worth showing: without a native-resolution portrait capture, a surface that can show anything
still only has stills to show.
