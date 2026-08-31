# Route and DOM structure

## Home

- Fixed viewport; no meaningful document scroll.
- DOM contains the project cards and navigation as real semantic/interactive elements.
- One WebGL canvas paints imagery and text by tracking the DOM rectangles.
- Desktop uses a horizontal infinite carousel; compact/mobile uses a vertical helper.

## Project detail (`/projects/the-lookback` sampled)

- Same application-level canvas remains active.
- The project hero and media form a vertical virtual column.
- Desktop/fine-pointer can loop; touch is finite.
- Three Mux high-resolution MP4 requests were observed on the sampled route.
- Horizontal swipe and keyboard arrows move between adjacent projects.

## Full index (`/full/`)

- Fixed index cloud rather than a scroll document.
- Project names are rendered through the WebGL text path.
- Entry cadence: text stagger `0.03s` capped at `0.55s`; dots begin around `0.4s + stagger` and use a `0.5s back.out(1.7)` pop.
- Hover binds a cursor-follow preview rail. Source parameters include swap `.35`, reveal `.6`, follow `10`, tilt `.35`, velocity normalization `25`, twirl `.35`, and morph `9`.

## Cross-route identity

The same `data-id` on home and detail pages denotes the same render plane. The registry attaches, sweeps and retires owners during navigation. A queued route push is guarded by a minimum interval of about 400ms, preventing rapid navigation requests from stacking incompatible flights.
