"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./badge.module.css";
import { BadgeStickerRain, type PastedSticker } from "./BadgeStickerRain";
import { createRope } from "./verletRope";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Published holographic badge-back art. */
const BACK_ART_SRC = `${basePath}/media/badge-card-back.png`;
const FRONT_SRC = `${basePath}/media/gallo-headshot.jpg`;

const ROPE_SEGMENTS = 14;
const SEGMENT_LENGTH = 16;
const ROPE_LENGTH = ROPE_SEGMENTS * SEGMENT_LENGTH;
const MAX_ELASTIC_STRETCH = 96;
const PULL_RESISTANCE = 0.72;
const PULL_SPRING = 9.5;
const MAX_SPRING_SPEED = 760;
const MAX_RELEASE_SPEED = 1100;
const RELEASE_GAIN = 0.52;
const MAX_CARD_ANGLE = 18;

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
  const braidLeftRef = useRef<SVGPathElement>(null);
  const braidRightRef = useRef<SVGPathElement>(null);
  const weaveRef = useRef<SVGPathElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [hasBackArt, setHasBackArt] = useState(true);
  const [pastedStickers, setPastedStickers] = useState<PastedSticker[]>([]);
  const pastedStickerIdRef = useRef(0);
  const backArtRef = useRef<HTMLImageElement>(null);
  const wakeRef = useRef<() => void>(() => {});
  // The pointer listeners are window-level and mount once, so they cannot read
  // the `active` prop directly — it would be whatever it was on mount forever.
  const activeRef = useRef(active);
  activeRef.current = active;

  const pasteSticker = useCallback((sticker: Omit<PastedSticker, "id">) => {
    setPastedStickers((current) => [
      ...current.slice(-7),
      { ...sticker, id: ++pastedStickerIdRef.current },
    ]);
  }, []);

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
    const braidLeft = braidLeftRef.current;
    const braidRight = braidRightRef.current;
    const weave = weaveRef.current;
    if (!root || !card || !strap || !braidLeft || !braidRight || !weave) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let anchorX = root.clientWidth / 2;
    const anchorY = -6;
    const rope = createRope(anchorX, anchorY, ROPE_SEGMENTS, SEGMENT_LENGTH);
    const resize = () => {
      anchorX = root.clientWidth / 2;
      rope.setAnchor(anchorX, anchorY);
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
    let cardAngle = 0;
    let grabOffset = { x: 0, y: 0 };
    let elasticStretch = 0;
    let elasticDirection = { x: 0, y: 1 };
    const samples: Array<{ x: number; y: number; t: number }> = [];

    const localPoint = (event: PointerEvent) => {
      const bounds = root.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };

    const elasticTail = (x: number, y: number) => {
      const dx = x - anchorX;
      const dy = y - anchorY;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        elasticStretch = 0;
        return { x, y };
      }

      elasticDirection = { x: dx / distance, y: dy / distance };
      if (distance <= ROPE_LENGTH) {
        elasticStretch = 0;
        return { x, y };
      }

      // The straight lanyard is already at its natural length. Keep a short,
      // resistant elastic range beyond it so a downward pull still stores energy
      // instead of hitting a hard stop.
      elasticStretch = Math.min(
        MAX_ELASTIC_STRETCH,
        (distance - ROPE_LENGTH) * PULL_RESISTANCE,
      );
      const scale = (ROPE_LENGTH + elasticStretch) / distance;
      return { x: anchorX + dx * scale, y: anchorY + dy * scale };
    };

    const pathThrough = (points: typeof rope.points, offset = 0) => {
      const shifted = points.map((point, index) => {
        if (offset === 0) return { x: point.x, y: point.y };
        const before = points[Math.max(0, index - 1)];
        const after = points[Math.min(points.length - 1, index + 1)];
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const length = Math.hypot(dx, dy) || 1;
        return {
          x: point.x + (-dy / length) * offset,
          y: point.y + (dx / length) * offset,
        };
      });
      let path = `M ${shifted[0].x.toFixed(1)} ${shifted[0].y.toFixed(1)}`;
      for (let index = 1; index < shifted.length; index += 1) {
        const mid = index < shifted.length - 1
          ? {
              x: (shifted[index].x + shifted[index + 1].x) / 2,
              y: (shifted[index].y + shifted[index + 1].y) / 2,
            }
          : shifted[index];
        path += ` Q ${shifted[index].x.toFixed(1)} ${shifted[index].y.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)}`;
      }
      return path;
    };

    const weaveThrough = (points: typeof rope.points) => {
      let path = "";
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const direction = index % 2 === 0 ? 1 : -1;
        const halfWidth = 5.2;
        path += ` M ${(a.x + nx * halfWidth * direction).toFixed(1)} ${(a.y + ny * halfWidth * direction).toFixed(1)}`;
        path += ` L ${(b.x - nx * halfWidth * direction).toFixed(1)} ${(b.y - ny * halfWidth * direction).toFixed(1)}`;
      }
      return path;
    };

    const draw = () => {
      const points = rope.points;
      const path = pathThrough(points);
      strap.setAttribute("d", path);
      braidLeft.setAttribute("d", pathThrough(points, -3.1));
      braidRight.setAttribute("d", pathThrough(points, 3.1));
      weave.setAttribute("d", weaveThrough(points));

      const tail = points[points.length - 1];
      const prev = points[points.length - 2];
      // Measure from vertical-down, not vertical-up. The previous formula read a
      // perfectly hanging rope as 180° and clamped every resting card to ±28°.
      const ropeAngle = -Math.atan2(tail.x - prev.x, tail.y - prev.y) * (180 / Math.PI);
      const targetAngle = Math.max(-MAX_CARD_ANGLE, Math.min(MAX_CARD_ANGLE, ropeAngle));
      cardAngle += (targetAngle - cardAngle) * (dragging ? 0.34 : 0.16);
      if (!dragging && Math.abs(targetAngle) < 0.03 && Math.abs(cardAngle) < 0.03) cardAngle = 0;
      card.style.transform =
        `translate(${tail.x.toFixed(1)}px, ${tail.y.toFixed(1)}px) rotate(${cardAngle.toFixed(2)}deg)`;
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
      if (!activeRef.current) return;
      const point = localPoint(event);
      dragging = true;
      moved = 0;
      downAt = { x: point.x, y: point.y, time: performance.now() };
      samples.length = 0;
      elasticStretch = 0;
      card.setPointerCapture(event.pointerId);
      card.classList.add(styles.dragging);
      const tail = rope.points[rope.points.length - 1];
      // Keep the exact point the visitor grabbed under their pointer. Snapping the
      // rope tail itself to the pointer made any off-centre press jump the whole card.
      grabOffset = { x: tail.x - point.x, y: tail.y - point.y };
      const target = elasticTail(point.x + grabOffset.x, point.y + grabOffset.y);
      rope.grab(target.x, target.y);
      samples.push({ x: target.x, y: target.y, t: performance.now() });
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      // Preserve the initial card: its holographic finish follows the pointer across
      // Contact, while inactive sections return before performing any layout work.
      if (!dragging && !activeRef.current) return;
      const cardBounds = card.getBoundingClientRect();
      const relX = Math.max(
        0,
        Math.min(1, (event.clientX - cardBounds.left) / Math.max(1, cardBounds.width)),
      );
      const relY = Math.max(
        0,
        Math.min(1, (event.clientY - cardBounds.top) / Math.max(1, cardBounds.height)),
      );
      card.style.setProperty("--px", relX.toFixed(3));
      card.style.setProperty("--py", relY.toFixed(3));
      if (!dragging) return;
      const point = localPoint(event);
      moved = Math.max(moved, Math.hypot(point.x - downAt.x, point.y - downAt.y));
      const target = elasticTail(point.x + grabOffset.x, point.y + grabOffset.y);
      rope.drag(target.x, target.y);
      const now = performance.now();
      samples.push({ x: target.x, y: target.y, t: now });
      while (samples.length > 2 && now - samples[0].t > 110) samples.shift();
      wake();
    };
    const finishPointer = (event: PointerEvent, cancelled: boolean) => {
      if (!dragging) return;
      dragging = false;
      if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
      card.classList.remove(styles.dragging);
      card.style.setProperty("--px", ".5");
      card.style.setProperty("--py", ".5");
      let vx = 0;
      let vy = 0;
      if (!cancelled && samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const span = Math.max(16, last.t - first.t);
        vx = ((last.x - first.x) / span) * 1000;
        vy = ((last.y - first.y) / span) * 1000;
        const speed = Math.hypot(vx, vy);
        if (speed > MAX_RELEASE_SPEED) {
          const scale = MAX_RELEASE_SPEED / speed;
          vx *= scale;
          vy *= scale;
        }
        vx *= RELEASE_GAIN;
        vy *= RELEASE_GAIN;
      }

      if (!reducedMotion && elasticStretch > 0) {
        // Convert the stored pull distance into a bounded recoil toward the anchor.
        // Applying it after the throw preserves lateral flings while guaranteeing
        // that a held downward pull visibly springs back up on release.
        const springSpeed = Math.min(MAX_SPRING_SPEED, elasticStretch * PULL_SPRING);
        vx -= elasticDirection.x * springSpeed;
        vy -= elasticDirection.y * springSpeed;
        const speed = Math.hypot(vx, vy);
        if (speed > MAX_RELEASE_SPEED) {
          const scale = MAX_RELEASE_SPEED / speed;
          vx *= scale;
          vy *= scale;
        }
      }
      rope.release(reducedMotion ? 0 : vx, reducedMotion ? 0 : vy);
      elasticStretch = 0;
      wake();
      const quick = performance.now() - downAt.time < 320;
      if (!cancelled && moved < 6 && quick) setFlipped((value) => !value);
    };
    const onPointerUp = (event: PointerEvent) => finishPointer(event, false);
    const onPointerCancel = (event: PointerEvent) => finishPointer(event, true);
    const onPointerLeave = () => {
      if (dragging) return;
      card.style.setProperty("--px", ".5");
      card.style.setProperty("--py", ".5");
    };

    card.addEventListener("pointerdown", onPointerDown);
    card.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      card.removeEventListener("pointerdown", onPointerDown);
      card.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  // Waking on section entry restarts the idle settle if the layer was hidden mid-swing.
  useEffect(() => {
    if (active) wakeRef.current();
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={styles.lanyard}
      aria-hidden={!active}
      inert={active ? undefined : true}
    >
      <svg className={styles.rope} aria-hidden="true">
        <path ref={svgPathRef} className={styles.strap} d="" />
        <path ref={braidLeftRef} className={`${styles.braid} ${styles.braidLeft}`} d="" />
        <path ref={braidRightRef} className={`${styles.braid} ${styles.braidRight}`} d="" />
        <path ref={weaveRef} className={styles.weave} d="" />
      </svg>
      <div
        ref={cardRef}
        className={`${styles.cardRig} ${flipped ? styles.flipped : ""}`}
        role="button"
        tabIndex={active ? 0 : -1}
        aria-label={flipped ? "工牌背面 — 点按翻回正面" : "访客工牌 — 点按翻到背面"}
        onKeyDown={(event) => {
          if (!active) return;
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
            <span className={styles.stickerPasteLayer} aria-hidden="true">
              {pastedStickers.filter((sticker) => sticker.face === "front").map((sticker) => (
                <img
                  key={sticker.id}
                  src={sticker.src}
                  alt=""
                  draggable={false}
                  style={{
                    left: `${sticker.x * 100}%`,
                    top: `${sticker.y * 100}%`,
                    width: `${sticker.width * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                  }}
                />
              ))}
            </span>
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
            <span className={styles.stickerPasteLayer} aria-hidden="true">
              {pastedStickers.filter((sticker) => sticker.face === "back").map((sticker) => (
                <img
                  key={sticker.id}
                  src={sticker.src}
                  alt=""
                  draggable={false}
                  style={{
                    left: `${sticker.x * 100}%`,
                    top: `${sticker.y * 100}%`,
                    width: `${sticker.width * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                  }}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
      <BadgeStickerRain
        active={active}
        cardRef={cardRef}
        face={flipped ? "back" : "front"}
        onPaste={pasteSticker}
      />
    </div>
  );
}
