"use client";

import { useEffect } from "react";

/**
 * Scroll-entry choreography without wrappers: server markup tags blocks with
 * `data-reveal`, this arms them and lets them land as they come into view.
 *
 * The hiding is deliberately **per element and applied by JavaScript**, never by a
 * global attribute. CSS that hides content on its own can strand it forever if the
 * script that was supposed to reveal it never runs its side of the bargain; here a
 * block is only ever hidden after this code has taken responsibility for it, and only
 * if it is out of view at the time. Anything already on screen is never touched.
 *
 * Three ways a block comes back, in order of preference: the observer, a scroll sweep
 * for browsers where the observer is present but silent, and a stranded-in-view timer.
 * A lost animation costs nothing; invisible copy costs everything.
 */
export function RevealRoot() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const reveal = (target: Element) => target.classList.remove("reveal-armed");
    const armed: HTMLElement[] = [];

    targets.forEach((target) => {
      const bounds = target.getBoundingClientRect();
      const onScreen = bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0;
      // A zero-area viewport (some embedded panes) makes every measurement meaningless.
      if (onScreen || window.innerHeight < 1) return;
      target.classList.add("reveal-armed");
      armed.push(target);
    });
    if (armed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    armed.forEach((target) => observer.observe(target));

    // Fallback for browsers where the observer reports some targets but silently
    // misses a later one. Keep sweeping until every armed target is visible; a
    // single early observer callback is not proof that every future callback lands.
    const sweep = () => {
      let remaining = 0;
      armed.forEach((target) => {
        if (!target.classList.contains("reveal-armed")) return;
        const bounds = target.getBoundingClientRect();
        if (bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0) reveal(target);
        else remaining += 1;
      });
      if (remaining === 0) window.removeEventListener("scroll", sweep);
    };
    window.addEventListener("scroll", sweep, { passive: true });

    // Final net: a block sitting inside the viewport that is still armed means nothing
    // is reporting. Stop trusting the machinery and show everything.
    const failsafe = window.setTimeout(() => {
      const stranded = armed.some((target) => {
        if (!target.classList.contains("reveal-armed")) return false;
        const bounds = target.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom > 0;
      });
      if (stranded) armed.forEach(reveal);
    }, 3000);

    return () => {
      window.clearTimeout(failsafe);
      window.removeEventListener("scroll", sweep);
      observer.disconnect();
      armed.forEach(reveal);
    };
  }, []);

  return null;
}
