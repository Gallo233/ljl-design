"use client";

/**
 * Let a routed page scroll.
 *
 * `styles.css` locks the document by default and only releases it for one
 * state:
 *
 *   body { overflow: hidden; }
 *   body[data-state="home"] { overflow: visible; }
 *
 * Combined with `experience.css`'s `html { overflow-x: clip }`, the body's
 * overflow is what the viewport uses, so a routed page that never sets the
 * attribute cannot be scrolled at all.
 *
 * That attribute used to be set as a side effect of mounting the old Live2D
 * assistant, which meant deleting the assistant silently took the page's
 * scrolling with it. Scrolling is a property of the page, not of whatever
 * character happens to be on it, so it says so here instead.
 */

import { useEffect } from "react";

export function PageScrollState({ state = "home" }: { state?: string }) {
  useEffect(() => {
    const previous = document.body.dataset.state;
    document.body.dataset.state = state;
    return () => {
      if (previous === undefined) delete document.body.dataset.state;
      else document.body.dataset.state = previous;
    };
  }, [state]);

  return null;
}
