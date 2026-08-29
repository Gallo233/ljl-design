"use client";

import { useEffect, useRef, useState } from "react";
import { ROOM_OBJECTS } from "./roomObjects";
import { ROOM_BOOKS } from "./roomBooks";
import { ROOM_FILMS } from "./roomFilms";
import type { RoomTerminalRig } from "./roomTerminal";
import styles from "./joi-signal-lab.module.css";

/**
 * The About room's app layer: the sheet the room's objects open into, the hidden
 * mobile input that feeds the terminal, and the three-moment switch.
 *
 * The sheet pattern follows the reference room's finding: the overlay is DOM above the
 * canvas — backdrop click closes, Escape closes, focus lives inside while it is open —
 * and the camera pull happens underneath it, in the 3D room.
 */

export type RoomAppId = "books" | "films" | "poster" | "handheld";
export type RoomLightPresetUi = "day" | "blue" | "night";

/* ------------------------------------------------------------------ */
/* The sheet frame                                                     */
/* ------------------------------------------------------------------ */

export function RoomAppSheet({
  appId,
  onClose,
  children,
}: {
  appId: RoomAppId;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const definition = ROOM_OBJECTS.find((entry) => entry.id === (appId === "handheld" ? "handheld" : appId));

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    const focusables = panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      const outside = !(panel && panel.contains(current));
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div
      className={styles.roomAppLayer}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.roomAppPanel}
        role="dialog"
        aria-modal="true"
        aria-label={definition?.labelZh ?? appId}
        tabIndex={-1}
      >
        <header className={styles.roomAppHeader}>
          <div>
            <p className={styles.roomAppKicker}>
              <i aria-hidden="true" />
              {definition?.label ?? appId}
            </p>
            <p className={styles.roomAppStory} lang="zh-CN">
              {definition?.storyZh}
            </p>
          </div>
          <button type="button" className={styles.roomAppClose} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className={styles.roomAppBody}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reading timeline                                                    */
/* ------------------------------------------------------------------ */

export function BooksSheet({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (nodeIndex: number) => void;
}) {
  const current = ROOM_BOOKS.find((book) => book.nodeIndex === selected) ?? ROOM_BOOKS[0];
  const dated = ROOM_BOOKS.filter((book): book is typeof book & { year: number } => book.year !== null);
  const minYear = Math.min(...dated.map((book) => book.year));
  const maxYear = Math.max(...dated.map((book) => book.year));

  return (
    <div>
      <div className={styles.roomBooksRuler} aria-hidden="true">
        {dated.map((book) => (
          <button
            key={book.id}
            type="button"
            tabIndex={-1}
            style={{ left: `${((book.year - minYear) / (maxYear - minYear)) * 100}%`, color: book.accent }}
            className={selected === book.nodeIndex ? styles.roomBooksTickActive : ""}
            onClick={() => onSelect(book.nodeIndex)}
          >
            {book.year}
          </button>
        ))}
      </div>

      <div key={current.id} className={styles.roomBookDetail}>
        <i className={styles.roomBookSpine} style={{ background: `linear-gradient(160deg, ${current.cover}, ${current.accent})` }} aria-hidden="true" />
        <div>
          <p className={styles.roomBookMeta}>
            {current.year ?? "年份待补"} · {current.kind === "manga" ? "漫画" : current.kind === "essay" ? "文集" : "小说"}
          </p>
          <h3 className={styles.roomBookTitle}>{current.title}</h3>
          <p className={styles.roomBookAuthor}>{current.author}</p>
          <p className={styles.roomBookNote} lang="zh-CN">
            {current.note}
          </p>
          {current.quote && (
            <blockquote className={styles.roomBookQuote} lang="zh-CN">
              「{current.quote}」
              {current.quoteBy && <cite>—— {current.quoteBy}</cite>}
            </blockquote>
          )}
        </div>
      </div>

      <div className={styles.roomBookChips} role="tablist" aria-label="书架上的书">
        {ROOM_BOOKS.map((book) => (
          <button
            key={book.id}
            type="button"
            role="tab"
            aria-selected={book.nodeIndex === current.nodeIndex}
            className={book.nodeIndex === current.nodeIndex ? styles.roomBookChipActive : ""}
            onClick={() => onSelect(book.nodeIndex)}
          >
            {book.title}
          </button>
        ))}
      </div>
      <p className={styles.roomAppCopyNote}>// COPY-REVIEW：笔记与引文为初稿，等你改定</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Film rolls                                                          */
/* ------------------------------------------------------------------ */

function FilmFrame({ src, caption, index }: { src: string; caption: string; index: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={styles.roomFilmFrame}>
      {failed ? (
        <div className={styles.roomFilmSlate} aria-label={`${caption}（待冲扫）`}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <em>待冲扫</em>
        </div>
      ) : (
        <img src={src} alt={caption} loading="lazy" onError={() => setFailed(true)} />
      )}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function FilmsSheet() {
  const [rollId, setRollId] = useState(ROOM_FILMS[0].id);
  const [frameIndex, setFrameIndex] = useState(0);
  const roll = ROOM_FILMS.find((entry) => entry.id === rollId) ?? ROOM_FILMS[0];
  const safeIndex = Math.min(frameIndex, roll.frames.length - 1);

  return (
    <div>
      <div className={styles.roomFilmTabs}>
        {ROOM_FILMS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === roll.id ? styles.roomFilmTabActive : ""}
            onClick={() => {
              setRollId(entry.id);
              setFrameIndex(0);
            }}
          >
            <i style={{ background: entry.accent }} aria-hidden="true" />
            <strong>{entry.title}</strong>
            <em>{entry.frames.length} exp</em>
          </button>
        ))}
      </div>

      <div className={styles.roomFilmStripWrap}>
        <div className={styles.roomFilmEdge} aria-hidden="true">{roll.edgeText}</div>
        <div className={styles.roomFilmStrip}>
          <div
            className={styles.roomFilmTrack}
            style={{ transform: `translateX(-${safeIndex * 100}%)` }}
          >
            {roll.frames.map((frame, index) => (
              <FilmFrame key={frame.src} src={frame.src} caption={frame.caption} index={index} />
            ))}
          </div>
        </div>
        <div className={styles.roomFilmEdge} aria-hidden="true">{roll.edgeText}</div>

        <div className={styles.roomFilmNav}>
          <button
            type="button"
            onClick={() => setFrameIndex((value) => Math.max(0, value - 1))}
            disabled={safeIndex === 0}
            aria-label="上一张"
          >
            ←
          </button>
          <div className={styles.roomFilmProgress} aria-hidden="true">
            <i style={{ width: `${((safeIndex + 1) / roll.frames.length) * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={() => setFrameIndex((value) => Math.min(roll.frames.length - 1, value + 1))}
            disabled={safeIndex === roll.frames.length - 1}
            aria-label="下一张"
          >
            →
          </button>
        </div>
        <p className={styles.roomFilmMeta}>
          {roll.stock} · {roll.iso} · {safeIndex + 1}/{roll.frames.length}
        </p>
      </div>
      <p className={styles.roomAppCopyNote}>// COPY-REVIEW：胶卷分组是占位；照片放进 public/media/films/&lt;卷名&gt;/01.jpg 即上墙</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Posters                                                             */
/* ------------------------------------------------------------------ */

export function PosterSheet() {
  return (
    <div className={styles.roomPosters}>
      <figure className={styles.roomPoster}>
        <div className={`${styles.roomPosterArt} ${styles.roomPosterArtJoi}`} aria-hidden="true">
          <span>JOI</span>
          <em>PERSONAL AI SYSTEM · 2026</em>
        </div>
        <figcaption lang="zh-CN">JOI —— 它是这个网站的起点</figcaption>
      </figure>
      <figure className={styles.roomPoster}>
        <div className={`${styles.roomPosterArt} ${styles.roomPosterArtTide}`} aria-hidden="true">
          <span>NIGHT TIDE</span>
          <em>GAME CENTER · 2026</em>
        </div>
        <figcaption lang="zh-CN">NIGHT TIDE —— 下班以后的那一半</figcaption>
      </figure>
      <p className={styles.roomAppCopyNote}>// COPY-REVIEW：两张海报是排版占位，等你的真海报稿</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cartridges                                                          */
/* ------------------------------------------------------------------ */

const CARTRIDGES: { name: string; zh: string }[] = [
  { name: "SNAKE", zh: "贪吃蛇" },
  { name: "TETRIS", zh: "俄罗斯方块" },
  { name: "PAC-MAN", zh: "吃豆人" },
  { name: "NIGHT TIDE", zh: "夜潮 · Godot" },
];

export function CartridgeSheet() {
  return (
    <div className={styles.roomCartridges}>
      {CARTRIDGES.map((game, index) => (
        <a key={game.name} className={styles.roomCartridge} href="/play/night-tide/">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{game.name}</strong>
          <em lang="zh-CN">{game.zh}</em>
          <i aria-hidden="true">→</i>
        </a>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Terminal input bridge (mobile keyboard)                             */
/* ------------------------------------------------------------------ */

export function TerminalInputBridge({ active, rig }: { active: boolean; rig: RoomTerminalRig | null }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    const input = inputRef.current;
    if (!input) return;
    input.value = "";
    input.focus({ preventScroll: true });
    try {
      (navigator as any).virtualKeyboard?.show?.();
    } catch {
      // Not every engine exposes the virtual keyboard API; the plain focus is the fallback.
    }
    // The keyboard bridge stays primed: a scroll or a stray tap should not strand the
    // reader with a live terminal and nowhere to type.
    const refocus = () => {
      if (document.activeElement !== input) {
        window.setTimeout(() => input.focus({ preventScroll: true }), 60);
      }
    };
    window.addEventListener("touchstart", refocus, { passive: true });
    return () => {
      window.removeEventListener("touchstart", refocus);
      input.blur();
    };
  }, [active]);

  if (!active) return null;

  return (
    <input
      ref={inputRef}
      className={styles.roomTerminalBridge}
      type="text"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="done"
      aria-label="终端输入"
      onInput={(event) => {
        const native = event.nativeEvent as InputEvent;
        if (native.inputType === "deleteContentBackward") rig?.backspace();
        else if (native.data) rig?.insertText(native.data);
        event.currentTarget.value = "";
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          rig?.submit();
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          rig?.handleKey(event.nativeEvent);
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Orbit buttons: zoom in/out and reset, next to the moment switch     */
/* ------------------------------------------------------------------ */

export function OrbitButtons({
  apiRef,
}: {
  apiRef: { current: { orbitZoom: (factor: number) => void; orbitReset: () => void } | null };
}) {
  return (
    <div className={styles.roomOrbitControls} role="group" aria-label="房间视角">
      <button type="button" onClick={() => apiRef.current?.orbitZoom(0.82)} aria-label="拉近">
        +
      </button>
      <button type="button" onClick={() => apiRef.current?.orbitZoom(1.22)} aria-label="拉远">
        −
      </button>
      <button type="button" onClick={() => apiRef.current?.orbitReset()} aria-label="复位视角">
        RESET
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The three moments                                                   */
/* ------------------------------------------------------------------ */

const PRESETS: { id: RoomLightPresetUi; label: string }[] = [
  { id: "day", label: "DAY" },
  { id: "blue", label: "BLUE" },
  { id: "night", label: "NIGHT" },
];

export function RoomTimeSwitch({
  value,
  onChange,
}: {
  value: RoomLightPresetUi;
  onChange: (preset: RoomLightPresetUi) => void;
}) {
  return (
    <div className={styles.roomTimeSwitch} role="group" aria-label="房间时刻">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-pressed={value === preset.id}
          className={value === preset.id ? styles.roomTimeActive : ""}
          onClick={() => onChange(preset.id)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
