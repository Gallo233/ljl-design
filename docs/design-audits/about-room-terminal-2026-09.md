# About room — the desk terminal (2026-09-01)

The third of the room's objects to become an application, after the whiteboard and the deck.
Built against pinchen.me's own terminal as described in
`docs/pinchen-room-research/room-miniapps-2026-08.md`, and it keeps that terminal's command
grammar: `help / about / projects / socials / echo / history / welcome / clear`,
`<list> go <n>` to open an entry, Tab completion, arrow-key history, Ctrl+L, Escape.

Two things are deliberately not the reference.

## It is DOM, not a texture on the laptop's screen

The reference paints its terminal into a `CanvasTexture` and puts it on the MacBook mesh. This
site cannot, for a reason it had already written down: AGENTS.md, *What is still DOM,
deliberately* — everything drawn into the stage canvas goes through `postfx`'s lens distortion
and vertical chromatic aberration. That is a look for a picture and a legibility problem for
twelve-point monospace, which is why this site's typography has always stayed in DOM above the
canvas.

There was a second reason, and it is the one the author named: the reel's hand-off docks the
selected negative *into* that screen and leaves it there for the whole About section. A terminal
painted onto `screen.001` would have had to evict it. Opening in front of it evicts nothing —
`room3d.ts`'s handoff code is untouched by this change.

The panel keeps the tube anyway. The phosphor wash, the vignette and the scanlines are CSS on
the sheet, so the terminal still reads as a screen without going through the glass.

Being DOM pays a second time on the input. The reference has to hide a 1px `<input>` behind its
canvas — `opacity 0.015`, `fontSize 16px`, `navigator.virtualKeyboard.show()` — purely to raise
an iOS keyboard for a canvas that cannot take focus. Here the field *is* the prompt, so the
mobile keyboard, IME composition and screen readers work with no bridge at all. The one thing
inherited from that hack is the 16px rule, kept under `@media (pointer: coarse)`: iOS zooms a
focused field under 16px and does not zoom back out.

## Every line is already in this repo

`terminalProgram.ts` reads `reelProjects.ts`, `projectData.ts`, `labData.ts` and
`roomObjects.ts`, plus the contact panel's own strings. Nothing in it is written for the
terminal, which is the rule that keeps it from becoming a place to invent a biography.

That is also why there is no `education`, which the reference has: the data is not in this repo.
When an English resume lands (`docs/asset-requests.md`, item 7) the command has a slot.

One line did get invented on the first pass and was removed: `about` printed a Chinese name for
the author that appears nowhere in this repo. `GALLO LIU` — the name on the badge, the call
sheet and the reel's slate — is what it prints now.

## The banner, and two failed attempts at it

The reference opens with ASCII art of the name. Ours opens with letterspaced caps over a rule,
after two tries at the art:

1. **Figlet-style sloped letters.** They only close if the face's `/`, `\` and `_` meet exactly.
   IBM Plex Mono's do not — it rendered as four rows of punctuation.
2. **Block letters on a `#` grid.** `#` inks about half its advance, so the wordmark reads as a
   halftone at any size; tightening the tracking to `-.12em` and scaling to 20px both failed.
   The character that would fix it is `█`, which is outside the `latin` subset `app/fonts.ts`
   loads — it would fall back to another face and take its advance width with it, misaligning
   every row below.

Letterspaced caps are the register this site already uses for exactly this, they are legible at
12px, and no font can break them.

## Two alignment bugs worth keeping the note on

- `code` printed both project titles and then both repository URLs, because it mapped the list
  twice instead of flat-mapping it once.
- `room` padded the *Chinese* half of each row with `padEnd`, which counts characters. CJK takes
  two monospace columns per character, so the second column landed in five different places. The
  English half leads now, because it is the half that pads exactly.

## Checks

- `npx tsc --noEmit` clean; `git diff --check` clean; `/`, `/selected-work/`, `/about-me/`,
  `/contact/`, `/lab/` all 200
- Driven on `/lab/room-preview` — the bench grew a `__terminal(true)` toggle beside `__deck`,
  for the reason its header already gives about the deck console, and because an agent pane
  suspends the rAF that would be needed to scroll to the About section and click the laptop.
- Exercised: every command; `projects go 99` and an unknown command for the error paths; Tab
  completing `pro` → `projects`; an ambiguous `c` listing its candidates; ↑ ↑ ↓ walking the
  history; Ctrl+L emptying the scrollback.
