"use client";

import { useEffect, useState } from "react";

/**
 * The landing half of the reel→detail transition. The lab leaves under a cream veil;
 * any page that mounts this fades up from the same cream, so the route swap happens
 * entirely behind one continuous colour. Renders nothing unless the marker the reel
 * set is present — a direct visit or a refresh sees no veil at all.
 */
export function ArrivalFade() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("reel:arrive")) return;
      sessionStorage.removeItem("reel:arrive");
    } catch {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
    const timer = window.setTimeout(() => setShow(false), 460);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;
  return <div className="arrival-veil" aria-hidden="true" />;
}
