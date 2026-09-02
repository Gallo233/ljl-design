# Shader.se Contact burn — target-bound source facts

- Target: `https://www.shader.se/#/contact`
- Current chunk: `https://www.shader.se/_next/static/chunks/0-08uz4-c8z20.js`
- Target component: minified function `OU`, logged internally as `HandShake`.
- Video evidence: `../video/burn-sequence.png`, extracted at 10 fps from the user-supplied recording.

## SOURCE — timing and wiring

- Burn starts at `contactRange.end - 1.6` and the source threshold reaches its end at `contactRange.end + 0.5`.
- Threshold progress uses quintic smootherstep `x³(x(6x-15)+10)`.
- Flash recovery begins `0.04` screens after the burn starts and uses cubic smoothstep over roughly the first screen.
- Old handshake remains outside the burn. A premultiplied overlay contains either the new Contact texture or the hot edge.
- The origin is `sparklePosition`, read from frame-indexed tracking data embedded beside the handshake sprite-sheet playback; it is not a pointer coordinate.

## SOURCE — threshold graph

The TSL graph translates to the following structure:

```text
relative = (screenUV - sparklePosition) * vec2(1.0, 0.5625)
angle = atan(relative.y, relative.x)
wobble = (
  sin(angle*3  + time*1.5)*1.5 +
  sin(angle*7  + time*2.5) +
  sin(angle*13 + time*0.8)*0.5
) * 0.08 * transitionProgress
distance = (length(relative) + wobble) * 1.3

fbm4(p): amplitude starts 0.4, frequency multiplies by 2, amplitude by 0.5
detail =
  fbm(uv*12  + time*0.4)*0.5 +
  fbm(uv*32  + time*0.4)*1.0 +
  fbm(uv*160 + time*0.2)*0.5 +
  fbm(uv*240 + time*0.1)*0.2 +
  fbm(uv*320 + time*0.1)*0.5

field = progress*1.3 - distance + detail*0.7*progress
inside = step(0.0, field)
edge = smoothstep(-progress*0.15, 0.0, field) * (1.0-inside)
```

Inside the hole, the Contact texture recovers from `vec3(2.0)` to its real color using `flashFadeProgress`. The edge color is `vec3(1.0, 0.95, 0.9) * edge * 1.5` with alpha `edge`.

## PARTIAL / GUESS — local substitutions

- `PARTIAL`: the source hot edge is subsequently processed by the site's shared bloom graph. The local Contact overlay is drawn after the existing CRT chain, so an outer warm band is added inside the burn shader instead.
- `GUESS`: the project creates a seeded 256×256 repeat noise texture rather than copying Shader's public `rgba_noise.png`; all sampling scales and FBM wiring remain SOURCE.
- `GUESS`: the local origin is fixed near the About room's focal area because the room has no handshake hand-tracking dataset.
