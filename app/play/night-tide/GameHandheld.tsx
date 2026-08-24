"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  arcadeGames,
  getGame,
  nightTideEntry,
  type GameButton,
  type GameHandle,
} from "./games";
import { createConsoleScene, type CartridgeSpec, type ConsoleScene } from "./console3d";

type Phase = "boot" | "idle" | "play";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const GAME_BUILD_URL = `${basePath}/games/night-tide/index.html?v=embedded-font-2`;

/** Every cartridge on the shelf, Godot build first. */
const shelf = [nightTideEntry, ...arcadeGames];

/**
 * Physical keys to shell buttons. One table, used by every screen — the select menu, the
 * canvas games, and the Godot build all read the same buttons, which is the whole reason a
 * D-pad drawn in HTML can drive a WebAssembly game it knows nothing about.
 */
const KEY_TO_BUTTON: Record<string, GameButton> = {
  w: "up", arrowup: "up",
  s: "down", arrowdown: "down",
  a: "left", arrowleft: "left",
  d: "right", arrowright: "right",
  " ": "a",
  shift: "b",
  j: "x",
  k: "y",
  l: "l1",
  q: "l2",
  e: "r1",
  r: "r2",
  escape: "start",
};

/**
 * Shell buttons to the keys the Night Tide build listens for.
 * Mirrors `scripts/app/app_state.gd` in the Night Tide source project.
 */
const BUTTON_TO_GODOT: Partial<Record<GameButton, { key: string; code: string; label: string }>> = {
  up: { key: "w", code: "KeyW", label: "移动 上" },
  down: { key: "s", code: "KeyS", label: "移动 下" },
  left: { key: "a", code: "KeyA", label: "移动 左" },
  right: { key: "d", code: "KeyD", label: "移动 右" },
  a: { key: " ", code: "Space", label: "跳跃" },
  b: { key: "Shift", code: "ShiftLeft", label: "闪避" },
  x: { key: "j", code: "KeyJ", label: "轻攻击" },
  y: { key: "k", code: "KeyK", label: "重攻击" },
  l1: { key: "l", code: "KeyL", label: "弹反" },
  l2: { key: "q", code: "KeyQ", label: "牵引" },
  r1: { key: "e", code: "KeyE", label: "相位斩" },
  r2: { key: "r", code: "KeyR", label: "引力坍缩" },
  start: { key: "Escape", code: "Escape", label: "暂停" },
};

const BOOT_LINES = [
  "JOI / POCKET-NT",
  "CHECKING CARTRIDGE BUS",
  "NO CARTRIDGE",
  "INSERT TO PLAY",
];

/** What the rack holds, in the order it stands in. Colours match the face buttons. */
const CARTRIDGE_SPECS: CartridgeSpec[] = shelf.map((entry) => ({
  id: entry.id,
  label: entry.titleZh,
  sublabel: entry.title,
  accent: entry.id === "night-tide" ? "#9ba4cf"
    : entry.id === "snake" ? "#a9c9b6"
    : entry.id === "tetris" ? "#e0968a"
    : "#e8c68d",
}));

export function GameHandheld() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Where the three.js canvas and the CSS3D layer are mounted. */
  const sceneHostRef = useRef<HTMLDivElement>(null);
  /** The live screen. CSS3DObject reparents this into the 3D layer; see the scene effect. */
  const screenRef = useRef<HTMLDivElement>(null);
  /** Its React-owned home, so the element can be handed back before React unmounts it. */
  const screenParkRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ConsoleScene | null>(null);

  const [phase, setPhase] = useState<Phase>("boot");
  const [bootStep, setBootStep] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [status, setStatus] = useState("BOOTING");

  // Input lives in refs, not state: a canvas game polls it every frame, and routing that
  // through React would re-render the shell sixty times a second.
  const heldRef = useRef<Set<GameButton>>(new Set());
  const edgeRef = useRef<Set<GameButton>>(new Set());
  const phaseRef = useRef(phase);
  const activeIdRef = useRef(activeId);
  phaseRef.current = phase;
  activeIdRef.current = activeId;

  const activeEntry = useMemo(() => shelf.find((entry) => entry.id === activeId) ?? null, [activeId]);
  const isNightTide = activeId === nightTideEntry.id;

  const postToGodot = useCallback((action: "keydown" | "keyup", button: GameButton) => {
    const mapping = BUTTON_TO_GODOT[button];
    if (!mapping) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "joi-key", action, key: mapping.key, code: mapping.code },
      "*",
    );
  }, []);

  /** Released over the slot: the machine acknowledges before the card has finished seating. */
  const beginLoad = useCallback((id: string) => {
    const entry = shelf.find((item) => item.id === id);
    if (!entry) return;
    setPendingId(id);
    setStatus(`LOADING / ${entry.titleZh}`);
  }, []);

  /** Seated: mount the game. */
  const loadCartridge = useCallback((id: string) => {
    const entry = shelf.find((item) => item.id === id);
    if (!entry) return;
    setPendingId(null);
    setActiveId(id);
    setPhase("play");
    setStatus(entry.id === nightTideEntry.id ? "LOADING BUILD" : entry.titleZh);
  }, []);

  const eject = useCallback(() => {
    setPendingId(null);
    setActiveId(null);
    setPhase("idle");
    setStatus("INSERT CARTRIDGE");
    sceneRef.current?.setInserted(null);
  }, []);

  /** The single entry point for a button going down, whatever produced it. */
  const press = useCallback((button: GameButton) => {
    if (heldRef.current.has(button)) return;
    heldRef.current.add(button);
    edgeRef.current.add(button);
    sceneRef.current?.setPressed(button, true);

    if (phaseRef.current === "play") {
      if (button === "select") { eject(); return; }
      if (activeIdRef.current === nightTideEntry.id) postToGodot("keydown", button);
    }
  }, [eject, postToGodot]);

  const release = useCallback((button: GameButton) => {
    if (!heldRef.current.delete(button)) return;
    sceneRef.current?.setPressed(button, false);
    if (phaseRef.current === "play" && activeIdRef.current === nightTideEntry.id) {
      postToGodot("keyup", button);
    }
  }, [postToGodot]);

  const pressRef = useRef(press);
  const releaseRef = useRef(release);
  const loadRef = useRef(loadCartridge);
  const beginRef = useRef(beginLoad);
  pressRef.current = press;
  releaseRef.current = release;
  loadRef.current = loadCartridge;
  beginRef.current = beginLoad;

  // --- the 3D console -------------------------------------------------------
  useEffect(() => {
    const host = sceneHostRef.current;
    const screen = screenRef.current;
    const park = screenParkRef.current;
    if (!host || !screen || !park) return;

    const scene = createConsoleScene({
      container: host,
      screenElement: screen,
      cartridges: CARTRIDGE_SPECS,
      onButtonDown: (id) => pressRef.current(id),
      onButtonUp: (id) => releaseRef.current(id),
      onInsertBegin: (id) => beginRef.current(id),
      onInsert: (id) => loadRef.current(id),
      onHover: setHoveredId,
      onDragState: setCarrying,
    });
    sceneRef.current = scene;

    return () => {
      sceneRef.current = null;
      scene.dispose();
      // CSS3DRenderer moved the screen into its own layer, which it has just torn down.
      // Hand the element back to the node React thinks it lives in, or React's unmount
      // will look for it under a parent that no longer exists.
      if (screen.parentElement !== park) park.appendChild(screen);
    };
  }, []);

  // --- boot animation -------------------------------------------------------
  useEffect(() => {
    if (phase !== "boot") return;
    let cancelled = false;
    const timers = BOOT_LINES.map((line, index) =>
      window.setTimeout(() => {
        if (cancelled) return;
        setBootStep(index + 1);
        setStatus(line);
      }, 420 + index * 380),
    );
    const done = window.setTimeout(() => {
      if (cancelled) return;
      setPhase("idle");
      setStatus("INSERT CARTRIDGE");
    }, 420 + BOOT_LINES.length * 380 + 320);
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      window.clearTimeout(done);
    };
  }, [phase]);

  // --- keyboard -------------------------------------------------------------
  useEffect(() => {
    const normalise = (event: KeyboardEvent) => KEY_TO_BUTTON[event.key.toLowerCase()];

    const onKeyDown = (event: KeyboardEvent) => {
      const button = normalise(event);
      if (!button || event.repeat) return;
      event.preventDefault();
      press(button);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const button = normalise(event);
      if (!button) return;
      event.preventDefault();
      release(button);
    };
    /*
     * Releasing everything on any loss of attention.
     *
     * This is the failure that matters most here, because the consequence is invisible
     * until it is dramatic. Godot moves keyboard focus *into its own iframe* on first
     * input. From that moment the parent stops receiving key events — so a key pressed
     * while the parent had focus gets its `keydown` forwarded and its `keyup` never sent,
     * and the build goes on holding a button nobody is pressing. A held jump or dodge is
     * exactly how a character ends up stuck in the air.
     */
    const releaseAll = () => { Array.from(heldRef.current).forEach(release); };
    const onBlur = releaseAll;
    const onVisibility = () => { if (document.hidden) releaseAll(); };

    // Godot takes keyboard focus into the iframe once it loads, so the build mirrors its
    // own key events back out for the console's buttons to light up.
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== iframeRef.current?.contentWindow || !data || data.type !== "joi-game-key") return;
      const button = KEY_TO_BUTTON[String(data.key ?? "").toLowerCase()];
      if (!button) return;
      if (data.action === "keydown") {
        heldRef.current.add(button);
        sceneRef.current?.setPressed(button, true);
        const mapping = BUTTON_TO_GODOT[button];
        if (mapping) setStatus(mapping.label);
      } else if (data.action === "keyup") {
        heldRef.current.delete(button);
        sceneRef.current?.setPressed(button, false);
      }
    };

    /*
     * And a backstop for the cases the events above cannot cover — a keyup swallowed by
     * a browser shortcut, a pointer capture lost to a context menu, a mirrored keyup that
     * never arrives. Nothing in these games is meant to be held for six seconds, so
     * anything still down after that is a bug, not a player.
     */
    const heldSince = new Map<GameButton, number>();
    const watchdog = window.setInterval(() => {
      const now = performance.now();
      heldRef.current.forEach((button) => {
        if (!heldSince.has(button)) heldSince.set(button, now);
      });
      heldSince.forEach((since, button) => {
        if (!heldRef.current.has(button)) { heldSince.delete(button); return; }
        if (now - since > 6000) {
          release(button);
          heldSince.delete(button);
        }
      });
    }, 1000);

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(watchdog);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("message", onMessage);
    };
  }, [press, release]);

  // --- canvas game lifecycle ------------------------------------------------
  useEffect(() => {
    if (phase !== "play" || !activeId || activeId === nightTideEntry.id) return;
    const canvas = canvasRef.current;
    const game = getGame(activeId);
    if (!canvas || !game) return;

    edgeRef.current.clear();
    const handle: GameHandle = game.mount(canvas, {
      input: {
        isDown: (button) => heldRef.current.has(button),
        // Edge reads are consumed, so a press landing between two frames is seen exactly
        // once rather than missed or repeated.
        pressed: (button) => edgeRef.current.delete(button),
      },
      setStatus,
    });
    return () => handle.destroy();
  }, [phase, activeId]);

  // A held button must not survive into the next cartridge.
  useEffect(() => {
    heldRef.current.forEach((button) => sceneRef.current?.setPressed(button, false));
    heldRef.current.clear();
    edgeRef.current.clear();
  }, [phase, activeId]);

  const hoveredEntry = shelf.find((entry) => entry.id === hoveredId) ?? null;
  const pendingEntry = shelf.find((entry) => entry.id === pendingId) ?? null;
  const controls = activeEntry?.controls ?? [
    { keys: "拖动卡带", action: "放到机器顶部插槽" },
    { keys: "SELECT", action: "退出卡带" },
  ];

  return (
    <div className={styles.stage}>
      {/* The three.js canvas and the CSS3D layer are appended here by the scene. */}
      <div
        className={`${styles.scene} ${carrying ? styles.sceneCarrying : ""}`}
        ref={sceneHostRef}
        aria-hidden="true"
      />

      {/*
        The screen's React home. `createConsoleScene` lifts the inner element into the CSS3D
        layer on mount and the cleanup puts it back, so React only ever sees it here.
      */}
      <div ref={screenParkRef} className={styles.screenPark}>
        <div
          ref={screenRef}
          className={styles.screen}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
        >
          {phase === "boot" && (
            <div className={styles.boot} role="status" aria-live="polite">
              <div className={styles.bootMark} aria-hidden="true"><i /><i /><i /></div>
              <ol className={styles.bootLines}>
                {BOOT_LINES.map((line, index) => (
                  <li key={line} data-done={index < bootStep ? "" : undefined}>
                    <b aria-hidden="true">{index < bootStep ? "✓" : "·"}</b>
                    {line}
                  </li>
                ))}
              </ol>
              <div className={styles.bootBar} aria-hidden="true">
                <i style={{ transform: `scaleX(${bootStep / BOOT_LINES.length})` }} />
              </div>
            </div>
          )}

          {phase === "idle" && (
            <div className={styles.idle}>
              <p className={styles.idleSlot} aria-hidden="true">
                <i /><i /><i />
              </p>
              <strong>
                {pendingEntry ? `读取 ${pendingEntry.titleZh}…`
                  : hoveredEntry ? hoveredEntry.titleZh
                  : "把卡带拖进插槽"}
              </strong>
              <small>
                {pendingEntry ? "CARTRIDGE SEATING"
                  : hoveredEntry ? hoveredEntry.blurbZh
                  : `右边有 ${shelf.length} 张卡带 · 拖到机器顶部即可开始`}
              </small>
            </div>
          )}

          {phase === "play" && (
            isNightTide ? (
              <iframe
                ref={iframeRef}
                title="Zero Hour: Night Tide 试玩版"
                src={GAME_BUILD_URL}
                allow="autoplay; fullscreen; gamepad"
                allowFullScreen
                onLoad={() => setStatus("NIGHT TIDE ONLINE")}
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                className={styles.gameCanvas}
                aria-label={`${activeEntry?.titleZh ?? ""} 游戏画面`}
              />
            )
          )}
        </div>
      </div>

      <div className={styles.rail}>
        <div className={styles.railHead}>
          <span>INPUT MONITOR</span>
          <strong>{status}</strong>
        </div>
        <dl className={styles.mapping}>
          {controls.map((control) => (
            <div key={control.keys}>
              <dt>{control.keys}</dt>
              <dd>{control.action}</dd>
            </div>
          ))}
        </dl>

        {/*
          The rack is the real way in, but it needs a pointer and a working canvas. These
          are the same four cartridges as buttons, so the game centre still works from a
          keyboard, a screen reader, or a browser where WebGL failed.
        */}
        <div className={styles.fallbackShelf}>
          <span>卡带</span>
          {shelf.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={activeId === entry.id ? styles.fallbackActive : ""}
              onClick={() => {
                sceneRef.current?.setInserted(entry.id);
                loadCartridge(entry.id);
              }}
            >
              {entry.titleZh}
            </button>
          ))}
          {phase === "play" && (
            <button type="button" className={styles.fallbackEject} onClick={eject}>
              退出卡带
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
