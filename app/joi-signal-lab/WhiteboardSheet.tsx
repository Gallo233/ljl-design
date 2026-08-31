"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_INKS,
  BOARD_WIDTH,
  clearBoard,
  drawSegment,
  ensureBoard,
  panelSurface,
} from "./roomBoard";
import styles from "./room-whiteboard.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * The board, close up and drawable.
 *
 * A clean white board, not the wall's composite: the print hanging on the board is a
 * picture, and drawing on top of a picture makes a collage rather than a whiteboard. The
 * ink is shared, though — the module strikes every segment onto both composites, so a
 * mark made here is already on the board in the room by the time the panel closes.
 *
 * The element below *is* the module's canvas, moved into the DOM on open and handed back
 * on close rather than copied, so there is no second version of the drawing to drift.
 */
export function WhiteboardSheet({ open, onClose }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ id: number; last: [number, number] } | null>(null);
  const [ink, setInk] = useState<string>(BOARD_INKS[0]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const holder = holderRef.current;
    if (!holder) return;
    let cancelled = false;
    void ensureBoard().then(() => {
      if (cancelled || !holderRef.current) return;
      const canvas = panelSurface();
      canvas.className = styles.surface;
      holderRef.current.appendChild(canvas);
    });
    return () => {
      cancelled = true;
      // Back out of the DOM, not destroyed: it keeps taking strokes either way.
      const canvas = panelSurface();
      if (canvas.parentElement === holder) holder.removeChild(canvas);
    };
  }, [open]);

  /** Pointer position in board pixels, whatever size the panel is showing it at. */
  const toBoard = useCallback((event: React.PointerEvent): [number, number] => {
    const canvas = panelSurface();
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * BOARD_WIDTH,
      ((event.clientY - rect.top) / Math.max(1, rect.height)) * BOARD_HEIGHT,
    ];
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button > 0) return;
    const point = toBoard(event);
    drawing.current = { id: event.pointerId, last: point };
    event.currentTarget.setPointerCapture(event.pointerId);
    // A tap with no travel should still leave a dot.
    drawSegment(point, point, ink);
  }, [ink, toBoard]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stroke = drawing.current;
    if (!stroke || stroke.id !== event.pointerId) return;
    const point = toBoard(event);
    drawSegment(stroke.last, point, ink);
    stroke.last = point;
  }, [ink, toBoard]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drawing.current?.id !== event.pointerId) return;
    drawing.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  if (!open) return null;

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Whiteboard">
      <button className={styles.backdrop} type="button" aria-label="Close whiteboard" onClick={onClose} />
      <div className={styles.panel}>
        <header className={styles.head}>
          <span>WHITEBOARD / 画板</span>
          <button className={styles.close} type="button" onClick={onClose}>CLOSE · ESC</button>
        </header>

        <div
          className={styles.stage}
          ref={holderRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        <footer className={styles.tools}>
          <div className={styles.inks} role="radiogroup" aria-label="Ink">
            {BOARD_INKS.map((colour) => (
              <button
                key={colour}
                type="button"
                role="radio"
                aria-checked={colour === ink}
                aria-label={`Ink ${colour}`}
                className={`${styles.ink} ${colour === ink ? styles.inkOn : ""}`}
                style={{ background: colour }}
                onClick={() => setInk(colour)}
              />
            ))}
          </div>
          <button className={styles.clear} type="button" onClick={() => clearBoard()}>
            CLEAR
          </button>
        </footer>
        <p className={styles.hint}>画上去的东西会留在墙上的板子上 · Your marks stay on the board</p>
      </div>
    </div>
  );
}
