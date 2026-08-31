# Mechanism map

## SOURCE: field and topology

- `planeShaders.js:154–157`: `sdRoundBox` defines every card.
- `planeShaders.js:167–190`: `sdBridge` is an oriented swept box with end/mid radii and world-Y sag. It is deliberately not a capsule.
- `planeShaders.js:213–218`: polynomial `smin` performs the liquid union.
- `planeShaders.js:311–331`: bridges enter the same field as cards; a negative radius is legal and removes the bridge beyond antialiasing range.
- `planeShaders.js:339–342`: pointer wake is `sin(distance * frequency - time * speed) * amplitude * exp(-distance / reach)`.

## SOURCE: input and temporal behaviour

- `params.js`: wheel gain `0.0022`, damping `0.94` per 60 fps frame, speed cap `12`, snap threshold `1 rad/s`, snap run-in `0.8s`.
- `Carousel.jsx:1189–1246`: inertia is left untouched until nearly spent; the snap target is predicted from remaining coast and approaches without overshoot.
- `params.js`: cursor melt `34px` over `260px`; pull `26px`; swell `0.09`; acquire `0.14`, release `0.06`; wake amplitude `4px`.
- `Carousel.jsx:679–746`: visible lean/swell uses fast attack and slow release.
- `Carousel.jsx:892–925`: bridge separation is measured from rest centres and birth scales, not hover-shifted geometry.

## SOURCE: bridge breakup

At separation `v`:

```
w = max(pow(1 - v, 0.4), hoverWeb)
rEnd = edgeHalf * w - 2.9
rMid = rEnd * (1 - (1 - 0.35) * smoothstep(0, 0.7, v))
sag = 6 * scale * pow(v, 1.5)
```

Driving `rEnd` below zero is essential: clamping to zero leaves an unstable half-covered hairline.

## SOURCE: text morph

Two changing DOM copies cross through blur and a hard alpha threshold. A third unchanged copy stays outside the filter so held glyphs do not thicken. Production must retain a clear semantic DOM copy at all times.

## PROJECT: ljl.design adaptation

- Replace the 18-card ring with three states: identity, experience, release.
- Vertical native scroll and blank-stage horizontal drag drive one page progress.
- The same field sits behind DOM/iframe/3D content; it does not texture or rasterize accessible text.
- JOI uses a horizontal aperture; JOI Mobile uses a vertical device well.
- ICE ASCII particles remain deferred until the core experience passes runtime QA.
