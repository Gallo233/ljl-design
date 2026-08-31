"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrivalFade } from "../../components/ArrivalFade";
import { SiteHUD } from "../../components/SiteHUD";
import {
  createLiquidStage,
  dampFrame,
  decayFrame,
  type LiquidStage,
} from "../../components/work-experience/liquidStage";
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
  const rootRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const signalRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const liquidHostRef = useRef<HTMLDivElement>(null);
  const liquidRef = useRef<LiquidStage | null>(null);
  const liquidFrameRef = useRef(0);
  const liquidFrameTimeRef = useRef(0);
  const liquidGeometryDirtyRef = useRef(true);
  const labProgressRef = useRef(0.12);
  const labTargetRef = useRef(0.46);
  const liquidPointerRef = useRef({
    x: 0,
    y: 0,
    previousX: 0,
    previousY: 0,
    previousTime: 0,
    targetPresence: 0,
    presence: 0,
    wake: 0,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverItem, setHoverItem] = useState<LabItem | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  const scheduleLiquidFrame = useCallback(() => {
    if (liquidFrameRef.current) return;
    liquidFrameRef.current = window.requestAnimationFrame(function draw(now) {
      liquidFrameRef.current = 0;
      const liquid = liquidRef.current;
      const root = rootRef.current;
      if (!liquid || !root) return;
      const deltaSeconds = liquidFrameTimeRef.current
        ? Math.min(0.05, (now - liquidFrameTimeRef.current) / 1000)
        : 1 / 60;
      liquidFrameTimeRef.current = now;
      if (liquidGeometryDirtyRef.current) {
        liquid.measure();
        liquidGeometryDirtyRef.current = false;
      }

      const current = labProgressRef.current;
      const target = labTargetRef.current;
      const next = dampFrame(current, target, 0.1, deltaSeconds);
      labProgressRef.current = Math.abs(target - next) < 0.0004 ? target : next;
      const progress = labProgressRef.current;
      const pointer = liquidPointerRef.current;
      const presenceRate = pointer.targetPresence > pointer.presence ? 0.24 : 0.07;
      pointer.presence = dampFrame(
        pointer.presence,
        pointer.targetPresence,
        presenceRate,
        deltaSeconds,
      );
      pointer.wake = decayFrame(pointer.wake, 0.905, deltaSeconds);

      liquid.render({
        progress,
        time: now * 0.001,
        pointerX: pointer.x,
        pointerY: pointer.y,
        pointerPresence: pointer.presence,
        pointerWake: pointer.wake,
        shapeWeights: [1, 1, 1, 1],
        linkWeights: [
          0.34 + progress * 0.66,
          0.24 + progress * 0.7,
          0.16 + progress * 0.82,
        ],
      });
      if (root.dataset.liquidReady !== "true") root.dataset.liquidReady = "true";
      const moving = Math.abs(target - progress) > 0.0005;
      const pointerMoving = pointer.wake > 0.008
        || Math.abs(pointer.targetPresence - pointer.presence) > 0.008;
      if (moving || pointerMoving) scheduleLiquidFrame();
    });
  }, []);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const preview = previewRef.current;
    if (!fine || !hoverItem) {
      if (preview) preview.style.opacity = "0";
      return;
    }

    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let previousTime = 0;
    const tick = (now: number) => {
      const preview = previewRef.current;
      if (preview) {
        const deltaSeconds = previousTime
          ? Math.min(0.05, (now - previousTime) / 1000)
          : 1 / 60;
        previousTime = now;
        eased.current.x = reduced
          ? pointer.current.x
          : dampFrame(eased.current.x, pointer.current.x, 0.16, deltaSeconds);
        eased.current.y = reduced
          ? pointer.current.y
          : dampFrame(eased.current.y, pointer.current.y, 0.16, deltaSeconds);
        preview.style.transform = `translate3d(${eased.current.x + 24}px, ${eased.current.y - 40}px, 0) rotate(${reduced ? 0 : (pointer.current.x - eased.current.x) * 0.04}deg)`;
        preview.style.opacity = "1";
      }
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      if (previewRef.current) previewRef.current.style.opacity = "0";
    };
  }, [hoverItem]);

  useEffect(() => {
    const root = rootRef.current;
    const host = liquidHostRef.current;
    const hero = heroRef.current;
    const drawer = drawerRef.current;
    const signal = signalRef.current;
    const footer = footerRef.current;
    if (!root || !host || !hero || !drawer || !signal || !footer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      liquidRef.current = createLiquidStage(
        host,
        [hero, drawer, signal, footer],
        { ink: "#17201f", accent: "#a28b70", paper: "#e9e8e2", dprCap: 1 },
        () => { root.dataset.liquidReady = "false"; },
      );
      scheduleLiquidFrame();
    } catch (error) {
      console.warn("[lab] Living Aperture unavailable; using solid surfaces", error);
      root.dataset.liquidReady = "false";
    }

    const markGeometryDirty = () => {
      liquidGeometryDirtyRef.current = true;
      scheduleLiquidFrame();
    };
    const observer = new ResizeObserver(markGeometryDirty);
    observer.observe(root);
    observer.observe(hero);
    observer.observe(drawer);
    observer.observe(signal);
    observer.observe(footer);
    window.addEventListener("scroll", markGeometryDirty, { passive: true });
    window.addEventListener("resize", markGeometryDirty);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", markGeometryDirty);
      window.removeEventListener("resize", markGeometryDirty);
      liquidRef.current?.dispose();
      liquidRef.current = null;
      liquidFrameTimeRef.current = 0;
      delete root.dataset.liquidReady;
    };
  }, [scheduleLiquidFrame]);

  useEffect(() => {
    labTargetRef.current = openId ? 0.86 : 0.48;
    liquidGeometryDirtyRef.current = true;
    scheduleLiquidFrame();
  }, [openId, scheduleLiquidFrame]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const liquidPointer = liquidPointerRef.current;
    const now = performance.now();
    const speed = liquidPointer.previousTime > 0
      ? Math.hypot(
        event.clientX - liquidPointer.previousX,
        event.clientY - liquidPointer.previousY,
      ) / Math.max(8, now - liquidPointer.previousTime)
      : 0;
    liquidPointer.x = event.clientX;
    liquidPointer.y = event.clientY;
    liquidPointer.previousX = event.clientX;
    liquidPointer.previousY = event.clientY;
    liquidPointer.previousTime = now;
    liquidPointer.targetPresence = 1;
    liquidPointer.wake = Math.max(liquidPointer.wake, Math.min(1, speed * 0.72));
    scheduleLiquidFrame();
  }, [scheduleLiquidFrame]);

  return (
    <main
      className={styles.page}
      data-lab-open={openId ?? undefined}
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        liquidPointerRef.current.targetPresence = 0;
        scheduleLiquidFrame();
      }}
    >
      <ArrivalFade />
      <SiteHUD />
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.liquidHost} ref={liquidHostRef} aria-hidden="true" />
      <header className={styles.nav}>
        <Link className={styles.wordmark} href="/">GALLO</Link>
        <nav aria-label="Lab navigation">
          <Link href="/selected-work" aria-label="Back to reel">
            <span className={styles.navWide}>BACK TO </span>REEL
          </Link>
          <Link href="/about-me">ABOUT</Link>
        </nav>
      </header>

      <section className={styles.hero} data-arrival-target ref={heroRef}>
        <p className={styles.kicker}>04 / RESEARCH &amp; EXPERIMENTS</p>
        <h1>
          实验室 <span>THE LAB</span>
        </h1>
        <p className={styles.intro}>
          Things tried, bound, retired, or deliberately killed. The drawer files them all —
          including the ones whose value is knowing why they stopped.
        </p>
      </section>

      <aside className={styles.archiveSignal} ref={signalRef}>
        <span>OPEN A FILE</span>
        <strong>Hover to inspect.<br />Click to unfold.</strong>
      </aside>

      <section className={styles.drawer} aria-label="Lab files" ref={drawerRef}>
        {labItems.map((item) => {
          const open = openId === item.id;
          return (
            <article
              key={item.id}
              className={`${styles.folder} ${open ? styles.folderOpen : ""}`}
            >
              <button
                type="button"
                className={styles.folderRow}
                aria-expanded={open}
                onClick={() => {
                  setHoverItem(null);
                  setOpenId(open ? null : item.id);
                }}
                onPointerEnter={(event) => {
                  pointer.current = { x: event.clientX, y: event.clientY };
                  eased.current = { x: event.clientX, y: event.clientY };
                  setHoverItem(item);
                }}
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
                    <Link className={styles.dossierLink} href={item.link.href}>
                      {item.link.label}
                    </Link>
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

      <footer className={styles.footer} ref={footerRef}>
        <span>FILED UNDER: HONEST WORK</span>
        <Link href="/selected-work">← BACK TO REEL</Link>
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
