# Work Experience — Frozen Visual Baseline

Date: 2026-08-30
Routes: `/work/joi`, `/work/joi-mobile`
Status: visual contract frozen before performance optimization

This document makes the accepted Work experience the comparison target. Optimization may change scheduling, caching, framebuffer sizing and idle behavior. It must not weaken or remove the visible states and interactions below.

## Visual contract

### Composition and pacing

- Browse mode remains a short, sticky three-state narrative: `IDENTITY` at progress `0`, `EXPERIENCE` at `0.5`, and `RELEASE` at `1`.
- Desktop page height remains `4.2` viewports; mobile remains `3.9` viewports unless a later, explicitly approved content change requires otherwise.
- JOI uses the wide conversation aperture; Joi Mobile uses the upright device well.
- The project title, actual product, actions and next-project state remain the only primary content. Cleared long-form copy, screenshot galleries and metric blocks stay cleared.

### Signature material

- Four smooth-union SDF shapes and three explicit capillary bridges remain the topology.
- Cards visibly fuse, stretch, neck, cross zero radius and break instead of cross-fading.
- Pointer proximity creates fast-grab/slow-release deformation and a decaying sticky wake.
- The title uses an `aria-hidden` soften/melt/re-harden visual copy while the semantic heading stays crisp.
- Material stays bright, quiet and translucent with the accepted JOI coral and Joi Mobile frost-violet project accents.
- Route handoffs preserve the reel-frame arrival, Work-to-Work material handoff and perforated-frame return.

### Product interaction

- JOI keeps one iframe session while changing from docked presentation to desktop-pet presentation.
- Explicit interact mode has no timeout. Escape or `RETURN TO PAGE` is the exit.
- The 3D iPhone remains fully visible, rotatable and zoomable in interact mode; browse scrolling does not leak into the device.
- Input ownership, scroll locking, focus restoration, reduced motion and honest fallbacks remain intact.

## Performance baseline observed before optimization

Desktop observation at 1280 × 720, device pixel ratio 2:

- Liquid drawing buffer: approximately `1897 × 1080` (`~2.05M` pixels).
- iPhone drawing buffer: approximately `1411 × 830` (`~1.17M` pixels), even when the phone was visually about `265 × 156` near Identity.
- iPhone scene: `48` meshes, `73,049` triangles, `1536²` shadow map on the full tier.
- The iPhone renderer ran continuously in browse mode.
- A roughly `360px` wheel gesture continued native motion for about `520ms`, then the old fixed snap pulled `360 → 0` by about `1120ms`.
- The visual progress low-pass (`0.17`) trailed native scroll, while the snap used a fixed `720ms` settle.
- Each Work animation frame wrote inherited CSS variables and accessibility attributes before the liquid renderer read five `getBoundingClientRect()` values, creating a forced-style/layout opportunity.

These measurements explain the accepted look feeling heavy; they are not visual features to preserve.

## Source fingerprints at freeze time

The working tree already contained the accepted Work implementation and related user changes. These SHA-256 fingerprints identify the exact visual baseline without implying that the files were committed together:

```text
59dea3ebc2c3398720531e7abc0ac1851388d355a416428711165e28350989fb  components/work-experience/WorkExperienceShell.tsx
d0544c46700023159530aa1674b0dfa06ba4abff8fd1979862e19bdde240ff6a  components/work-experience/work-experience.module.css
f97a1e18a3b4902f488ad6ba319a38b00432682973dc6cbff3e681ed1088df99  components/work-experience/liquidStage.ts
4a18f1224f59ca804c0df02f763be532874f63f21694c29008c6b4f154847171  components/work-experience/routeHandoff.ts
7804cb0d7a0b9da3c47d0af99464a2cf5757fb5b4f11d6313b5f8336791ca292  components/joi-mobile-iphone/JoiMobileIPhoneShowcase.tsx
f60bc654a06203a81885c35092bab8a01fee7ff01a1215680475d0525dbce908  components/joi-mobile-iphone/createIPhone17ProScene.ts
a3fea9ec6a61c593a1de45a932025d0c5ec0cfa51d4a65232ceafda11ebcc193  components/JoiWebEmbed.tsx
3ca67a0792a3aab7a30ab020ede75bc05a624146c4e4a12344cb10c993b32276  public/joi-shell/joi-embed.css
f35d5ed5eae80433ee01c275cce4288b9cf137221d35ae36af7e4bd07ae889d4  public/joi-shell/joi-embed.js
```

## Optimized fingerprints

The following source state passed the no-regression checks while retaining the frozen contract above:

```text
ee737d40f7d4f7a263362a34e4e2b170f73e41fa25b8f6ac2af9743e89faaaee  components/work-experience/WorkExperienceShell.tsx
8bb168bf65fc802504efe2b5a585e911f417683ef5c281df89307a9c57a70946  components/work-experience/work-experience.module.css
dee2858d63b095ca65697f268841badd356db32094fdb7e3d4824a8e89b5a833  components/work-experience/liquidStage.ts
4a18f1224f59ca804c0df02f763be532874f63f21694c29008c6b4f154847171  components/work-experience/routeHandoff.ts
7804cb0d7a0b9da3c47d0af99464a2cf5757fb5b4f11d6313b5f8336791ca292  components/joi-mobile-iphone/JoiMobileIPhoneShowcase.tsx
344944cd18505d8899849f27160f99f49bb75d9bae6f77ec26787bd93f85a53e  components/joi-mobile-iphone/createIPhone17ProScene.ts
```

Compared with the frozen baseline, the route handoff and Joi Mobile React wrapper retain identical hashes where their contract did not need to change. The driver, Work transition CSS, liquid scheduling and iPhone renderer hashes changed for the performance work described in the implementation QA.

## No-regression checks

- Compare exact anchor states and intermediate bridge breakage on desktop and mobile.
- Confirm scroll follows the gesture direction and never snaps back after a decisive forward wheel gesture.
- Confirm JOI iframe identity survives docked → pet → docked.
- Confirm the iPhone’s framing, material and silhouette are unchanged at equivalent progress.
- Confirm pointer wake, title melt, route handoffs and focus behavior still work.
- Confirm the old case-study prose and screenshots have not returned.
- Confirm About Me and Contact are visually unchanged.
