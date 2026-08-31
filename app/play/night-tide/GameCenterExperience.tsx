"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrivalFade } from "../../../components/ArrivalFade";
import {
  createLiquidStage,
  dampFrame,
  decayFrame,
  type LiquidStage,
} from "../../../components/work-experience/liquidStage";
import { arcadeGames, godotGames } from "./games";
import { GameHandheld, type GameVisualState } from "./GameHandheld";
import styles from "./page.module.css";

/** Counted, not written down: the shelf gained a fifth cartridge and the copy did not. */
const CARTRIDGE_COUNT = godotGames.length + arcadeGames.length;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (from: number, to: number, value: number) => {
  const x = clamp01((value - from) / Math.max(0.0001, to - from));
  return x * x * (3 - 2 * x);
};

const DEFAULT_STATE: GameVisualState = {
  phase: "boot",
  carrying: false,
  activeId: null,
};

export function GameCenterExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const identityRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLAnchorElement>(null);
  const liquidHostRef = useRef<HTMLDivElement>(null);
  const liquidRef = useRef<LiquidStage | null>(null);
  const frameRef = useRef(0);
  const frameTimeRef = useRef(0);
  const geometryDirtyRef = useRef(true);
  const visualStateRef = useRef(DEFAULT_STATE);
  const stateProgressRef = useRef(0);
  const stateTargetRef = useRef(0.16);
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
  const [visualState, setVisualState] = useState(DEFAULT_STATE);

  const scheduleFrame = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(function draw(now) {
      frameRef.current = 0;
      const liquid = liquidRef.current;
      const root = rootRef.current;
      if (!liquid || !root) return;
      const deltaSeconds = frameTimeRef.current
        ? Math.min(0.05, (now - frameTimeRef.current) / 1000)
        : 1 / 60;
      frameTimeRef.current = now;

      if (geometryDirtyRef.current) {
        liquid.measure();
        geometryDirtyRef.current = false;
      }

      const current = stateProgressRef.current;
      const target = stateTargetRef.current;
      const next = dampFrame(current, target, 0.105, deltaSeconds);
      stateProgressRef.current = Math.abs(target - next) < 0.0004 ? target : next;
      const progress = stateProgressRef.current;

      const pointer = pointerRef.current;
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
          0.38 + 0.62 * smoothstep(0.04, 0.42, progress),
          0.2 + 0.8 * smoothstep(0.24, 0.62, progress),
          0.16 + 0.84 * smoothstep(0.56, 0.84, progress),
        ],
      });

      if (root.dataset.liquidReady !== "true") root.dataset.liquidReady = "true";
      const moving = Math.abs(target - progress) > 0.0005;
      const pointerMoving = pointer.wake > 0.008
        || Math.abs(pointer.targetPresence - pointer.presence) > 0.008;
      if (moving || pointerMoving) scheduleFrame();
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const host = liquidHostRef.current;
    const identity = identityRef.current;
    const scene = root?.querySelector<HTMLElement>("[data-game-liquid-shape='scene']");
    const rail = root?.querySelector<HTMLElement>("[data-game-liquid-shape='rail']");
    const next = nextRef.current;
    if (!root || !host || !identity || !scene || !rail || !next) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    try {
      liquidRef.current = createLiquidStage(
        host,
        [identity, scene, rail, next],
        { ink: "#306c8a", accent: "#9ed4ea", paper: "#e7f0f4", dprCap: 1 },
        () => { root.dataset.liquidReady = "false"; },
      );
      scheduleFrame();
    } catch (error) {
      console.warn("[game-center] Living Aperture unavailable; using solid surfaces", error);
      root.dataset.liquidReady = "false";
    }

    const markGeometryDirty = () => {
      geometryDirtyRef.current = true;
      scheduleFrame();
    };
    const observer = new ResizeObserver(markGeometryDirty);
    observer.observe(root);
    observer.observe(identity);
    observer.observe(scene);
    observer.observe(rail);
    observer.observe(next);
    window.addEventListener("scroll", markGeometryDirty, { passive: true });
    window.addEventListener("resize", markGeometryDirty);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", markGeometryDirty);
      window.removeEventListener("resize", markGeometryDirty);
      liquidRef.current?.dispose();
      liquidRef.current = null;
      frameTimeRef.current = 0;
      delete root.dataset.liquidReady;
    };
  }, [scheduleFrame]);

  useEffect(() => {
    visualStateRef.current = visualState;
    stateTargetRef.current = visualState.carrying
      ? 0.72
      : visualState.phase === "boot"
        ? 0.18
        : visualState.phase === "idle"
          ? 0.5
          : 0.84;
    scheduleFrame();
  }, [scheduleFrame, visualState]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    const now = performance.now();
    const speed = pointer.previousTime > 0
      ? Math.hypot(
        event.clientX - pointer.previousX,
        event.clientY - pointer.previousY,
      ) / Math.max(8, now - pointer.previousTime)
      : 0;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.previousX = event.clientX;
    pointer.previousY = event.clientY;
    pointer.previousTime = now;
    pointer.targetPresence = 1;
    pointer.wake = Math.max(pointer.wake, clamp01(speed * 0.72));
    scheduleFrame();
  }, [scheduleFrame]);

  return (
    <main
      className={styles.page}
      data-game-phase={visualState.phase}
      data-game-carrying={visualState.carrying ? "true" : undefined}
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointerRef.current.targetPresence = 0;
        scheduleFrame();
      }}
    >
      <ArrivalFade />
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.liquidHost} ref={liquidHostRef} aria-hidden="true" />

      <nav className={styles.nav} aria-label="Game Center navigation">
        <Link className={styles.wordmark} href="/">GALLO</Link>
        <div>
          <Link href="/selected-work">BACK TO REEL</Link>
          <Link href="/lab">THE LAB</Link>
        </div>
      </nav>

      <header className={styles.header} ref={identityRef} data-arrival-target>
        <p className={styles.kicker}>03 / GAME CENTER / {CARTRIDGE_COUNT} CARTRIDGES</p>
        <div className={styles.heading}>
          <h1 lang="zh-CN">游戏厅</h1>
          <p className={styles.subtitle} lang="zh-CN">
            把卡带拖进插槽，完整试玩夜潮、星脉、贪吃蛇、俄罗斯方块和吃豆人。
          </p>
        </div>
        <span className={styles.phaseLabel}>
          {visualState.carrying
            ? "CARTRIDGE IN HAND"
            : visualState.phase === "play"
              ? "GAME ONLINE"
              : visualState.phase === "idle"
                ? "WAITING FOR CARTRIDGE"
                : "BOOTING POCKET-NT"}
        </span>
      </header>

      <section className={styles.gameSection} aria-labelledby="game-center-title">
        <h2 id="game-center-title" className={styles.srOnly}>选择并试玩一张卡带</h2>
        <GameHandheld onVisualStateChange={setVisualState} />
      </section>

      <Link className={styles.nextSignal} href="/lab" ref={nextRef}>
        <span>NEXT / 04</span>
        <strong>THE LAB</strong>
        <b aria-hidden="true">→</b>
      </Link>
    </main>
  );
}
