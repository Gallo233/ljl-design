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
 *
 * `data-reveal="melt"` blocks run one state further. Their shape keeps an SVG alpha
 * threshold over the element while the type is soft, and the threshold must come off
 * once the melt lands — it would otherwise stamp the settled glyphs. So reveal moves
 * them armed → melting → settled: melting runs the un-blur under the threshold,
 * settled (a timer past the animation's worst-case end, delay included) clears every
 * class and the filter with them. The CSS in globals.css owns what each state means.
 */
const MELT_SETTLE_MS = 1400;

export function RevealRoot() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const documentRoot = document.documentElement;
    documentRoot.classList.remove("reveal-lights-on");

    // Wall-clock fail-open. Some embedded panes freeze the document timeline
    // at zero while setTimeout keeps working, which leaves every load and
    // reveal animation on its first frame — copy at opacity 0 — forever. After
    // the normal reveal window, CSS keyed on `reveal-lights-on` retires those
    // animations and shows the content; in a real browser every affected
    // animation has finished by then, so this changes nothing there. Removed
    // on cleanup so the next page's entrances still play.
    const settlers = new Set<number>();
    // Observer callbacks hand back Element; everything armed here is an HTMLElement
    // by construction, so the melt state machine narrows once at the top.
    const reveal = (target: Element) => {
      const el = target as HTMLElement;
      el.classList.remove("reveal-armed");
      if (el.dataset.reveal === "melt" && !el.classList.contains("reveal-settled")) {
        el.classList.add("reveal-melting");
        const id = window.setTimeout(() => {
          el.classList.remove("reveal-melting");
          el.classList.add("reveal-settled");
          settlers.delete(id);
        }, MELT_SETTLE_MS);
        settlers.add(id);
      }
    };

    const armed: HTMLElement[] = [];

    targets.forEach((target) => {
      const bounds = target.getBoundingClientRect();
      const onScreen = bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0;
      // A zero-area viewport (some embedded panes) makes every measurement meaningless.
      if (onScreen || window.innerHeight < 1) return;
      target.classList.add("reveal-armed");
      armed.push(target);
    });
    if (armed.length === 0) {
      return () => documentRoot.classList.remove("reveal-lights-on");
    }

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      try {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              reveal(entry.target);
              observer?.unobserve(entry.target);
            });
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
        );
        armed.forEach((target) => observer?.observe(target));
      } catch {
        // The animation is optional. If the observer cannot take responsibility for
        // the targets, hand the content back immediately instead of hiding it.
        armed.forEach(reveal);
      }
    } else {
      armed.forEach(reveal);
    }

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

    // Recheck after route scroll restoration and font/layout settling. Next navigation
    // can move the viewport after this effect's first measurement.
    const layoutFrame = window.requestAnimationFrame(sweep);
    const layoutCheck = window.setTimeout(sweep, 120);

    const restore = () => {
      if (document.visibilityState === "visible") sweep();
    };
    const restoreFromHistory = () => armed.forEach(reveal);
    document.addEventListener("visibilitychange", restore);
    window.addEventListener("pageshow", restoreFromHistory);

    // Final net: a block sitting inside the viewport that is still armed means nothing
    // is reporting. Stop trusting the machinery and show everything.
    const failsafe = window.setTimeout(() => {
      const stranded = armed.some((target) => {
        if (!target.classList.contains("reveal-armed")) return false;
        const bounds = target.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom > 0;
      });
      if (stranded) armed.forEach(reveal);
    }, 1600);

    // CSS owns the final fail-open. It still works if an exception after arming leaves
    // a class behind, or if a browser freezes the transition timeline itself.
    const lightsOn = window.setTimeout(() => {
      documentRoot.classList.add("reveal-lights-on");
    }, 1800);

    return () => {
      settlers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(failsafe);
      window.clearTimeout(lightsOn);
      window.clearTimeout(layoutCheck);
      window.cancelAnimationFrame(layoutFrame);
      documentRoot.classList.remove("reveal-lights-on");
      window.removeEventListener("scroll", sweep);
      window.removeEventListener("pageshow", restoreFromHistory);
      document.removeEventListener("visibilitychange", restore);
      observer?.disconnect();
      armed.forEach(reveal);
    };
  }, []);

  return null;
}
