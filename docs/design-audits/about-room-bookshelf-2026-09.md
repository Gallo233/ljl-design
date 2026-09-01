# About room — the shelf becomes a reading timeline (2026-09-01)

The fourth of the room's objects to become an application, and the second to be *replaced*
rather than dressed. Built to the reference's own shelf app as described in
`docs/pinchen-room-research/room-miniapps-2026-08.md`: books generated from data, a year axis,
and the selected book set large.

## The captured books were furniture

`book1`…`book10` and `book1 outer`…`book10 outer` — twenty meshes — carry baked spine art
belonging to whoever modelled the room. They are not anyone's reading. The reference's shelf is
worth clicking precisely because its books *are* data, so ours became data too:
`roomLibrary.ts` holds eight entries and `roomBookshelf.ts` stands one box per entry.

Both halves of every captured book are hidden, for `roomPlatter.ts`'s reason — the geometry is
in the capture's lightmap, so hiding is the retirement — and both halves matter: the `outer`
meshes are the covers and the plain ones the page blocks, so leaving either standing puts a
ghost book in the row.

`BASE_HOTSPOT_NODES.bookshelf` no longer names those twenty. It names the board, its bracket,
and `about-room-bookshelf`. Naming the hidden meshes would have left twenty invisible books
answering raycasts and eating clicks meant for real ones — the same fault the captured deck had,
recorded in the same table.

## Measured, not typed

`retireCapturedBooks` reports what the ten left behind: the surface they stood on, the depth of
a book, and the run along Z from the outermost face to the outermost face. Ten became eight, so
the run is re-divided rather than re-typed — the gap is the leftover, evenly divided and capped
at 0.06 so a shelf with two fewer books reads as a shelf with a little air in it rather than a
shop display spread to the ends.

## The spines

One canvas per book, cut to that spine's own aspect so a thin book and a thick one get the same
stroke weight. Chinese titles are stacked down the spine the way a Chinese spine sets them;
anything else rotates a quarter turn. Six faces, three materials — `BoxGeometry` groups them
`[+x, −x, +y, −y, +z, −z]`, and +x is the spine because the shelf's wall is at low x and the room
is viewed from high x.

Title size is a share of the spine's own width rather than a flat cap. The cap was tried first
and made `窄门` — two characters on the thinnest spine here — the one title on the shelf you
could not read.

## What is the author's and what is drafted

The eight titles, their authors and their order are the author's, given 2026-09-01. Two fields
are not, and `roomLibrary.ts` says so at the top rather than letting them pass as records:

- **`year`** — the author said the years were up to me. They are spread over three years to give
  the axis something to measure. They are not a reading record.
- **`quote`** — drafted from each work's best-known line, and wanting a check against the
  editions actually on the shelf, particularly the Chinese wording, which varies by translator.

`无限之住人` has no quote. It is the one book here whose famous line could not be named, and the
panel prints 「还没记下这本里的句子」 rather than dropping the block — a shelf entry with a
blank is honest; a line invented for a book is not.

## Covers

Seven of the eight have one, from Open Library. The first attempt concluded they were
unavailable — every request came back as a 1×1 blank GIF — and that conclusion was wrong: the
cause was the default `curl` User-Agent, which archive.org refuses, and archive.org is where the
cover CDN redirects. A browser UA plus about four seconds between requests returns real files.

**Every one was opened and looked at before it was wired.** A cover API will hand back a
plausible wrong book without complaining, and it did: searching Samura returned *Blade of the
Immortal*, which is the same author and not the book.

Two are what they are rather than what was asked for, and the data file says so:

- `forking-paths` is the **Ficciones** jacket — the collection the story is in. No standalone
  edition in that index carries a cover, and the collection is how the story is actually held.
- `golden-bough` is **The Illustrated Golden Bough**, the Mary Douglas abridgement, not the
  black-and-gold Chinese edition the author owns and that the spine colours are drawn from. Its
  cover art is Turner's *Golden Bough* — the painting this entry's quote asks about.

`春风之雪女` was the eighth book and has none — Open Library does not hold
`春風のスネグラチカ`, only Samura's *Blade of the Immortal*. Told that, the author swapped the
shelf entry to **无限之住人**, so all eight carry a jacket now: volume 1, *Blood of a Thousand*,
Manji against the moon with `無限の住人` down the side in red. That red and the field's indigo
are where the new spine's colours come from.

The empty-cover path is still live and still correct — the panel draws no block for an entry
without one — so a ninth book can arrive before its jacket does. `docs/asset-requests.md` item 8
is now only about a Chinese `金枝`.

The panel is a block rather than a flex column so the jacket can float: as a flex child it
stacked above the title and pushed the quotation out of the panel. The quote `clear`s the float,
because a pull quote in a 100px gutter is not a quote.

## `/lab/room-preview` was lying about fonts

The bench mounts the DOM apps over the real room, which is the whole reason it can check them.
It was not applying `fontVariables` — those come from `ExperienceShell`, not the root layout,
deliberately, so that loading them does not make `body` a scroll container — so every panel
checked there rendered in fallback faces. Fixed: the bench's root now carries them, and it grew
`__shelf(true)` beside `__deck` and `__terminal`.

## Checks

- `npx tsc --noEmit` clean; `git diff --check` clean
- Rendered: `shelf-macro-2` (all eight spines legible), `room-final`
- Panel driven on the bench: selection by click; ← → walking the shelf in its physical order and
  the rail scrolling to follow; all three year ticks present; the empty-quote state on
  `无限之住人`; title resolving to Instrument Serif at 40px
- The newest year's tick was missing at first — `scrollIntoView` parked the first entry flush at
  the top of the rail and cut the heading off. `scroll-margin-top` on `.entry` fixes it for every
  group, not just the first.
