"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { JoiWebEmbed } from "../JoiWebEmbed";
import { JoiMobileIPhoneShowcase } from "../joi-mobile-iphone/JoiMobileIPhoneShowcase";
import { JOI_MOBILE_APPETIZE_URL } from "../joi-mobile-iphone/appetize";
import {
  createLiquidStage,
  dampFrame,
  decayFrame,
  type LiquidStage,
} from "./liquidStage";
import {
  finishIncomingWorkHandoff,
  startWorkRouteHandoff,
} from "./routeHandoff";
import styles from "./work-experience.module.css";

export type WorkExperienceProject = {
  slug: "joi" | "joi-mobile";
  index: string;
  title: string;
  tagline: string;
  kind: string;
  repo?: string;
  poster?: string;
  next: {
    href: string;
    index: string;
    title: string;
  };
};

type ExperienceMode =
  | "browse"
  | "entering"
  | "interact"
  | "leaving"
  | "reduced";

type JoiPresentation = "docked" | "pet";

const ANCHORS = [0, 0.5, 1] as const;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (from: number, to: number, value: number) => {
  const x = clamp01((value - from) / Math.max(0.0001, to - from));
  return x * x * (3 - 2 * x);
};
const pulse = (value: number, start: number, peak: number, end: number) =>
  smoothstep(start, peak, value) * (1 - smoothstep(peak, end, value));

export function WorkExperienceShell({ project }: { project: WorkExperienceProject }) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const liquidHostRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const apertureRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLAnchorElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const gateRef = useRef<HTMLButtonElement>(null);
  const apertureBeforeInteractRef = useRef<{ rect: DOMRect; borderRadius: string } | null>(null);
  const apertureAnimationRef = useRef<Animation | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const returnModeRef = useRef<"browse" | "reduced">("browse");
  const leaveTimerRef = useRef<number | null>(null);
  const routeLeavingRef = useRef(false);
  const lowQualityRef = useRef(false);
  const liquidRef = useRef<LiquidStage | null>(null);
  const liquidFailedRef = useRef(false);
  const liquidGeometryCatchupRef = useRef(true);
  const rafRef = useRef(0);
  const frameTimeRef = useRef(0);
  const arriveRafRef = useRef(0);
  const trackRef = useRef({ top: 0, span: 1 });
  const availabilityRef = useRef(-1);
  const releaseEngagedRef = useRef(false);
  const targetProgressRef = useRef(0);
  const progressRef = useRef(0);
  const snapSuspendedRef = useRef(false);
  const dragStartProgressRef = useRef(0);
  const dragRef = useRef({
    possible: false,
    active: false,
    id: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  });
  const pointerRef = useRef({
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    previousTime: 0,
    targetPresence: 0,
    presence: 0,
    wake: 0,
  });
  const [mode, setMode] = useState<ExperienceMode>("browse");
  const modeRef = useRef<ExperienceMode>("browse");
  const primedRef = useRef(false);
  const [experiencePrimed, setExperiencePrimed] = useState(false);
  const [routeLeaving, setRouteLeaving] = useState<"next" | "reel" | null>(null);
  const [joiPresentation, setJoiPresentation] = useState<JoiPresentation>("docked");

  const isMobile = project.slug === "joi-mobile";
  const palette = useMemo(
    () => isMobile
      ? { ink: "#4b4356", accent: "#bba9c9", page: "#eee9f0", text: "#f7f3f8", signal: "#dacde2" }
      : { ink: "#d6e1e1", accent: "#6f979d", page: "#eef2f1", text: "#162322", signal: "#41676d" },
    [isMobile],
  );

  const restoreActivationFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const previous = returnFocusRef.current;
      const target = previous?.isConnected ? previous : gateRef.current;
      target?.focus({ preventScroll: true });
    });
  }, []);

  const measureTrack = useCallback(() => {
    const root = rootRef.current;
    if (!root) return trackRef.current;
    const top = window.scrollY + root.getBoundingClientRect().top;
    trackRef.current = {
      top,
      span: Math.max(1, root.offsetHeight - window.innerHeight),
    };
    return trackRef.current;
  }, []);

  const readTrack = useCallback(() => trackRef.current, []);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(function draw(now) {
      rafRef.current = 0;
      const root = rootRef.current;
      if (!root || modeRef.current === "reduced") return;
      const deltaSeconds = frameTimeRef.current
        ? Math.min(0.05, (now - frameTimeRef.current) / 1000)
        : 1 / 60;
      frameTimeRef.current = now;

      const target = targetProgressRef.current;
      const previousProgress = progressRef.current;
      const progressChanged = Math.abs(target - previousProgress) > 0.00015;
      // Native scroll already supplies an inertial position stream. A second
      // low-pass here made the material lag behind the page and caused small
      // wheel gestures to feel ignored. Snap motion is eased at its source, so
      // the visual driver can follow the authoritative position directly.
      progressRef.current = target;
      const progress = target;
      const liquid = liquidRef.current;
      // Read last frame's committed geometry before writing inherited CSS
      // variables. `render()` then consumes this cache without triggering a
      // same-frame style/layout flush. One final frame is scheduled below to
      // bring the cache to the newly committed transform.
      if (liquid && (progressChanged || liquidGeometryCatchupRef.current)) {
        liquid.measure();
        liquidGeometryCatchupRef.current = progressChanged;
      }
      if (progress > 0.2 && !primedRef.current) {
        primedRef.current = true;
        setExperiencePrimed(true);
      }
      const spread = smoothstep(0.04, 0.38, progress);
      const hold = smoothstep(0.31, 0.5, progress) * (1 - smoothstep(0.67, 0.84, progress));
      const release = smoothstep(0.67, 0.96, progress);
      root.style.setProperty("--work-progress", progress.toFixed(5));
      root.style.setProperty("--work-spread", spread.toFixed(5));
      root.style.setProperty("--work-hold", hold.toFixed(5));
      root.style.setProperty("--work-release", release.toFixed(5));

      const pageOwnsInput = modeRef.current === "browse";
      const identityAvailable = pageOwnsInput && progress < 0.86;
      const actionsAvailable = pageOwnsInput && progress > 0.12 && progress < 0.86;
      const nextAvailable = pageOwnsInput && progress > 0.63;
      const gateAvailable = pageOwnsInput && progress <= 0.86;
      const availability = (identityAvailable ? 1 : 0)
        | (actionsAvailable ? 2 : 0)
        | (nextAvailable ? 4 : 0)
        | (gateAvailable ? 8 : 0);
      if (availability !== availabilityRef.current) {
        const setAvailable = (element: HTMLElement | null, available: boolean) => {
          if (!element) return;
          element.inert = !available;
          if (available) element.removeAttribute("aria-hidden");
          else element.setAttribute("aria-hidden", "true");
        };
        setAvailable(identityRef.current, identityAvailable);
        setAvailable(actionsRef.current, actionsAvailable);
        setAvailable(nextRef.current, nextAvailable);
        setAvailable(gateRef.current, gateAvailable);
        availabilityRef.current = availability;
      }

      // `filter` is a render surface even at blur(0px), so it is switched at a
      // threshold instead of being driven continuously by var(--work-release).
      // Crossing is rare; the attribute write is not a per-frame cost.
      const releaseEngaged = release > 0.015;
      if (releaseEngaged !== releaseEngagedRef.current) {
        releaseEngagedRef.current = releaseEngaged;
        if (releaseEngaged) root.dataset.release = "on";
        else delete root.dataset.release;
      }

      const pointer = pointerRef.current;
      const presenceRate = pointer.targetPresence > pointer.presence ? 0.22 : 0.075;
      pointer.presence = dampFrame(
        pointer.presence,
        pointer.targetPresence,
        presenceRate,
        deltaSeconds,
      );
      pointer.wake = decayFrame(pointer.wake, 0.91, deltaSeconds);

      if (liquid) {
        liquid.render({
          progress,
          time: now * 0.001,
          pointerX: pointer.x,
          pointerY: pointer.y,
          pointerPresence: pointer.presence,
          pointerWake: lowQualityRef.current ? 0 : pointer.wake,
          shapeWeights: [
            1 - smoothstep(0.79, 0.98, progress),
            0.38 + 0.62 * smoothstep(0.03, 0.28, progress),
            smoothstep(0.16, 0.4, progress) * (1 - smoothstep(0.79, 0.98, progress)),
            smoothstep(0.7, 0.94, progress),
          ],
          linkWeights: [
            pulse(progress, 0.025, 0.2, 0.52),
            pulse(progress, 0.18, 0.43, 0.78),
            pulse(progress, 0.66, 0.84, 0.98),
          ],
        });
        // DOM cards remain the readable fallback until the GPU has completed
        // an actual draw. Marking readiness at renderer construction leaves a
        // pale one-frame hole during route handoff or slow shader compilation.
        if (!liquidFailedRef.current && root.dataset.liquidReady !== "true") {
          root.dataset.liquidReady = "true";
        }
      }

      const pointerMoving = pointer.wake > 0.008 || Math.abs(pointer.targetPresence - pointer.presence) > 0.008;
      if (progressChanged || pointerMoving) scheduleFrame();
    });
  }, []);

  /*
   * Snapping is the browser's job now.
   *
   * The previous driver watched for scroll rest, projected a coast velocity and
   * then animated `window.scrollTo` on the main thread for 300-520ms. Every one
   * of those steps runs after the compositor has already committed a frame, so
   * the material was always answering an input the page had finished handling —
   * which is what "not smooth" was. `scroll-snap-type` puts the same three
   * anchors on the compositor, where the fling curve, the rubber band and the
   * touch tracking are native.
   *
   * It is set on the scrolling element rather than in the stylesheet because
   * `html` is shared with every other route.
   */
  const setSnap = useCallback((enabled: boolean) => {
    const html = document.documentElement;
    if (enabled && !snapSuspendedRef.current) html.style.scrollSnapType = "y mandatory";
    else html.style.scrollSnapType = "";
  }, []);

  const suspendSnap = useCallback(() => {
    snapSuspendedRef.current = true;
    document.documentElement.style.scrollSnapType = "";
  }, []);

  const resumeSnap = useCallback(() => {
    snapSuspendedRef.current = false;
    if (modeRef.current === "browse") document.documentElement.style.scrollSnapType = "y mandatory";
  }, []);

  /** Native smooth scroll to an anchor, with arrival reported by polling —
   *  `scrollend` is not universal and a snap can land a frame after it. */
  const settleTo = useCallback((anchor: number, onDone?: () => void) => {
    const { top, span } = readTrack();
    const targetY = Math.round(top + span * anchor);
    window.cancelAnimationFrame(arriveRafRef.current);
    arriveRafRef.current = 0;
    if (Math.abs(window.scrollY - targetY) < 2) {
      targetProgressRef.current = anchor;
      scheduleFrame();
      onDone?.();
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: targetY, behavior: reduced ? "instant" : "smooth" });
    if (!onDone) return;
    const deadline = performance.now() + 1200;
    const waitForArrival = () => {
      if (Math.abs(window.scrollY - targetY) < 2 || performance.now() > deadline) {
        arriveRafRef.current = 0;
        onDone();
        return;
      }
      arriveRafRef.current = window.requestAnimationFrame(waitForArrival);
    };
    arriveRafRef.current = window.requestAnimationFrame(waitForArrival);
  }, [readTrack, scheduleFrame]);

  const nearestAnchor = useCallback((value: number) => {
    let best = 0;
    for (let index = 1; index < ANCHORS.length; index += 1) {
      if (Math.abs(ANCHORS[index] - value) < Math.abs(ANCHORS[best] - value)) best = index;
    }
    return best;
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    availabilityRef.current = -1;
    liquidGeometryCatchupRef.current = true;
    scheduleFrame();
  }, [mode, scheduleFrame]);

  useEffect(() => {
    if (mode !== "browse") {
      setSnap(false);
      return;
    }
    // One frame of grace so a restored or handed-off scroll position is laid
    // out before mandatory snapping starts pulling on it.
    const frame = window.requestAnimationFrame(() => setSnap(true));
    return () => {
      window.cancelAnimationFrame(frame);
      setSnap(false);
    };
  }, [mode, setSnap]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (media.matches) {
        modeRef.current = "reduced";
        setMode("reduced");
      } else if (modeRef.current === "reduced") {
        modeRef.current = "browse";
        setMode("browse");
      }
    };
    apply();
    media.addEventListener?.("change", apply);
    return () => media.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    const host = liquidHostRef.current;
    const root = rootRef.current;
    const shapes = [identityRef.current, apertureRef.current, actionsRef.current, nextRef.current];
    if (!host || !root || shapes.some((shape) => !shape) || modeRef.current === "reduced") return;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const lowQuality = window.innerWidth < 700 || navigator.hardwareConcurrency <= 4 || memory <= 4;
    lowQualityRef.current = lowQuality;
    liquidFailedRef.current = false;
    root.dataset.qualityTier = lowQuality ? "low" : "full";
    try {
      liquidRef.current = createLiquidStage(
        host,
        shapes as HTMLElement[],
        { ink: palette.ink, accent: palette.accent, paper: palette.page },
        () => {
          liquidFailedRef.current = true;
          root.dataset.liquidReady = "false";
          root.dataset.liquidFailure = "context-lost";
        },
      );
      scheduleFrame();
    } catch (error) {
      console.warn("[work-experience] liquid stage unavailable; using CSS fallback", error);
      root.dataset.liquidReady = "false";
    }
    return () => {
      liquidRef.current?.dispose();
      liquidRef.current = null;
      liquidFailedRef.current = false;
      delete root.dataset.liquidReady;
      delete root.dataset.liquidFailure;
      delete root.dataset.qualityTier;
    };
  }, [palette, scheduleFrame]);

  useEffect(() => {
    const { top, span } = measureTrack();
    const initial = clamp01((window.scrollY - top) / span);
    targetProgressRef.current = initial;
    progressRef.current = initial;
    scheduleFrame();

    /*
     * The listener no longer models the gesture. It used to buffer wheel
     * deltas, integrate a velocity, guess where the fling would coast to and
     * arm a 280ms rest timer — a whole second input model competing with the
     * one the compositor already runs. All that is left is reading where the
     * page actually is.
     */
    const onScroll = () => {
      if (modeRef.current === "interact" || modeRef.current === "reduced") return;
      const track = readTrack();
      targetProgressRef.current = clamp01((window.scrollY - track.top) / track.span);
      scheduleFrame();
    };
    const onResize = () => {
      const track = measureTrack();
      targetProgressRef.current = clamp01((window.scrollY - track.top) / track.span);
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
      // Re-read on resize: deciding the tier once, during a mount that can
      // happen at an interim window size, left desktops rendering at the
      // phone tier for the life of the page.
      const lowQuality = window.innerWidth < 700
        || navigator.hardwareConcurrency <= 4
        || memory <= 4;
      if (lowQuality !== lowQualityRef.current) {
        lowQualityRef.current = lowQuality;
        if (rootRef.current) rootRef.current.dataset.qualityTier = lowQuality ? "low" : "full";
      }
      scheduleFrame();
    };
    const resizeObserver = new ResizeObserver(onResize);
    if (rootRef.current) resizeObserver.observe(rootRef.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [measureTrack, readTrack, scheduleFrame]);

  useEffect(() => {
    if (mode !== "interact") return;
    const html = document.documentElement;
    const body = document.body;
    const previousOverflow = html.style.overflow;
    const previousOverscroll = html.style.overscrollBehavior;
    const previousBodyPaddingRight = body.style.paddingRight;
    const previousInteractionFlag = body.dataset.workExperienceInteract;
    const lockedScrollY = window.scrollY;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    if (scrollbarWidth > 0) {
      const bodyPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
    }
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.dataset.workExperienceInteract = "true";
    window.requestAnimationFrame(() => exitRef.current?.focus({ preventScroll: true }));
    const preventPageScroll = (event: WheelEvent | TouchEvent) => {
      // Events dispatched inside the Joi iframe belong to its own document and
      // never reach this listener. Parent-surface wheel/touch still needs an
      // explicit guard: overflow:hidden alone can be bypassed by smooth-scroll
      // styles and synthetic wheel streams in some engines.
      event.preventDefault();
    };
    const holdScrollPosition = () => {
      if (Math.abs(window.scrollY - lockedScrollY) < 0.5) return;
      window.scrollTo({ top: lockedScrollY, behavior: "instant" });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setJoiPresentation("docked");
        modeRef.current = "leaving";
        setMode("leaving");
        if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = window.setTimeout(() => {
          const returnMode = returnModeRef.current;
          modeRef.current = returnMode;
          setMode(returnMode);
          restoreActivationFocus();
          leaveTimerRef.current = null;
        }, 220);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", preventPageScroll, { passive: false, capture: true });
    window.addEventListener("touchmove", preventPageScroll, { passive: false, capture: true });
    window.addEventListener("scroll", holdScrollPosition, { passive: true });
    return () => {
      html.style.overflow = previousOverflow;
      html.style.overscrollBehavior = previousOverscroll;
      body.style.paddingRight = previousBodyPaddingRight;
      if (previousInteractionFlag === undefined) {
        delete body.dataset.workExperienceInteract;
      } else {
        body.dataset.workExperienceInteract = previousInteractionFlag;
      }
      window.scrollTo({ top: lockedScrollY, behavior: "instant" });
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", preventPageScroll, true);
      window.removeEventListener("touchmove", preventPageScroll, true);
      window.removeEventListener("scroll", holdScrollPosition);
    };
  }, [mode, restoreActivationFocus]);

  useEffect(() => () => {
    window.cancelAnimationFrame(rafRef.current);
    window.cancelAnimationFrame(arriveRafRef.current);
    rafRef.current = 0;
    frameTimeRef.current = 0;
    arriveRafRef.current = 0;
    document.documentElement.style.scrollSnapType = "";
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.driverReady = "true";
    return () => { delete root.dataset.driverReady; };
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = identityRef.current?.getBoundingClientRect();
      if (target) finishIncomingWorkHandoff(target, window.location.pathname);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [project.slug]);

  useLayoutEffect(() => {
    if (mode !== "interact") {
      apertureAnimationRef.current?.cancel();
      apertureAnimationRef.current = null;
      return;
    }
    const aperture = apertureRef.current;
    const before = apertureBeforeInteractRef.current;
    apertureBeforeInteractRef.current = null;
    if (!aperture || !before || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const after = aperture.getBoundingClientRect();
    if (after.width < 1 || after.height < 1) return;
    // FLIP the accepted aperture expansion. Layout jumps to the final viewport
    // size once, while a compositor-only transform recreates the same visual
    // opening without 620ms of ResizeObserver/framebuffer churn.
    const scaleX = before.rect.width / after.width;
    const scaleY = before.rect.height / after.height;
    apertureAnimationRef.current = aperture.animate([
      {
        transform: `translate3d(-50%, -50%, 0) scale(${scaleX}, ${scaleY})`,
        borderRadius: before.borderRadius,
      },
      {
        transform: "translate3d(-50%, -50%, 0) scale(1, 1)",
        borderRadius: "26px",
      },
    ], {
      duration: 620,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "none",
    });
    apertureAnimationRef.current.addEventListener("finish", () => {
      apertureAnimationRef.current = null;
    }, { once: true });
  }, [mode]);

  const enterExperience = useCallback(() => {
    if (modeRef.current === "entering" || modeRef.current === "interact") return;
    setJoiPresentation("docked");
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) returnFocusRef.current = activeElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    returnModeRef.current = reduced ? "reduced" : "browse";
    if (reduced) {
      modeRef.current = "interact";
      setMode("interact");
      if (!primedRef.current) {
        primedRef.current = true;
        setExperiencePrimed(true);
      }
      return;
    }
    modeRef.current = "entering";
    setMode("entering");
    if (!primedRef.current) {
      primedRef.current = true;
      setExperiencePrimed(true);
    }
    settleTo(ANCHORS[1], () => {
      const aperture = apertureRef.current;
      apertureBeforeInteractRef.current = aperture
        ? { rect: aperture.getBoundingClientRect(), borderRadius: getComputedStyle(aperture).borderRadius }
        : null;
      modeRef.current = "interact";
      setMode("interact");
    });
  }, [settleTo]);

  const leaveToPage = useCallback((presentation: JoiPresentation) => {
    apertureAnimationRef.current?.cancel();
    apertureAnimationRef.current = null;
    setJoiPresentation(presentation);
    modeRef.current = "leaving";
    setMode("leaving");
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      const returnMode = returnModeRef.current;
      modeRef.current = returnMode;
      setMode(returnMode);
      restoreActivationFocus();
      leaveTimerRef.current = null;
    }, 220);
  }, [restoreActivationFocus]);

  const leaveExperience = useCallback(() => {
    leaveToPage("docked");
  }, [leaveToPage]);

  const floatJoi = useCallback(() => {
    leaveToPage("pet");
  }, [leaveToPage]);

  const handleJoiPresentationChange = useCallback((next: JoiPresentation) => {
    const wasPet = joiPresentation === "pet";
    setJoiPresentation(next);
    // A character double-click restores the full Joi surface and hands input
    // back in the same gesture. The visitor should not land behind a second
    // opaque "enter" gate after explicitly restoring the window.
    if (wasPet && next === "docked" && modeRef.current === "browse") {
      enterExperience();
    }
  }, [enterExperience, joiPresentation]);

  const navigateWithHandoff = useCallback(async (
    event: React.MouseEvent<HTMLAnchorElement>,
    destination: string,
    kind: "next" | "reel",
  ) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.altKey
      || event.shiftKey
    ) return;
    event.preventDefault();
    if (routeLeavingRef.current) return;
    routeLeavingRef.current = true;
    setRouteLeaving(kind);

    if (kind === "reel") {
      try {
        if (!sessionStorage.getItem("reel:return")) {
          sessionStorage.setItem("reel:return", JSON.stringify({
            step: Math.max(0, Number(project.index) - 1),
          }));
        }
      } catch {}
    }

    const progress = progressRef.current;
    const sourceElement = kind === "next"
      ? nextRef.current
      : progress < 0.3
        ? identityRef.current
        : progress > 0.74
          ? nextRef.current
          : apertureRef.current;
    if (!sourceElement) {
      router.push(destination, { scroll: kind !== "reel" });
      return;
    }

    const targetPalette = destination.includes("joi-mobile")
      ? { ink: "#4b4356", accent: "#bba9c9", page: "#eee9f0", text: "#f7f3f8", signal: "#dacde2" }
      : destination.includes("/work/joi")
        ? { ink: "#d6e1e1", accent: "#6f979d", page: "#eef2f1", text: "#162322", signal: "#41676d" }
        : destination.includes("/play/night-tide")
          ? { ink: "#306c8a", accent: "#9ed4ea", page: "#e7f0f4", text: "#f5f9fb", signal: "#d8eef7" }
          : { ink: "#17201f", accent: "#a28b70", page: "#e9e8e2", text: "#f2f4ee", signal: "#cfbea8" };

    await startWorkRouteHandoff({
      kind,
      source: sourceElement.getBoundingClientRect(),
      title: kind === "next" ? project.next.title : project.title,
      label: kind === "next" ? `NEXT / ${project.next.index}` : `RETURN / FRAME ${project.index}`,
      destination,
      palette: kind === "next" ? targetPalette : palette,
    });
    router.push(destination, { scroll: kind !== "reel" });
  }, [palette, project.index, project.next.index, project.next.title, project.title, router]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    const now = performance.now();
    const speed = pointer.previousTime > 0
      ? Math.hypot(event.clientX - pointer.previousX, event.clientY - pointer.previousY)
        / Math.max(8, now - pointer.previousTime)
      : 0;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.previousX = event.clientX;
    pointer.previousY = event.clientY;
    pointer.previousTime = now;
    pointer.targetPresence = 1;
    pointer.wake = Math.max(pointer.wake, clamp01(speed * 0.7));
    scheduleFrame();

    const drag = dragRef.current;
    if (!drag.possible || event.pointerId !== drag.id || modeRef.current !== "browse") return;
    const totalX = event.clientX - drag.startX;
    const totalY = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(totalX, totalY) < 7) return;
      if (Math.abs(totalY) >= Math.abs(totalX) * 0.9) {
        drag.possible = false;
        return;
      }
      drag.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      // Mandatory snapping would fight a scrollTo on every pointer move, so
      // the pointer takes the position and hands it back on release.
      suspendSnap();
    }
    event.preventDefault();
    const deltaX = event.clientX - drag.lastX;
    const currentTime = performance.now();
    const deltaTime = Math.max(8, currentTime - drag.lastTime);
    const { top, span } = readTrack();
    const nextY = window.scrollY - deltaX * 2.25;
    const clampedY = Math.min(top + span, Math.max(top, nextY));
    window.scrollTo({
      top: clampedY,
      behavior: "instant",
    });
    // `scroll` dispatch is asynchronous in browsers (and especially visible
    // with fast pointer streams). Pointer-up may therefore run before onScroll
    // has copied this position into the shared track. Write it here as the
    // authoritative drag value so release projects from where the card visibly
    // is, rather than from the anchor where the drag began.
    targetProgressRef.current = clamp01((clampedY - top) / span);
    scheduleFrame();
    drag.velocity = (-deltaX * 2.25) / deltaTime;
    drag.lastX = event.clientX;
    drag.lastTime = currentTime;
  }, [readTrack, scheduleFrame, suspendSnap]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (modeRef.current !== "browse" || event.button > 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("a,button,iframe,[data-experience-surface],[data-liquid-card]")) return;
    window.cancelAnimationFrame(arriveRafRef.current);
    arriveRafRef.current = 0;
    // The cancelled settle owned the promise to switch snapping back on. Take
    // it back now: if this gesture becomes a drag it suspends again a few
    // pixels later, and if it stays a click the page is left snapping.
    resumeSnap();
    dragStartProgressRef.current = targetProgressRef.current;
    dragRef.current = {
      possible: true,
      active: false,
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
    };
  }, [resumeSnap]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (event.pointerId !== drag.id) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const wasActive = drag.active;
    const projectedVelocity = drag.velocity;
    drag.possible = false;
    drag.active = false;
    if (!wasActive) return;
    // Resolve the drag ourselves — releasing to the browser's nearest-anchor
    // rule would ignore a long, deliberate pull that has not yet crossed the
    // midpoint. One state per gesture, in the direction the hand was going.
    const { span } = readTrack();
    const start = dragStartProgressRef.current;
    const current = targetProgressRef.current;
    const projected = clamp01(current + clamp01(Math.abs(projectedVelocity)) * Math.sign(projectedVelocity) * 115 / Math.max(1, span));
    const direction = Math.sign(current - start) || Math.sign(projectedVelocity);
    const decisive = Math.abs(current - start) >= 0.014;
    const originIndex = nearestAnchor(start);
    const targetIndex = decisive && direction !== 0
      ? Math.min(ANCHORS.length - 1, Math.max(0, originIndex + direction))
      : nearestAnchor(projected);
    // Snapping stays suspended until the settle lands, so mandatory snapping
    // does not fight the smooth scroll it would otherwise agree with.
    settleTo(ANCHORS[targetIndex], resumeSnap);
  }, [nearestAnchor, readTrack, resumeSnap, settleTo]);

  const active = mode === "interact";
  const starting = mode === "entering";

  return (
    <main
      className={`${styles.root} ${isMobile ? styles.mobile : styles.web}`}
      data-mode={mode}
      data-route-leaving={routeLeaving ?? undefined}
      ref={rootRef}
    >
      <div className={styles.snapTrack} aria-hidden="true">
        <i /><i /><i />
      </div>

      <nav className={styles.nav} aria-label="Project navigation">
        <Link className={styles.wordmark} href="/">GALLO</Link>
        <div>
          <Link href="/selected-work" onClick={(event) => void navigateWithHandoff(event, "/selected-work", "reel")}>BACK TO REEL</Link>
          {project.repo && <a href={project.repo} target="_blank" rel="noreferrer">GITHUB</a>}
        </div>
      </nav>

      <div
        className={styles.stage}
        ref={stageRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          pointerRef.current.targetPresence = 0;
          scheduleFrame();
        }}
      >
        <div className={styles.ambient} aria-hidden="true" />
        <div className={styles.liquidHost} ref={liquidHostRef} aria-hidden="true" />

        <div className={`${styles.shape} ${styles.identity}`} ref={identityRef} data-liquid-card data-arrival-target>
          <p className={styles.kicker}>{project.index} / {project.kind}</p>
          <div className={styles.titleWrap}>
            <h1>{project.title}</h1>
            <span className={styles.titleMelt} aria-hidden="true">{project.title}</span>
          </div>
          <p className={styles.tagline}>{project.tagline}</p>
          <button className={styles.identityAction} type="button" onClick={enterExperience} disabled={starting}>
            {starting ? "OPENING" : isMobile ? "ENTER DEVICE GALLERY" : "START JOI"}
            <span aria-hidden="true">↘</span>
          </button>
        </div>

        <section
          className={`${styles.shape} ${styles.aperture}`}
          ref={apertureRef}
          aria-label={isMobile ? "Joi Mobile device experience" : "Live Joi web experience"}
          data-liquid-card
        >
          <div className={styles.apertureChrome} aria-hidden="true">
            <span>{isMobile ? "DEVICE WELL / 01" : "LIVE APERTURE / 01"}</span>
            <span>{active ? "INPUT: EXPERIENCE" : "INPUT: PAGE"}</span>
          </div>
          <div className={styles.experienceSurface} data-experience-surface>
            {isMobile ? (
              <JoiMobileIPhoneShowcase
                poster={project.poster ?? "/work/joi-mobile-home-screen.webp"}
                active={active}
              />
            ) : (
              <JoiWebEmbed
                stage
                active={active}
                presentation={joiPresentation}
                start={experiencePrimed}
                onExitRequested={leaveExperience}
                onPresentationChange={handleJoiPresentationChange}
              />
            )}
          </div>
          {!active && (
            <button className={styles.apertureGate} type="button" onClick={enterExperience} disabled={starting} ref={gateRef}>
              <span>{starting ? "ALIGNING SIGNAL" : "CLICK TO HAND OVER INPUT"}</span>
              <strong>{starting ? "···" : "ENTER"}</strong>
            </button>
          )}
          {active && !isMobile && (
            <span className={styles.resizeHandle} aria-hidden="true">
              <i /> RESIZE
            </span>
          )}
        </section>

        <div className={`${styles.shape} ${styles.actions}`} ref={actionsRef} data-liquid-card>
          <span className={styles.panelLabel}>ACCESS</span>
          <div>
            <button type="button" onClick={enterExperience} disabled={starting}>
              {isMobile ? "ROTATE DEVICE" : "LIVE SESSION"}
            </button>
            {isMobile && (
              <a
                href={JOI_MOBILE_APPETIZE_URL}
                target="_blank"
                rel="noreferrer"
              >
                OPEN IOS BUILD ↗
              </a>
            )}
            {project.repo && <a href={project.repo} target="_blank" rel="noreferrer">SOURCE ↗</a>}
          </div>
        </div>

        <Link
          className={`${styles.shape} ${styles.next}`}
          href={project.next.href}
          ref={nextRef}
          data-liquid-card
          onClick={(event) => void navigateWithHandoff(event, project.next.href, "next")}
        >
          <span>NEXT / {project.next.index}</span>
          <strong>{project.next.title}</strong>
          <b aria-hidden="true">→</b>
        </Link>

        <div className={styles.rail} aria-label="Experience position">
          {ANCHORS.map((anchor, index) => (
            <button
              key={anchor}
              type="button"
              onClick={() => settleTo(anchor)}
              aria-label={`Go to ${["project identity", "project experience", "next project"][index]}`}
            >
              <span />
            </button>
          ))}
        </div>

        <p className={styles.inputHint} aria-live="polite">
          {active
            ? "EXPERIENCE HAS INPUT · PRESS ESC TO RETURN"
            : "SCROLL OR DRAG THE OPEN FIELD · RELEASE TO SNAP"}
        </p>
      </div>
      {active && (
        <div className={styles.experienceControls}>
          {!isMobile && (
            <button type="button" onClick={floatJoi}>
              FLOAT JOI <span aria-hidden="true">PET</span>
            </button>
          )}
          <button type="button" onClick={leaveExperience} ref={exitRef}>
            RETURN TO PAGE <span aria-hidden="true">ESC</span>
          </button>
        </div>
      )}
    </main>
  );
}
