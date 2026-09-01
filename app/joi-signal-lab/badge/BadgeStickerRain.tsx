"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./badge.module.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const STICKERS = [
  "01-crying.png",
  "02-confused.png",
  "03-shocked.png",
  "04-money.png",
  "05-suspicious.png",
  "06-unimpressed.png",
  "07-blep.png",
  "08-love.png",
  "09-rocket.png",
].map((file) => `${basePath}/contact/stickers/${file}`);

export type PastedSticker = {
  id: number;
  src: string;
  face: "front" | "back";
  x: number;
  y: number;
  rotation: number;
  width: number;
};

type FallingSticker = {
  id: number;
  src: string;
};

type Physics = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationVelocity: number;
  size: number;
  dragging: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  lastTime: number;
  samples: Array<{ x: number; y: number; time: number }>;
};

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(maximum, value))
);

// A sticker should drift through the composition long enough to be noticed and caught.
// The first pass crossed a desktop viewport in roughly 2.5 seconds; this settles near
// 3.7–4.2 seconds without making the drag feel suspended.
const FALL_GRAVITY = 135;
const FALL_SPEED_MIN = 28;
const FALL_SPEED_RANGE = 26;

/** One random sticker at a time falls through the viewport until it is caught. */
export function BadgeStickerRain({
  active,
  cardRef,
  face,
  onPaste,
}: {
  active: boolean;
  cardRef: RefObject<HTMLDivElement | null>;
  face: "front" | "back";
  onPaste: (sticker: Omit<PastedSticker, "id">) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [falling, setFalling] = useState<FallingSticker | null>(null);
  const elementRef = useRef<HTMLButtonElement>(null);
  const physicsRef = useRef<Physics | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const activeRef = useRef(active);
  const lastStickerRef = useRef(-1);
  const spawnTimerRef = useRef(0);
  const idRef = useRef(0);
  activeRef.current = active;

  useEffect(() => setMounted(true), []);

  const spawn = useCallback(() => {
    if (!activeRef.current) return;
    const cardBounds = cardRef.current?.getBoundingClientRect();
    if (!cardBounds || cardBounds.width < 40 || cardBounds.height < 60) return;
    const availableWidth = Math.max(window.innerWidth, 320);
    const size = clamp(availableWidth * 0.086, 82, 132);
    let stickerIndex = Math.floor(Math.random() * STICKERS.length);
    if (stickerIndex === lastStickerRef.current) {
      stickerIndex = (stickerIndex + 1 + Math.floor(Math.random() * 7)) % STICKERS.length;
    }
    lastStickerRef.current = stickerIndex;
    const safeRight = Math.max(34, availableWidth - size - 34);
    const x = 34 + Math.random() * Math.max(1, safeRight - 34);

    physicsRef.current = {
      x,
      y: -size - 20,
      vx: (Math.random() - 0.5) * 42,
      vy: FALL_SPEED_MIN + Math.random() * FALL_SPEED_RANGE,
      rotation: -18 + Math.random() * 36,
      rotationVelocity: (Math.random() - 0.5) * 24,
      size,
      dragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      lastTime: performance.now(),
      samples: [],
    };
    setFalling({ id: ++idRef.current, src: STICKERS[stickerIndex] });
  }, [cardRef]);

  const scheduleSpawn = useCallback((delay = 900) => {
    window.clearTimeout(spawnTimerRef.current);
    spawnTimerRef.current = window.setTimeout(spawn, delay);
  }, [spawn]);

  useEffect(() => {
    window.clearTimeout(spawnTimerRef.current);
    if (!active) {
      setFalling(null);
      physicsRef.current = null;
      return;
    }
    scheduleSpawn(520);
    return () => window.clearTimeout(spawnTimerRef.current);
  }, [active, scheduleSpawn]);

  useEffect(() => {
    if (!active || !falling) return;
    const element = elementRef.current;
    const physics = physicsRef.current;
    if (!element || !physics) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    // Size never changes during a fall. Writing width inside the animation loop made
    // every transform frame also dirty layout, even though the value was identical.
    element.style.width = `${physics.size.toFixed(1)}px`;
    const draw = () => {
      element.style.transform = `translate3d(${physics.x.toFixed(1)}px, ${physics.y.toFixed(1)}px, 0) rotate(${physics.rotation.toFixed(2)}deg)`;
    };
    drawRef.current = draw;

    const tick = (time: number) => {
      const elapsed = Math.min(40, Math.max(8, time - physics.lastTime));
      physics.lastTime = time;
      if (!physics.dragging && !reducedMotion) {
        const seconds = elapsed / 1000;
        physics.vy += FALL_GRAVITY * seconds;
        physics.x += physics.vx * seconds;
        physics.y += physics.vy * seconds;
        physics.rotation += physics.rotationVelocity * seconds;

        const minimumX = 16;
        const maximumX = Math.max(minimumX, window.innerWidth - physics.size - 16);
        if (physics.x < minimumX || physics.x > maximumX) {
          physics.x = clamp(physics.x, minimumX, maximumX);
          physics.vx *= -0.72;
        }
      }
      draw();

      if (!physics.dragging && physics.y > window.innerHeight + physics.size) {
        setFalling(null);
        physicsRef.current = null;
        scheduleSpawn(680);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    if (reducedMotion) {
      physics.x = clamp(window.innerWidth * 0.64, 20, window.innerWidth - physics.size - 20);
      physics.y = clamp(window.innerHeight * 0.24, 96, window.innerHeight - physics.size - 20);
      draw();
    } else {
      frame = window.requestAnimationFrame(tick);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      drawRef.current = () => {};
    };
  }, [active, falling, scheduleSpawn]);

  const pasteAt = useCallback((clientX: number, clientY: number) => {
    const card = cardRef.current;
    const physics = physicsRef.current;
    if (!card || !physics || !falling) return false;
    const bounds = card.getBoundingClientRect();
    const inside = clientX >= bounds.left - 8
      && clientX <= bounds.right + 8
      && clientY >= bounds.top - 8
      && clientY <= bounds.bottom + 8;
    if (!inside) return false;

    onPaste({
      src: falling.src,
      face,
      x: clamp((clientX - bounds.left) / Math.max(bounds.width, 1), 0.12, 0.88),
      y: clamp((clientY - bounds.top) / Math.max(bounds.height, 1), 0.12, 0.88),
      rotation: physics.rotation,
      width: clamp(physics.size / Math.max(bounds.width, 1), 0.32, 0.52),
    });
    setFalling(null);
    physicsRef.current = null;
    scheduleSpawn(1050);
    return true;
  }, [cardRef, face, falling, onPaste, scheduleSpawn]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const physics = physicsRef.current;
    if (!physics) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    physics.dragging = true;
    physics.dragOffsetX = event.clientX - physics.x;
    physics.dragOffsetY = event.clientY - physics.y;
    physics.samples = [{ x: event.clientX, y: event.clientY, time: performance.now() }];
    event.currentTarget.dataset.dragging = "true";
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const physics = physicsRef.current;
    if (!physics?.dragging) return;
    physics.x = event.clientX - physics.dragOffsetX;
    physics.y = event.clientY - physics.dragOffsetY;
    // Reduced-motion keeps falling still and therefore has no animation loop. Draw
    // directly during a real drag so the core paste interaction remains responsive.
    drawRef.current();
    const now = performance.now();
    physics.samples.push({ x: event.clientX, y: event.clientY, time: now });
    while (physics.samples.length > 2 && now - physics.samples[0].time > 110) {
      physics.samples.shift();
    }
  };

  const release = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const physics = physicsRef.current;
    if (!physics?.dragging) return;
    physics.dragging = false;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cancelled && pasteAt(event.clientX, event.clientY)) return;

    const first = physics.samples[0];
    const last = physics.samples[physics.samples.length - 1];
    if (first && last && first !== last) {
      const elapsed = Math.max(24, last.time - first.time);
      physics.vx = clamp(((last.x - first.x) / elapsed) * 1000, -680, 680);
      physics.vy = clamp(((last.y - first.y) / elapsed) * 1000, -540, 760);
    }
    physics.lastTime = performance.now();
  };

  if (!mounted || !active || !falling) return null;

  return createPortal(
    <div className={styles.stickerDropLayer} aria-live="polite">
      <button
        ref={elementRef}
        type="button"
        className={styles.fallingSticker}
        aria-label="拖动这张贴纸，把它贴到工牌上"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => release(event)}
        onPointerCancel={(event) => release(event, true)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          const bounds = cardRef.current?.getBoundingClientRect();
          if (bounds) pasteAt(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        }}
        style={{ "--sticker-aspect": "1" } as CSSProperties}
      >
        <img src={falling.src} alt="" draggable={false} />
        <span>DRAG TO BADGE</span>
      </button>
    </div>,
    document.body,
  );
}
