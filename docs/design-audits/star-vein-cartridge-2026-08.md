# Star Vein — a fifth cartridge in the Game Center

Date: 2026-08-31
Route: `/play/night-tide` (unchanged — the URL is linked from the reel and from outside)
Source project: `~/Documents/godot/star_vein` (Godot 4.7.1, 2D pixel sandbox survival)

## The shelf is no longer "Night Tide plus three canvas games"

Night Tide used to be special-cased throughout `GameHandheld.tsx`: a module-level
`GAME_BUILD_URL`, a module-level `BUTTON_TO_GODOT` table, `isNightTide` branches in `press`,
`release`, the canvas-game effect and the render. Adding a second WebAssembly build to that shape
would have meant a second set of branches.

Instead, `games/index.ts` now exports a `GodotGame` type and a `godotGames` list. Each build
carries its own `build` path, its own `loading` label and its own `buttons` map; the shell asks
which Godot game is active and reads that game's table. `shelf` is `[...godotGames,
...arcadeGames]`, and the 3D rack was already generic over cartridge count (`cartridges.map`, and
camera framing derived from `cartridges.length`), so it needed only a fifth accent — `amethyst`
`#b6a2cf`. The Game Center header counts the shelf rather than saying "4 CARTRIDGES".

Night Tide's data is unchanged, including its `?v=embedded-font-2` cache-buster, verified in the
built client bundle.

## `code`, not `key`

Both projects bind `InputEventKey.physical_keycode`, which the web export resolves from
`KeyboardEvent.code`. A mapping with the right `key` and the wrong `code` does nothing at all, so
the tables are written against `code`.

Star Vein's map mirrors `scripts/engine/game_state.gd::_register_actions`:

| Shell button | code | Action |
|---|---|---|
| left / right | `KeyA` / `KeyD` | 移动 |
| up / a | `ArrowUp` / `Space` | 跳跃 |
| b | `KeyF` | 交互 |
| x / y | `KeyE` / `KeyC` | 背包 / 合成 |
| l1–r2 | `Digit1`–`Digit4` | 快捷栏 |
| start | `Escape` | 暂停 |

There is no `down`: the game binds no downward action, and an unmapped button is simply not sent.
Mining and placing are bound to `MOUSE_BUTTON_LEFT` / `MOUSE_BUTTON_RIGHT` in the game, so they
stay on the mouse — the build's canvas is a real element on the console's CSS3D screen and takes
real clicks.

The key mirror (build → console button highlight) now resolves against the *active* cartridge's
table rather than one global one. `KeyE` is Night Tide's 相位斩 and Star Vein's 背包; a shared
table would light the wrong face button for one of them.

## The export

`export_presets.cfg` added to the source project (Web, no threads, no VRAM compression,
`canvas_resize_policy=2`), exporting to `public/games/star-vein/`.

A Godot export ships a stock `index.html` that knows nothing about the portfolio shell. Night
Tide's shell had been hand-edited after export to add the input bridge, which does not survive a
re-export. That patch is now `scripts/godot/patch-web-shell.mjs` — idempotent, re-runnable, and
run after every export. It injects both halves of the bridge: `joi-key` messages from the parent
replayed as `KeyboardEvent`s on the canvas (dispatched *without* focusing it, since `focus()`
blurs the parent and its safety cleanup would release the held key first), and real key events
mirrored back out as `joi-game-key` so the console's buttons keep lighting up after Godot pulls
focus into the iframe.

## The font, which is the part that nearly shipped broken

The build booted first time and was unreadable: every Chinese glyph rendered as tofu. Godot's
built-in theme font has no CJK coverage, and unlike the desktop editor a web export has no system
font to fall back on — so this is a failure that only appears in the browser.

Night Tide solves it with `gui/theme/custom_font`. Copying its font over was not enough: that
517 KB file is a *subset* cut for Night Tide's vocabulary, and **149 characters Star Vein needs
were missing from it** — including 挖掘, 矿, 石, 木材, 星, 魔, 锻, 镐, 冒险.

So the subset was re-cut from Noto Sans SC Regular (SIL OFL, from `notofonts/noto-cjk`) against
Star Vein's own charset, with `tools/build_ui_font.py` committed to the game project so it stays
repeatable when new strings are added.

| | Size | Coverage |
|---|---:|---|
| Full Noto Sans SC Regular | 8,331,336 B | everything |
| Night Tide's subset (rejected) | 517,348 B | 149 of Star Vein's characters missing |
| New subset | 239,152 B | **0 missing** of the 751 CJK characters the project uses |

Verified by parsing the shipped font's `cmap` and diffing it against every character in
`scripts/`, `scenes/`, `data/` and `project.godot`.

## Sizes

`index.wasm` 39,513,091 B (engine, same as Night Tide) · `index.pck` 12,044,108 B ·
`index.js` 279,815 B. Night Tide's pck is 33,186,428 B for comparison.

## Checks

- Assets serve with correct content types, `index.wasm` as `application/wasm`
- The build boots standalone: main menu renders, loading overlay removed, input bridge present
- All CJK renders — 星脉 / 深渊与矿脉 / 继续游戏 / 新的冒险 / 设置 / 致谢 / 退出 / 像素方舟工作室
- Game Center shows `5 CARTRIDGES`, five cards in the 3D rack, and 星脉 in the accessible shelf
- The built client bundle carries the right build path, the `Digit1`–`Digit4` map and the new accent
- `npx tsc --noEmit` and `git diff --check` clean

## Not verified here

The cartridge-insert animation and in-game input through the console's D-pad. The preview browser
in this environment runs occluded — `requestAnimationFrame` does not fire (0 frames in 300 ms) —
and the 3D rack's drag-and-seat sequence needs roughly a second of real frames before it calls
`onInsert`. The build, the bridge, the URL and the button table are each verified independently;
the seat animation between them is not.

---

## Follow-up (2026-08-31): readability and aim

Three problems reported from playing it in the console.

### The HUD was unreadable at console size

Every HUD dimension is written in the 1280x720 design space. The console's screen element is
800x450 CSS px, so `canvas_items` stretch scales the whole design *down* by 0.625 and 12px body
text lands at 7.5px. The same HUD is legible in a desktop window only because there the design is
scaled *up*.

Rather than editing forty literals, the HUD now hangs off a single `Control` root with
`scale = 2.0` and `size = viewport / 2`. Children still anchor against that root's rect, so
centred and bottom-pinned layouts keep working and margins grow with the type. The world and the
menus are untouched — they are not under that root, and their font sizes were already correct.

Two absolutely-positioned panels (inventory, crafting) had their coordinates halved so they stay
where they were on screen instead of drifting to the middle.

Rendered at exactly 800x450, the quest and tutorial lines are now legible.

### The cursor landed a tile above whatever it was over

`window/stretch/aspect` was unset, so it defaulted to `keep` and letterboxed any surface that is
not exactly 16:9 — plainly visible as a black band in a desktop window. Bars move the picture
without moving the pointer.

Set to `expand`, matching what the Night Tide project already does. Verified by rendering at
1000x625 (1.6): the bars are gone and the viewport expands instead.

Ruled out first, by measurement rather than reading: `TileUtils.world_to_tile` and the tilemap
share an origin (cell `(x, y)` renders at `(x, y) * 16`, which is what `tile_to_world_origin`
returns), and the canvas-transform round trip through a known tile is exact — `delta = (0, 0)`,
world → screen → world → tile returns the same tile. The game's own coordinate math was never
the problem.

### There was no way to see what you were pointing at

The crack sprite only appears once mining is actually underway, which requires the block to be
in range *and* the held tool to beat its hardness. Pointing at the wrong tile and holding the
wrong pickaxe therefore look identical: nothing happens.

`scripts/presentation/tile_cursor.gd` outlines the hovered tile whenever the cursor is over the
world — white in range, dim red out of range — drawn through the same `TileUtils` conversion the
mining uses. So it is also the instrument: if the outline and the pointer ever disagree again,
the gap is the bug, in tiles, on screen.

### Checks

- `--smoke` and `--smoke-m1` pass. `--smoke-m2` and `--smoke-m3` fail on two drop-quantity
  assertions — verified identical before and after these changes by stashing them, so they are
  pre-existing and unrelated.
- Rendered at 800x450 (console size) and 1000x625 (letterbox case)
- Re-exported, shell bridge re-applied, cache-buster `?v=ui-scale-1`; the build boots in the
  browser with the bridge present and no bars
