"use client";

import { useEffect, useRef } from "react";
import {
  SECTIONS,
  TOTAL_SCREENS,
  getSection,
  keyboardDuration,
  sectionAt,
  snapTarget,
  type SectionId,
} from "./sections";

/**
 * Scroll model ported from shader.se. Facts and constants:
 * docs/shader-research/shader-se-2026-07/.web-shader-extractor/evidence/source/
 * scroll-and-transitions.md
 *
 * Three things it does that native scroll does not:
 *
 * 1. Smooths the reader's position with the reference's easing.
 * 2. Reports velocity, not just position.
 * 3. Snaps the hero↔reel boundary with direction-aware, asymmetric windows.
 *
 * The reference runs Lenis over a scroll container. We smooth the *progress value* instead of
 * hijacking input, which lands in the same place here because nothing in view scrolls natively:
 * `.stage` is fixed and everything inside it is driven by these numbers. Keeping native scroll
 * also keeps the scrollbar, trackpad inertia and accessibility behaviour intact.
 */

/** Lenis default. Its lerp mode is `1 - exp(-60 * lerp * dt)`; this is the `lerp`. */
const SMOOTHING = 0.1;

/** How long after the last scroll event we consider the reader to have stopped. */
const SETTLE_MS = 140;

/** Don't re-snap onto a point we are already sitting on. */
const SNAP_EPSILON = 0.02;

export type ScrollSample = {
  /** Smoothed position, in viewport heights. */
  screens: number;
  /** Screens per second, signed. */
  velocity: number;
  /** 1 down, -1 up, 0 still. */
  direction: number;
};

type Options = {
  /** Called every frame with the smoothed sample. Do imperative work here, not React state. */
  onFrame: (sample: ScrollSample) => void;
  /** Called when the reader crosses into a different section. Safe for React state. */
  onSectionChange?: (id: SectionId) => void;
  /** Snap is suppressed while this returns true — e.g. while dragging the reel. */
  isLocked?: () => boolean;
};

export function useScrollDriver({ onFrame, onSectionChange, isLocked }: Options) {
  const sampleRef = useRef<ScrollSample>({ screens: 0, velocity: 0, direction: 0 });
  const optionsRef = useRef({ onFrame, onSectionChange, isLocked });
  optionsRef.current = { onFrame, onSectionChange, isLocked };

  /** Imperative scroll-to used by the nav and the arrow keys. */
  const scrollToSection = useRef<(id: SectionId, duration?: number) => void>(() => {});

  useEffect(() => {
    let frame = 0;
    let smoothed = window.scrollY / Math.max(1, window.innerHeight);
    let previousSmoothed = smoothed;
    let lastFrameAt = performance.now();
    let lastScrollAt = 0;
    let activeSection: SectionId = sectionAt(smoothed);

    // While an animated snap or nav jump is running the reader is not driving.
    let animation: { from: number; to: number; startedAt: number; duration: number } | null = null;
    let snapLockedUntil = 0;

    const viewport = () => Math.max(1, window.innerHeight);
    const targetScreens = () => window.scrollY / viewport();
    const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const beginAnimation = (toScreens: number, duration: number) => {
      const to = Math.min(Math.max(toScreens * viewport(), 0), maxScroll());
      animation = { from: window.scrollY, to, startedAt: performance.now(), duration };
      snapLockedUntil = performance.now() + duration + 200;
    };

    scrollToSection.current = (id, duration) => {
      const section = getSection(id);
      const currentId = sectionAt(smoothed);
      beginAnimation(section.position, duration ?? keyboardDuration(currentId, id));
    };

    const onScroll = () => {
      lastScrollAt = performance.now();
      // A real scroll gesture cancels an in-flight snap so the reader always wins.
      if (animation && performance.now() - animation.startedAt > 80) animation = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const isDown = event.key === "ArrowDown" || event.key === "PageDown";
      const isUp = event.key === "ArrowUp" || event.key === "PageUp";
      if (!isDown && !isUp) return;
      // The reel owns left/right; up/down move between sections, like the reference.
      const index = SECTIONS.findIndex((section) => section.id === sectionAt(smoothed));
      const next = SECTIONS[index + (isDown ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      scrollToSection.current(next.id);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
      lastFrameAt = now;

      if (animation) {
        const elapsed = now - animation.startedAt;
        const t = Math.min(1, elapsed / animation.duration);
        const eased = easeInOutCubic(t);
        window.scrollTo(0, animation.from + (animation.to - animation.from) * eased);
        if (t >= 1) animation = null;
      }

      // Lenis lerp mode, same math as the reference.
      const alpha = 1 - Math.exp(-60 * SMOOTHING * dt);
      const target = targetScreens();
      smoothed += (target - smoothed) * alpha;
      if (Math.abs(target - smoothed) < 0.00005) smoothed = target;

      const velocity = dt > 0 ? (smoothed - previousSmoothed) / dt : 0;
      const direction = velocity > 0.0005 ? 1 : velocity < -0.0005 ? -1 : 0;
      previousSmoothed = smoothed;

      const sample = sampleRef.current;
      sample.screens = smoothed;
      sample.velocity = velocity;
      if (direction !== 0) sample.direction = direction;

      optionsRef.current.onFrame(sample);

      const nextSection = sectionAt(smoothed);
      if (nextSection !== activeSection) {
        activeSection = nextSection;
        optionsRef.current.onSectionChange?.(nextSection);
      }

      // Snap once the reader has stopped, unless something else is driving.
      const settled = now - lastScrollAt > SETTLE_MS;
      const free = !animation && now > snapLockedUntil && !optionsRef.current.isLocked?.();
      if (settled && free && Math.abs(velocity) < 0.05) {
        const candidate = snapTarget(smoothed, sample.direction || 1);
        if (candidate && Math.abs(candidate.position - smoothed) > SNAP_EPSILON) {
          // Distance-proportional, so a nudge settles quickly and a long pull still reads.
          const distance = Math.abs(candidate.position - smoothed);
          beginAnimation(candidate.position, 420 + Math.min(distance, 1) * 480);
        }
      }

      frame = window.requestAnimationFrame(tick);
    };

    /**
     * Publish the un-smoothed position immediately. Needed on mount so a deep link paints at the
     * right place instead of one frame behind, and again whenever the tab comes back — browsers
     * suspend requestAnimationFrame while a page is hidden, so nothing has been running.
     */
    const syncNow = () => {
      smoothed = targetScreens();
      previousSmoothed = smoothed;
      lastFrameAt = performance.now();
      const sample = sampleRef.current;
      sample.screens = smoothed;
      sample.velocity = 0;
      optionsRef.current.onFrame(sample);
      const nextSection = sectionAt(smoothed);
      if (nextSection !== activeSection) {
        activeSection = nextSection;
        optionsRef.current.onSectionChange?.(nextSection);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") syncNow();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    syncNow();
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { sampleRef, scrollToSection };
}

/** Page height in CSS, so the scroll length always matches the section table. */
export const scrollHeightStyle = { height: `${TOTAL_SCREENS * 100}svh` };
