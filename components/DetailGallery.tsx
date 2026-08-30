"use client";

import { useEffect, useRef } from "react";
import { attachGalleryField, condenseFigure } from "./detail-figure-fx";

/**
 * The project gallery, plus the figure effects from the viscose study — the
 * first figure condenses out of ASCII particles the first time it is seen,
 * and the whole gallery sits on a liquid ink field: the cells fuse into one
 * slab, the seams run ink, and the cursor swells and ripples the edge as it
 * passes. The markup here is exactly what the server page used to render; the
 * effects are additive canvases mounted by this effect or not at all, so a
 * failed context, a narrow window, or reduced motion leaves the plain
 * gallery untouched.
 *
 * The condensation waits for the section's own reveal to have begun (it is
 * triggered from the same intersection that reveals the gallery) and for its
 * image to have decoded; until then the figure is just a figure.
 */

export type GalleryFigure = {
  src: string;
  alt: string;
  caption: string;
};

export function DetailGallery({
  title,
  figures,
}: {
  title: string;
  figures: GalleryFigure[];
}) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Both effects want a grown-up layout; the hover field also wants a
    // pointer that can actually hover. A coarse-pointer or small window gets
    // the static fused seams only.
    if (!window.matchMedia("(min-width: 760px)").matches) return;
    const hoverEnv = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const cleanups: Array<() => void> = [];

    // The condensation, once, on the first figure's first appearance.
    const firstFigure = root.querySelector<HTMLElement>(".project-detail-figure");
    const firstImage = firstFigure?.querySelector<HTMLImageElement>("img");
    if (firstFigure && firstImage) {
      let started = false;
      let handle: { cancel: () => void } | null = null;
      const io = new IntersectionObserver(
        (entries) => {
          if (started || !entries.some((entry) => entry.isIntersecting)) return;
          started = true;
          io.disconnect();
          // The lazy image may still be arriving; decode, then condense.
          Promise.resolve(firstImage.decode ? firstImage.decode() : null)
            .catch(() => {})
            .then(() => {
              if (!firstImage.isConnected) return;
              handle = condenseFigure(firstFigure, firstImage);
              if (handle) cleanups.push(() => handle?.cancel());
            });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
      );
      io.observe(firstFigure);
      cleanups.push(() => {
        io.disconnect();
        started = true;
      });
    }

    const field = attachGalleryField(root, { hoverEnv });
    if (field) cleanups.push(field.cancel);

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [figures]);

  return (
    <section
      ref={rootRef}
      className="project-detail-gallery"
      aria-label={`${title} project figures`}
      data-reveal
    >
      {figures.map((figure, index) => (
        <figure
          className={`project-detail-figure project-detail-figure--${index + 1}`}
          key={figure.src}
        >
          <img src={figure.src} alt={figure.alt} loading="lazy" />
          <figcaption>{figure.caption}</figcaption>
        </figure>
      ))}
    </section>
  );
}
