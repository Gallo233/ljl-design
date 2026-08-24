"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./badge.module.css";
import { createRope } from "./verletRope";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Where the badge-back art will live once the author drops the file in. */
const BACK_ART_SRC = `${basePath}/media/badge-card-back.png`;
const FRONT_SRC = `${basePath}/media/gallo-headshot.jpg`;

const ROPE_SEGMENTS = 14;
const SEGMENT_LENGTH = 16;

/**
 * The visitor badge: a DOM card hanging from a verlet rope, drawn as SVG.
 *
 * Why DOM and not a mesh: the back face is a CSS holographic trading card — layered
 * repeating-gradients under color-dodge/screen blends chasing the pointer — and that
 * technique belongs to CSS. So the card stays DOM, the rope stays SVG, and the physics
 * is arithmetic in `verletRope.ts`.
 *
 * Interactions: drag anywhere on the card (pointer capture; a fling carries velocity),
 * a sub-6px release counts as a click and flips the card. The sim sleeps when still —
 * rAF stops entirely — and wakes on pointer or on the section becoming active.
 */
export function LanyardBadge({ active }: { active: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const stitchRef = useRef<SVGPathElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [hasBackArt, setHasBackArt] = useState(true);
  const backArtRef = useRef<HTMLImageElement>(null);
  const wakeRef = useRef<() => void>(() => {});

  // An image that 404s before hydration errors into the void — onError never fires.
  // One post-mount check catches that case; the art appears the moment the author
  // drops the real file into public/media/.
  useEffect(() => {
    const image = backArtRef.current;
    if (image && image.complete && image.naturalWidth === 0) setHasBackArt(false);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    const strap = svgPathRef.current;
    const stitch = stitchRef.current;
    if (!root || !card || !strap || !stitch) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let anchorX = root.clientWidth / 2;
    const rope = createRope(anchorX, -6, ROPE_SEGMENTS, SEGMENT_LENGTH);
    const resize = () => {
      anchorX = root.clientWidth / 2;
      rope.setAnchor(anchorX, -6);
      wake();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    let frame = 0;
    let running = false;
    let stillFrames = 0;
    let lastTime = 0;

    // Pointer bookkeeping: recent samples give release velocity; distance gates the flip.
    let dragging = false;
    let downAt = { x: 0, y: 0, time: 0 };
    let moved = 0;
    const samples: Array<{ x: number; y: number; t: number }> = [];

    const localPoint = (event: PointerEvent) => {
      const bounds = root.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };

    const draw = () => {
      const points = rope.points;
      let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let index = 1; index < points.length; index += 1) {
        const mid = index < points.length - 1
          ? { x: (points[index].x + points[index + 1].x) / 2, y: (points[index].y + points[index + 1].y) / 2 }
          : points[index];
        path += ` Q ${points[index].x.toFixed(1)} ${points[index].y.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)}`;
      }
      strap.setAttribute("d", path);
      stitch.setAttribute("d", path);

      const tail = points[points.length - 1];
      const prev = points[points.length - 2];
      let angle = Math.atan2(tail.x - prev.x, -(tail.y - prev.y)) * (180 / Math.PI);
      angle = Math.max(-28, Math.min(28, -angle));
      const vx = tail.x - tail.px;
      card.style.transform =
        `translate(${tail.x.toFixed(1)}px, ${tail.y.toFixed(1)}px) rotate(${angle.toFixed(2)}deg)`;
      card.style.setProperty("--swing", (Math.max(-1, Math.min(1, vx * 0.25))).toFixed(3));
    };

    const tick = (time: number) => {
      const dt = lastTime ? Math.min(time - lastTime, 64) : 16;
      lastTime = time;
      const moving = rope.step(dt);
      draw();
      if (moving) stillFrames = 0;
      else stillFrames += 1;
      if (stillFrames > 30 && !dragging) {
        running = false;
        lastTime = 0;
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    const wake = () => {
      if (running) return;
      running = true;
      stillFrames = 0;
      frame = window.requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    if (reducedMotion) {
      // Rest pose, no pendulum. Drag becomes a direct follow below.
      rope.step(1000);
      for (let settle = 0; settle < 240; settle += 1) rope.step(16);
      draw();
    } else {
      wake();
    }

    const onPointerDown = (event: PointerEvent) => {
      const point = localPoint(event);
      dragging = true;
      moved = 0;
      downAt = { x: point.x, y: point.y, time: performance.now() };
      samples.length = 0;
      card.setPointerCapture(event.pointerId);
      rope.grab(point.x, point.y);
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      // The holo layers chase the pointer whether or not a drag is on.
      const cardBounds = card.getBoundingClientRect();
      const relX = (event.clientX - cardBounds.left) / Math.max(1, cardBounds.width);
      const relY = (event.clientY - cardBounds.top) / Math.max(1, cardBounds.height);
      card.style.setProperty("--px", relX.toFixed(3));
      card.style.setProperty("--py", relY.toFixed(3));
      if (!dragging) return;
      const point = localPoint(event);
      moved = Math.max(moved, Math.hypot(point.x - downAt.x, point.y - downAt.y));
      rope.drag(point.x, point.y);
      const now = performance.now();
      samples.push({ x: point.x, y: point.y, t: now });
      while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
      wake();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
      let vx = 0;
      let vy = 0;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const span = Math.max(16, last.t - first.t);
        vx = ((last.x - first.x) / span) * 1000;
        vy = ((last.y - first.y) / span) * 1000;
      }
      rope.release(reducedMotion ? 0 : vx, reducedMotion ? 0 : vy);
      wake();
      const quick = performance.now() - downAt.time < 320;
      if (moved < 6 && quick) setFlipped((value) => !value);
    };

    card.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      card.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  // Waking on section entry restarts the idle settle if the layer was hidden mid-swing.
  useEffect(() => {
    if (active) wakeRef.current();
  }, [active]);

  return (
    <div ref={rootRef} className={styles.lanyard} aria-hidden={!active}>
      <svg className={styles.rope} aria-hidden="true">
        <path ref={svgPathRef} className={styles.strap} d="" />
        <path ref={stitchRef} className={styles.stitch} d="" />
      </svg>
      <div
        ref={cardRef}
        className={`${styles.cardRig} ${flipped ? styles.flipped : ""}`}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "工牌背面 — 点按翻回正面" : "访客工牌 — 点按翻到背面"}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setFlipped((value) => !value);
        }}
      >
        <span className={styles.clasp} aria-hidden="true" />
        <div className={styles.card}>
          <div className={`${styles.face} ${styles.front}`}>
            <span className={styles.punchHole} aria-hidden="true" />
            <img className={styles.portrait} src={FRONT_SRC} alt="Gallo" draggable={false} />
            <div className={styles.plate}>
              <strong>GALLO LIU</strong>
              <span>AI PRODUCT · PRODUCT DESIGN</span>
            </div>
            <span className={styles.barcode} aria-hidden="true" />
            <span className={styles.visitorTag}>VISITOR /// JOI LAB</span>
          </div>
          <div className={`${styles.face} ${styles.back}`}>
            <span className={styles.punchHole} aria-hidden="true" />
            {hasBackArt && (
              <img
                ref={backArtRef}
                className={styles.backArt}
                src={BACK_ART_SRC}
                alt=""
                draggable={false}
                onError={() => setHasBackArt(false)}
              />
            )}
            <span className={styles.holo} aria-hidden="true" />
            <span className={styles.laser} aria-hidden="true" />
            <span className={styles.glare} aria-hidden="true" />
            <span className={styles.backTag}>JOI LAB · 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
