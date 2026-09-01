# The music sticker grows a second control, and three frames gain a way back (2026-09-01)

Two requests: the global player should roll on to the next side by itself and offer a skip,
and the three reel destinations that have a frame behind them should say so.

## The sticker

**It never advanced.** `onEnded` called `stop()`, so a side ran out and the record simply
stopped. It now steps to the next slot, and the list wraps, so the player keeps going.

Two endings had to be caught, because the two kinds of side end differently. A preview is a
real media element and fires `ended`. An offline side is synthesised and never ends on its
own, so the 250 ms clock tick is what notices its `SIDE_SECONDS` are up. Both go through one
`advance()` guarded by a flag: `play` is async, and without the guard a tick would call it
three or four times before the first call had finished. Fired three `ended` events back to
back, the player steps exactly once.

**The skip button needed the sticker to stop being a button.** It was a single `<button>`,
and a control cannot nest inside one. The card is a `div` with `role="group"` now, holding
the play/pause target and the skip. It keeps every visual property it had:

- `:active` matches ancestors, so pressing either control still presses the whole card.
- `:focus-visible` became `:focus-within`, so the ring is still drawn around the card.
- `.main` is `inset: -1px` rather than `0` — it is the containing block for the disc now, and
  the negative inset lines its padding box up with the card's border box so the disc keeps
  the exact 6px offset it had as a direct child. Measured: 6px, unchanged.

Skip sits in the right gutter under the spark, which is `pointer-events: none` so a
decoration cannot eat the click beside it. Right padding went 27px → 44px to make room. On
phones the card is a 46px disc and skip hides with the copy, because two targets in 46px is a
mis-tap waiting to happen.

## The step back

`previousProject()` in `reelProjects.ts` derives it from the reel's own table, so re-ordering
the reel re-points all three rather than leaving pages aimed at where a frame used to be.
Frame 01 returns `null` and renders nothing, which is why `/work/joi` has no such card.

Each page got the card in its own Living Aperture idiom — the same surface, radius, type and
palette as the cards beside it, though not inside the liquid field itself; see below for why:

| Page | Frame | Goes to | Placement |
|---|---|---|---|
| `/work/joi-mobile` | 02 | 01 Joi | Bottom-left, arriving on `--work-release` with the next card |
| `/play/night-tide` | 03 | 02 Joi Mobile | Beside the next card, as one row |
| `/lab` | 04 | 03 Game Center | Beside the footer, filling the space its `margin-left:auto` always left |

The Game Center's `.nextSignal` became `.frameSignal` plus two modifiers, so the pair share one
surface and differ only in which way they read and which way the arrow leans. Two of the rules
that named the old class had to follow it — the phone sizing and the landscape hide — while the
`data-liquid-ready` handoff deliberately kept naming `.nextSignal` only.

### The field is compiled for four shapes, and silently drops a fifth

The first version handed each new card to its page's liquid stage, which looked right in
every measurement — `data-liquid-ready` true, card transparent, handed over. It was wrong.
`liquidStage.ts` builds its fragment shader with `MAX_SHAPES = 4`, a module-level constant
its own header calls a deliberate composition ("four DOM-aligned portfolio states"), and the
per-pixel loop runs to that bound. A fifth element is accepted by the API, never read, and
never drawn.

The card had therefore gone transparent for a field that would never paint it: pale glass
text on a pale page, legible only if you knew where to look. The author saw it immediately on
`/work/joi-mobile`, whose page is the palest of the three.

Raising the constant was the wrong fix. The loop's cost is per pixel and the field is on every
one of these pages, and this is the same site whose frame drops were the subject of an earlier
pass. So the card stays out of the field and keeps the surface every card already wears before
the GPU draws — a `:not(.prev)` exemption on the work page, and dropped from the handoff list
on the other two. Zero shader cost, and the only thing lost is the merging thread to its
neighbour, which the corner placement on the work page would not have had anyway.

All three pages carried the same latent fault, including the two that had already been
accepted; fixing only the one that was noticed would have left the other two transparent for
any reader whose GPU actually completes a draw.

### Two things that had to be measured rather than assumed

**The work page has no free left flank.** The obvious move was to mirror `.next` on the left.
At full release the aperture has slid left but still spans the middle of the screen at 62%
scale, so a mirrored card sits on top of the demo. The card went to the bottom-left corner
instead — where `.actions` sits before it fades out — and even there the first numbers were
wrong: `.actions`' own 11svh offset and 152px body put the card's top edge 36px inside the
aperture. At 16–30px from the bottom and 112px tall it clears at every height checked:

```
600px tall → clears by 25px      800px → 73px      900px → 96px, and 215px clear of .next
```

Re-tuned once more after the author asked for it bigger: 435 x 132 with 36px type, which
still clears the aperture by 53px at 800 tall and 18px at 600.

**A missing optional ref must not abort the stage.** The shell's liquid effect returns early
if any shape is null. Adding `prevRef` to that list would have disabled the Living Aperture on
`/work/joi` entirely, since frame 01 has no previous card. The required four are checked, then
the optional one is appended and filtered.

## Checks

- `npx tsc --noEmit` clean, `npm run build` clean, `git diff --check` clean; four routes 200
- Sticker: skip walks the list (陀飞轮 → Running for Your Life → NIGHT DANCER); one `ended`
  advances one; three `ended` in a row still advance one; disc offset 6px, unchanged
- Game Center: both cards 430×156 side by side, mirrored grid columns, arrows `←`/`→`
- Lab: card and footer on one row
- With `data-liquid-ready` forced true on the work page: `.prev` keeps its surface and its
  shadow, `.next` still goes transparent — the exemption does what it says and does not leak
- `/work/joi` renders no previous card and its next card is untouched

The work page's arrival state was checked by forcing `--work-release` and measuring; the shell
rewrites that variable every frame, so a screenshot taken after the fact shows the parked state
instead. Numbers, not stills — as this page's own note in AGENTS.md says.
