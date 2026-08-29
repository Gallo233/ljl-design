"use client";

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { clamp01 } from "./sections";
import styles from "./joi-signal-lab.module.css";

const COMMIT_THRESHOLD = 0.35;
const CLICK_SLOP = 7;

type PageTurnCornerProps = {
  active: boolean;
  /** Scroll's current turn amount, used when a drag begins midway through the hand-off. */
  progressRef: MutableRefObject<number>;
  onProgress: (progress: number, dragX: number, dragY: number, dragging: boolean) => void;
  onCommit: () => void;
};

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startProgress: number;
  progress: number;
  distance: number;
};

/**
 * The black corner of Contact's call sheet.
 *
 * It is intentionally pointer-driven rather than a canned animation: the sheet follows
 * the hand, commits after 35%, and otherwise returns to the amount already owned by
 * scroll. Click and keyboard activation only lift the corner as an affordance; they do
 * not turn the page for the reader.
 */
export function PageTurnCorner({
  active,
  progressRef,
  onProgress,
  onCommit,
}: PageTurnCornerProps) {
  const gestureRef = useRef<Gesture | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const hintRafRef = useRef<number | null>(null);
  const [hinting, setHinting] = useState(false);

  const hint = () => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    if (hintRafRef.current !== null) window.cancelAnimationFrame(hintRafRef.current);
    setHinting(false);
    hintRafRef.current = window.requestAnimationFrame(() => {
      hintRafRef.current = null;
      setHinting(true);
      hintTimerRef.current = window.setTimeout(() => {
        setHinting(false);
        hintTimerRef.current = null;
      }, 880);
    });
  };

  useEffect(() => () => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    if (hintRafRef.current !== null) window.cancelAnimationFrame(hintRafRef.current);
  }, []);

  const finish = (event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const clicked = gesture.distance < CLICK_SLOP;
    if (!cancelled && clicked) {
      onProgress(progressRef.current, 0, 0, false);
      hint();
      return;
    }
    if (!cancelled && gesture.progress >= COMMIT_THRESHOLD) {
      onProgress(gesture.progress, 0, 0, false);
      onCommit();
      return;
    }
    onProgress(progressRef.current, 0, 0, false);
  };

  return (
    <button
      type="button"
      className={styles.pageTurnCorner}
      disabled={!active}
      data-active={active ? "true" : "false"}
      data-hinting={hinting ? "true" : "false"}
      aria-label="Drag the page corner down and left to open Contact"
      onPointerDown={(event) => {
        if (!active) return;
        event.preventDefault();
        const startProgress = progressRef.current;
        gestureRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startProgress,
          progress: startProgress,
          distance: 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        onProgress(startProgress, 0, 0, true);
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        event.preventDefault();
        const dragX = Math.max(0, gesture.startX - event.clientX);
        const dragY = Math.max(0, event.clientY - gesture.startY);
        const distance = Math.hypot(dragX, dragY);
        const fullTurnDistance = Math.hypot(window.innerWidth * 0.58, window.innerHeight * 0.62);
        const progress = clamp01(
          gesture.startProgress + (distance / fullTurnDistance) * (1 - gesture.startProgress),
        );
        gesture.progress = progress;
        gesture.distance = distance;
        onProgress(progress, dragX, dragY, true);
      }}
      onPointerUp={(event) => finish(event, false)}
      onPointerCancel={(event) => finish(event, true)}
      onClick={(event) => {
        // Pointer clicks hint in `onPointerUp`; `detail === 0` is keyboard activation.
        if (event.detail === 0) hint();
      }}
    >
      <span className={styles.pageCurlUnder} aria-hidden="true" />
      <span className={styles.pageCurlFold} aria-hidden="true" />
      <span className={styles.pageCurlHint} aria-hidden="true">PULL&nbsp; ↙</span>
    </button>
  );
}
