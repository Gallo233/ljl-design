"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./lab.module.css";
import { labItems, type LabItem } from "./labData";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const sitePath = (path: string) => `${basePath}${path}`;

/**
 * The filing drawer.
 *
 * Interaction model: rows are folders. Hovering a row floats a preview card after the
 * cursor (rAF lerp, no library); clicking expands the folder inline into its dossier.
 * On touch or reduced motion the floating card stands down — the expanded dossier
 * carries the same content, so nothing is hover-only.
 *
 * The folder visual language is the point: this page is where things are *filed*,
 * including honourably killed ones. (Awaiting the author's reference image — layout
 * lives entirely in lab.module.css so restyling does not touch the data.)
 */
export function LabFolder() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverItem, setHoverItem] = useState<LabItem | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const hoverRef = useRef<LabItem | null>(null);
  hoverRef.current = hoverItem;

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine) return;

    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      const preview = previewRef.current;
      if (preview) {
        const alpha = reduced ? 1 : 0.16;
        eased.current.x += (pointer.current.x - eased.current.x) * alpha;
        eased.current.y += (pointer.current.y - eased.current.y) * alpha;
        preview.style.transform = `translate3d(${eased.current.x + 24}px, ${eased.current.y - 40}px, 0) rotate(${reduced ? 0 : (pointer.current.x - eased.current.x) * 0.04}deg)`;
        preview.style.opacity = hoverRef.current ? "1" : "0";
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <a className={styles.wordmark} href={sitePath("/")}>GALLO</a>
        <nav aria-label="Lab navigation">
          <a href={sitePath("/selected-work")}>BACK TO REEL</a>
          <a href={sitePath("/about-me")}>ABOUT</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>04 / RESEARCH &amp; EXPERIMENTS</p>
        <h1>
          实验室 <span>THE LAB</span>
        </h1>
        <p className={styles.intro}>
          Things tried, bound, retired, or deliberately killed. The drawer files them all —
          including the ones whose value is knowing why they stopped.
        </p>
      </section>

      <section className={styles.drawer} aria-label="Lab files">
        {labItems.map((item) => {
          const open = openId === item.id;
          return (
            <article key={item.id} className={`${styles.folder} ${open ? styles.folderOpen : ""}`}>
              <button
                type="button"
                className={styles.folderRow}
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : item.id)}
                onPointerEnter={() => setHoverItem(item)}
                onPointerLeave={() => setHoverItem(null)}
              >
                <span className={styles.folderIndex}>{item.index}</span>
                <span className={styles.folderTitle}>
                  <strong>{item.titleZh}</strong>
                  <em>{item.title}</em>
                </span>
                <span className={styles.folderYear}>{item.year}</span>
                <span className={styles.folderTag}>{item.tag}</span>
                <span className={styles.folderStatus} data-status={item.status}>{item.status}</span>
              </button>

              <div className={styles.dossier} hidden={!open}>
                <div className={styles.dossierCopy}>
                  <p>{item.summary}</p>
                  <p lang="zh-CN">{item.summaryZh}</p>
                  <ul className={styles.learned} aria-label="What it taught">
                    {item.learned.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {item.link && (
                    <a className={styles.dossierLink} href={sitePath(item.link.href)}>
                      {item.link.label}
                    </a>
                  )}
                </div>
                {item.thumb && (
                  <figure className={styles.dossierFigure}>
                    <img src={sitePath(item.thumb)} alt={`${item.title} working material`} loading="lazy" />
                  </figure>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <footer className={styles.footer}>
        <span>FILED UNDER: HONEST WORK</span>
        <a href={sitePath("/selected-work")}>← BACK TO REEL</a>
      </footer>

      {/* The floating preview card that trails the cursor over the drawer. */}
      <div ref={previewRef} className={styles.preview} aria-hidden="true">
        {hoverItem && (
          <>
            {hoverItem.thumb ? (
              <img src={sitePath(hoverItem.thumb)} alt="" />
            ) : (
              <span className={styles.previewBlank} data-status={hoverItem.status}>
                {hoverItem.index}
              </span>
            )}
            <b>{hoverItem.titleZh}</b>
          </>
        )}
      </div>
    </main>
  );
}
