# LAB / Contact / room — 2026-09-09

Author selected the **archive drawer + spiral address book** direction for reel 04/06.
Both are renderer-free live Three.js scenes (`reelStillLife.ts`), rendered into the
existing stage's targets only within one film frame. No extra stage context. Language
changes rebuild their printed textures. The film curve and scrolling constants stay as-is.

LAB now contains exactly three author-selected projects. Source material read:

- 余钟: `/Users/liujialuo/UnrealEngine/Projects/YuZhong/Docs/CURRENT_PLAYTEST.md`.
  Current single-enemy action RPG slice, not a finished campaign. Image:
  `Saved/Screenshots/MacEditor/HighresScreenshot00014.png`.
- 余响: `/Users/liujialuo/Documents/New project/wasteland-echo/README.md`.
  Playable third-person exploration prologue. Image: `artifacts/pass-15/desktop-active-play.png`.
- 来生酒吧: `/Users/liujialuo/Documents/blender/afterlife/README.md`.
  Reference-led Blender environment reconstruction; some local surfaces use reference UVs.
  Image: `reference_match/renders/afterlife_reference_match_2560.png`.

Images resized to 1440px WebP in `public/work/lab/`. No fabricated footage, no remote
project deployment links. The new bilingual summaries remain COPY-REVIEW drafts.

Contact's yellow/brown vignette and warm header wash were removed. Both paper surfaces
now start their 44px rules at the top. Pointer distortion of the rules is disabled so ink
stays attached. `useNotebookBaselines.ts` measures actual loaded-font baselines relative
to the fixed paper (not the much taller scroll root), including wrapping and language changes.

RedSkill CLI/store installed from the author's specified install.md, and `holo-card@1.0.1`
installed in `skills/holo-card/`, also registered under `~/.codex/skills/holo-card/`. Existing artwork is preserved. Its view-space parallax,
bounded view-normal division, pink/yellow/blue foil, noise distortion and sparse view-driven
sparkles were adapted into `badge/HoloBack.tsx`; this is an integration of the skill's shader
technique into the existing badge, not a new standalone generated card. Physics, keyboard
flip and pasted stickers remain in the existing DOM rig. The small WebGL canvas runs only
while the reverse is active; it paints on pointer/resize events and falls back to the original
image on WebGL failure. No new image generation or paid services.

Room replacements are Blender-authored: `scripts/blender/build_room_props.py` writes
`assets/3d/about-room-props.blend` (editable local source) and
`public/models/about-room-props.glb` (394,328 bytes, 93,472 triangles, 3 meshes, 11 materials).
Capture coordinates set the scale and placement. The existing laptop screen and its film
handoff are preserved. Camera, film canisters, paper notebook, pen, old MacBook casing,
old basketball mesh and the tall lamp stand/head beside it are retired. The glove contains
a separately stitched baseball; basketball channels are geometry; keyboard, trackpad,
speaker perforations and lid bevels are authored in Blender. `roomSurface.ts` supplies
runtime shading consistently with the room's existing bake (no extra room lights).
`roomPropShadows.ts` resamples clean points on the same floor/table planes to retire old
baked marks and adds the glove's contact shadow.

Validation: TypeScript, exported model geometry/material budget check, desktop browser
inspection of room, Contact, film frames and LAB; responsive Contact at 390×844; bilingual
copy and badge keyboard flip. No production deployment or git commit.

---

## 2026-09-16 — 玄照 / Xuanzhao added, and reel 04 became footage

LAB now contains four author-selected projects. Source material read for the new one, all
of it the author's own working documents:

- 玄照: `/Users/liujialuo/Documents/blender/nano_astra_workflow/`.
  `output/CURRENT_STAGE.md` (2026-09-12), `ue5/XuanzhaoTest/CHARACTER_STATUS.md`
  (2026-09-11) and `realtime_v001/FACE_BRIDGE.md` are what the entry is written from.
  UE-side locomotion sits in a second project, Epic's Game Animation Sample, under
  `Content/XuanzhaoExtract` (run start/loop/stop sets) and `Content/XuanzhaoDodgeStudy`
  (jump and land sets); the author confirmed the build is already playtested, and
  `CHARACTER_STATUS.md` records the PIE evidence the entry quotes — 555.66 cm/s running,
  89.79 cm jumping, combo and charged montages, 115 bones, 25 morph targets.

Claims deliberately **not** made, because the author's own documents decline them: the
realtime face session is not described as a driven live character (`CURRENT_STAGE.md`:
不得称为实时角色已经驱动成功), the look is named as native DefaultLit rather than any
game's NPR reproduction, and the skirt and ornaments are stated to have no realtime cloth.

Reel 04's archive-drawer still life was replaced by this project's footage, at the author's
request. Source: a 1280×704 screen recording of `Lvl_Xuanzhao_FaceLiveV005` in UE 5.8.2.
Cropped to `580×435+190+112` — the viewport around the character, which drops the editor
panels and the parked mouse cursor — then encoded to `768×576` (CRF 26, 1.64 MB) and
`512×384` (CRF 29, 690 KB), audio stripped. The source itself is 3.0 MB. Poster is a
1024×768 AVIF from t=8.8 s, chosen for open eyes and a frontal pose. Sprite sheets cover
the first 6 s at 10 fps in five 1920×1080 tiles, matching what frames 01/02 carry.

The thumbnail `public/work/lab/xuanzhao.webp` is a wider 1280×720 crop from the same frame,
with the parked cursor painted out by ffmpeg `delogo`. No footage was fabricated or
regenerated; every frame shipped is from the author's own recording.
