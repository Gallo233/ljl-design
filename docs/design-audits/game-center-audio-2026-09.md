# Game Center — why the builds shipped silent (2026-09-01)

The author reported no sound in the arcade and expected each game to have its own BGM and
effects. Two real bugs and one gap, plus a wrong conclusion of mine along the way, recorded
below because the way it was wrong is instructive.

## What each game actually has

| Game | Audio in the build |
|---|---|
| 贪吃蛇 / 俄罗斯方块 / 吃豆人 | **None.** No audio code and no assets in `app/play/night-tide/games/`. Every `muted` in those files is `PALETTE.muted`, a colour. |
| 夜潮 night-tide | **11 effects, plus procedural music.** The effects are files; the music is generated at runtime by `adaptive_audio_bed.gd` with an `AudioStreamGenerator`, which is why no music file appears in the pack. |
| 星脉 star-vein | **3 BGM loops + 14 effects.** `bgm-surface-loop.ogg`, `bgm-cave-loop.mp3`, `bgm-boss-loop.ogg`, plus dig/jump/hurt/craft/pickup. |

So the canvas three never had sound at all — nothing was lost, it was never built — and both
Godot builds had it and could not be heard.

## A wrong conclusion, and how it was reached

An earlier pass of this note concluded that neither game played any sound, on the evidence
that `strings` over both `.pck` files found zero `AudioStreamPlayer`, `AudioStreamPlayer2D`,
`AudioStreamPlayer3D` or `AudioServer`, while finding `Node2D` and `CharacterBody2D`.

**That was a false negative.** The scripts export as `.gdc` — binary tokens — so identifiers
are tokenised rather than stored as text. The class names that *were* found came from scene
files, whose string tables are plain; both games build their audio players from code, which is
exactly the case the search could not see.

Both games have complete, correct audio systems. `star_vein` has an `AudioManager` autoload —
a ten-voice SFX pool, a BGM player, runtime BGM/SFX buses, context-driven track switching —
with fifteen call sites across mining, combat, crafting and pickups. `ashen_blade` has a
`combat_audio_system.gd` pool plus an `adaptive_audio_bed.gd` that *generates* its music with
an `AudioStreamGenerator`, which is also why no music files appear in its pack.

## The actual cause: Web sample playback

Godot 4.4 introduced sample playback for the Web platform and made it the default there
(`audio/general/default_playback_type.web`). In this 4.7.1 `web_nothreads` export that path
emits nothing.

Instrumented from inside the running game, on the stock shell:

```
[AUDIODIAG after_play:surface] mix_rate=48000 bus_count=3
  Master[0] db=0.00 mute=false   BGM[1] db=-1.94 mute=false   SFX[2] db=0.00 mute=false
  surface_loads=true  jump_loads=true  bgm_playing=true db=-14.00 stream=true
```

Godot believed it was playing: stream loaded, player playing, buses unmuted, mix rate matching
the AudioContext. Meanwhile an AnalyserNode spliced in front of the destination measured
**exactly 0.000000** RMS, sustained, while a plain oscillator on the same context measured
0.105 — so the context, the device and the browser were all fine.

Setting `audio/general/default_playback_type.web=0` in both projects routes audio back through
the mixer and the AudioWorklet. The same measurement then reads 0.0015 → 0.0507, varying:
`star_vein`'s surface loop. Both projects re-exported with the fix.

This also explains Safari showing a tab speaker where Edge did not: Chromium lights that
indicator for audible output, Safari for an active context. Both browsers were in the same
state — a running context carrying silence.

## Why the context also never started

Godot does try. `_godot_audio_resume()` is in the engine bundle and calls `ctx.resume()` off its
own input path, and the synthetic `KeyboardEvent`s the shell dispatches do fire those listeners.

But a script-made event is not user activation, and Chrome will not let a frame that has never
been activated start an AudioContext. The handheld is driven entirely from buttons in the
*parent* page — that is deliberate, the bridge dispatches on the canvas without focusing it so
the parent keeps focus — so nothing ever touches the iframe. `allow="autoplay"` on the frame is
necessary and not sufficient.

The fix forwards the gesture the shell does have. Chrome propagates user activation to
same-origin descendants, so once a real finger has landed on the page the frame is permitted;
it just needs telling to try.

- **Parent** (`GameHandheld.tsx`): `nudgeGodotAudio()` posts `joi-audio-resume`, called on every
  real button press and once when the frame loads — the second because star-vein opens on its
  surface loop and would otherwise stay silent until the first press.
- **Frame** (`patch-web-shell.mjs`): resumes on that message, on any forwarded key, and on any
  trusted input inside the frame.

### Getting at the contexts

`GodotAudio` is a `var` inside the engine bundle and never reaches `window`, so the only way to
hold a context is to be there when it is constructed. The bridge is injected immediately before
`<script src="index.js">`, so it wraps `AudioContext`/`webkitAudioContext` in a subclass that
records every instance. A subclass rather than a wrapping function, so `instanceof` and the
prototype chain stay what the engine expects.

Verified in isolation in a browser: captures every instance, `instanceof` native holds,
`createGain`/`resume` present, constructor options honoured, `resume()` resolves.

## The patch script was appending bridges, not replacing them

Found by causing it. `patch-web-shell.mjs` checked for its own `data-joi-shell-input-bridge`
marker before stripping the previous bridge — and `night-tide/index.html` carried a hand-edited
bridge from before the marker existed. The check found nothing, so re-running the script left
the old block in place and appended a second one: **two `joi-key` listeners, every forwarded
press dispatched to the canvas twice.**

The test is now what the block *does* rather than how it is labelled — any inline `<script>`
handling `joi-key` is a bridge and gets replaced — and the script reports how many it replaced.
Confirmed idempotent: three consecutive runs leave one bridge and one handler.

Both titles are untouched. An earlier pass of this fix passed a title argument and overwrote
`Zero Hour: Night Tide / 零刻：夜潮` with a worse one; the files were restored and re-patched
without it.

## The record player collides with this

`GlobalMusicProvider` is mounted in the root layout, so 陀飞轮 is still spinning on
`/play/night-tide`. Making the builds audible means two soundtracks at once — star-vein opens on
a music loop. The cartridge now wins: entering `play` with a Godot build stops the record. Only
for those two; the canvas three make no sound, so there is nothing to collide with.

## Checks

- `npx tsc --noEmit` clean, `npm run build` clean (dev server stopped first), `git diff --check`
  clean
- Bridge extracted from the patched HTML and `node --check`ed: parses, no stray escapes
- One bridge, one `joi-key` handler, wrapper before the engine, in both builds
- Instrumented the engine's own graph construction by loading the stock shell directly:
  context `running` at 48kHz with `currentTime` advancing, `GainNode -> destination` at
  gain 1.0, both worklets `addModule ok`, a buffer source playing, `localStorage` empty.
  Every part of the audio path is correct — which is what pointed at the game rather than
  the plumbing.
- The author confirmed silence in the stock shell (`/games/star-vein/index.html`, no
  handheld, no iframe, no CSS3D), which is what ruled out the embedding.
- The graph instrumentation that established this — global wrappers on
  `AudioNode.prototype.connect` and `AudioWorklet.prototype.addModule` — has been removed.
  `__joiAudio.report()` / `.resume()` / `.beep()` stay; they are cheap and they are what
  the next person will want when the players land.

## The canvas three

They genuinely had nothing — no code, no assets — so their sound is synthesised in
`games/gameAudio.ts`: square and triangle oscillators, short envelopes, filtered noise for
impacts, and a per-game loop scheduled off the AudioContext clock rather than the render loop,
because these games share a page with a 3D console and a frame-driven sequencer inherits every
stutter it has.

The melodies are written, not borrowed. Korobeiniki is old enough to be public domain, but a
chiptune of it over a falling-block game is the trademark rather than the melody, so the blocks
get an original minor ostinato instead.

`GameContext` gained an `audio` handle, supplied by the shell the same way `input` is — a game
never builds an AudioContext of its own. The rig is created when a cartridge seats (a real
click, which is what lets a context start) and disposed on eject, so a loop cannot outlive its
cartridge.

Two latent bugs surfaced while wiring it, both the same shape: `snake`'s `turn()` and `tetris`'s
`tryRotate()` returned nothing, so "play a sound only if the move was accepted" silently never
fired. Both now report whether the move was taken — which is also the correct trigger, since a
piece pressed into a wall should stay quiet.

## Still open

night-tide's music is procedural and deliberately sparse; if the author wants a stronger track
that is a change in the Godot project, not here.
