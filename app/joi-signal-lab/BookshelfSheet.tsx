"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LIBRARY, LIBRARY_YEARS, type LibraryBook } from "./roomLibrary";
import styles from "./room-bookshelf.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The book the reader clicked on the shelf, if they clicked one rather than the board. */
  initialBookId?: string | null;
};

/**
 * The shelf, opened: a reading timeline.
 *
 * Built to the reference's own shelf app (`docs/pinchen-room-research/
 * room-miniapps-2026-08.md`): a year axis, the books ranged along it, and the selected
 * one set large — date, title in the serif, author, and its line.
 *
 * The books themselves are 3D and real, built by `roomBookshelf.ts` from the same
 * `roomLibrary.ts` table this reads. Clicking a spine in the room opens this panel with
 * that book already selected, which is why `initialBookId` exists; clicking the board
 * opens it on the first book of the newest year.
 */
export function BookshelfSheet({ open, onClose, initialBookId }: Props) {
  const [selectedId, setSelectedId] = useState<string>(LIBRARY[0]?.id ?? "");
  const railRef = useRef<HTMLDivElement>(null);

  /** Newest first, because a reading list is read from what you just finished. */
  const byYear = useMemo(() => {
    const years = [...LIBRARY_YEARS].reverse();
    return years.map((year) => ({
      year,
      books: LIBRARY.filter((book) => book.year === year),
    }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const wanted = LIBRARY.find((book) => book.id === initialBookId);
    setSelectedId(wanted?.id ?? byYear[0]?.books[0]?.id ?? LIBRARY[0].id);
  }, [byYear, initialBookId, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const selected: LibraryBook | undefined = LIBRARY.find((book) => book.id === selectedId);

  /** ← → walk the shelf in its own order, which is the order the room stands it in. */
  const step = useCallback((delta: number) => {
    const index = LIBRARY.findIndex((book) => book.id === selectedId);
    const next = LIBRARY[(index + delta + LIBRARY.length) % LIBRARY.length];
    if (next) setSelectedId(next.id);
  }, [selectedId]);

  const onRailKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    }
  }, [step]);

  // Keep the selected spine in view when the selection moves from outside the rail —
  // an arrow key, or a click on the book in the room.
  useEffect(() => {
    if (!open) return;
    const rail = railRef.current;
    const active = rail?.querySelector(`[data-book="${selectedId}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, selectedId]);

  if (!open) return null;

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Reading shelf">
      <button className={styles.backdrop} type="button" aria-label="Close shelf" onClick={onClose} />
      <div className={styles.panel}>
        <header className={styles.head}>
          <span>SHELF / 书架</span>
          <button className={styles.close} type="button" onClick={onClose}>CLOSE · ESC</button>
        </header>

        <div className={styles.body}>
          {/* The axis: years down the side, the books on each ranged beside it. */}
          <div
            className={styles.rail}
            ref={railRef}
            role="listbox"
            aria-label="Books by year"
            tabIndex={0}
            onKeyDown={onRailKeyDown}
          >
            {byYear.map(({ year, books }) => (
              <section className={styles.yearGroup} key={year}>
                <h3 className={styles.year}>{year}</h3>
                <ul className={styles.books}>
                  {books.map((book) => (
                    <li key={book.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={book.id === selectedId}
                        data-book={book.id}
                        className={`${styles.entry} ${book.id === selectedId ? styles.entryOn : ""}`}
                        onClick={() => setSelectedId(book.id)}
                      >
                        {/* The spine's own colour, so the list and the shelf are the same shelf. */}
                        <i className={styles.swatch} style={{ background: book.spine }} aria-hidden="true" />
                        <span className={styles.entryTitle}>{book.title}</span>
                        <span className={styles.entryAuthor}>{book.author}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {selected && (
            <article className={styles.detail} aria-live="polite">
              {/* Only ever drawn for an entry that has a file. See `roomLibrary.ts`. */}
              {selected.art && (
                /*
                 * No `width`/`height`: the seven scans run 297–375px wide at aspect ratios
                 * from 0.63 to 0.75, so one pair of attributes would be a wrong hint for
                 * six of them. The CSS sets the width and lets the file set the ratio.
                 */
                <img
                  className={styles.art}
                  src={selected.art}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <p className={styles.detailYear}>{selected.year}</p>
              <h2 className={styles.detailTitle}>{selected.title}</h2>
              {selected.titleOriginal && (
                <p className={styles.detailOriginal}>{selected.titleOriginal}</p>
              )}
              <p className={styles.detailAuthor}>
                {selected.author}
                {selected.authorOriginal && <span> · {selected.authorOriginal}</span>}
              </p>

              {selected.quote ? (
                <blockquote className={styles.quote}>
                  {selected.quoteZh && <p className={styles.quoteZh}>{selected.quoteZh}</p>}
                  <p className={styles.quoteEn}>{selected.quote}</p>
                </blockquote>
              ) : (
                /*
                 * A book with no line says so. `roomLibrary.ts` deliberately leaves one
                 * blank rather than inventing a quotation for it, and a panel that quietly
                 * dropped the block would hide the fact that it is waiting for one.
                 */
                <p className={styles.quoteEmpty}>还没记下这本里的句子</p>
              )}
            </article>
          )}
        </div>

        <p className={styles.hint}>
          <span>点书脊或列表 · ← → 翻</span>
          <span className={styles.hintEn}>CLICK A SPINE · ARROWS</span>
        </p>
      </div>
    </div>
  );
}
