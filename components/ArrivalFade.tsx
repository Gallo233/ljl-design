"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * The landing half of the reel→Work transition. The cream transport survives
 * the route swap, but the selected 4:3 film frame now remains as an object and
 * folds into the real Work identity card. Renders nothing unless the reel set
 * its marker, so a direct visit, refresh or browser-history restore stays clear.
 */
export function ArrivalFade() {
  const [show, setShow] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);

  useLayoutEffect(() => {
    try {
      if (!sessionStorage.getItem("reel:arrive")) return;
      sessionStorage.removeItem("reel:arrive");
      const returned = sessionStorage.getItem("reel:return");
      if (returned) {
        const parsed = JSON.parse(returned) as { step?: number };
        if (typeof parsed.step === "number") stepRef.current = parsed.step;
      }
    } catch {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
  }, []);

  useLayoutEffect(() => {
    if (!show) return;
    const frame = frameRef.current;
    const target = document.querySelector<HTMLElement>("[data-arrival-target]");
    if (!frame || !target) return;
    const sourceRect = frame.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const title = target.querySelector("h1")?.textContent?.trim();
    const titleNode = frame.querySelector<HTMLElement>("[data-arrival-title]");
    if (title && titleNode) titleNode.textContent = title;

    frame.style.transform = "none";
    Object.assign(frame.style, {
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
    });
    const animation = frame.animate(
      [
        {
          left: `${sourceRect.left}px`,
          top: `${sourceRect.top}px`,
          width: `${sourceRect.width}px`,
          height: `${sourceRect.height}px`,
          borderRadius: "12px",
          opacity: 1,
        },
        {
          left: `${targetRect.left}px`,
          top: `${targetRect.top}px`,
          width: `${targetRect.width}px`,
          height: `${targetRect.height}px`,
          borderRadius: "30px",
          opacity: 1,
          offset: .8,
        },
        {
          left: `${targetRect.left}px`,
          top: `${targetRect.top}px`,
          width: `${targetRect.width}px`,
          height: `${targetRect.height}px`,
          borderRadius: "30px",
          opacity: 0,
        },
      ],
      { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
    );
    // Kept in the show-dependent effect so React's development Strict Mode can
    // clean up and replay it without consuming the session marker and losing
    // the only removal timer.
    const timer = window.setTimeout(() => setShow(false), 760);
    return () => {
      window.clearTimeout(timer);
      animation.cancel();
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="arrival-veil" aria-hidden="true">
      <div className="arrival-frame" ref={frameRef}>
        <span>FRAME {String(stepRef.current + 1).padStart(2, "0")} / 06</span>
        <strong data-arrival-title>SELECTED WORK</strong>
      </div>
    </div>
  );
}
