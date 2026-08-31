"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  arcadeGames,
  getGame,
  godotGames,
  type GameButton,
  type GameHandle,
  type GodotGame,
} from "./games";
import { CONSOLE_ACCENTS, createConsoleScene, type CartridgeSpec, type ConsoleScene } from "./console3d";

type Phase = "boot" | "idle" | "play";

export type GameVisualState = {
  phase: Phase;
  carrying: boolean;
  activeId: string | null;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const buildUrl = (game: GodotGame) => `${basePath}${game.build}`;

/**
 * Where the synthetic key events are allowed to land.
 *
 * They used to go to `"*"`, which means "whoever is in that frame" — while inbound
 * messages were checked against the frame's own window. The asymmetry is the bug:
 * if the build URL ever resolves cross-origin, anything that ends up in the frame
 * receives the input stream.
 *
 * Resolved against the document rather than parsed alone, because the build URL
 * is a path — `basePath` is a path prefix, not a host — and `new URL()` on its own
 * rejects anything without a scheme. Parsing it unresolved throws a TypeError on
 * every keypress, which is a worse bug than the one being fixed.
 */
const gameOrigin = (game: GodotGame) =>
  typeof window === "undefined" ? "*" : new URL(buildUrl(game), window.location.href).origin;

/** Every cartridge on the shelf, Godot builds first. */
const shelf = [...godotGames, ...arcadeGames];

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
  backspace: "select",
};

const BOOT_LINES = [
  "JOI / POCKET-NT",
  "CHECKING CARTRIDGE BUS",
  "NO CARTRIDGE",
  "INSERT TO PLAY",
];

/** What the rack holds, in the order it stands in. Shell colours come from the console's
 * own accent palette so the cards visibly belong to the machine's face buttons. */
const SHELL_ACCENTS: Record<string, string> = {
  "night-tide": CONSOLE_ACCENTS.periwinkle,
  "star-vein": CONSOLE_ACCENTS.amethyst,
  snake: CONSOLE_ACCENTS.sage,
  tetris: CONSOLE_ACCENTS.salmon,
  pacman: CONSOLE_ACCENTS.wheat,
};

const CARTRIDGE_SPECS: CartridgeSpec[] = shelf.map((entry) => ({
  id: entry.id,
  label: entry.titleZh,
  sublabel: entry.title,
  accent: SHELL_ACCENTS[entry.id] ?? CONSOLE_ACCENTS.wheat,
}));

export function GameHandheld({
  onVisualStateChange,
}: {
  onVisualStateChange?: (state: GameVisualState) => void;
}) {
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
  /** WebGL is unavailable or died: the screen renders flat in flow, the shelf takes over. */
  const [sceneFailed, setSceneFailed] = useState(false);
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
  /** Non-null exactly when the thing on the screen is a WebAssembly build in an iframe. */
  const activeGodot = useMemo(
    () => godotGames.find((game) => game.id === activeId) ?? null,
    [activeId],
  );
  const activeGodotRef = useRef<GodotGame | null>(activeGodot);
  activeGodotRef.current = activeGodot;

  const postToGodot = useCallback((action: "keydown" | "keyup", button: GameButton) => {
    const game = activeGodotRef.current;
    const mapping = game?.buttons[button];
    // An unmapped button is not an error: a build that binds no downward action simply
    // never hears about `down`.
    if (!game || !mapping) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "joi-key", action, key: mapping.key, code: mapping.code },
      gameOrigin(game),
    );
  }, []);

  /** Released over the slot: the machine acknowledges before the card has finished seating. */
  const beginLoad = useCallback((id: string) => {
    const entry = shelf.find((item) => item.id === id);
    if (!entry) return;
    setPendingId(id);
    setStatus(`LOADING / ${entry.titleZh}`);
  }, []);

  /** Seated: mount the game. Idempotent — a second seat of the same card is a no-op, so
   * a shelf click racing the 3D insert cannot clobber the game's own status line. */
  const loadCartridge = useCallback((id: string) => {
    const entry = shelf.find((item) => item.id === id);
    if (!entry) return;
    if (activeIdRef.current === id && phaseRef.current === "play") {
      setPendingId(null);
      return;
    }
    setPendingId(null);
    setActiveId(id);
    setPhase("play");
    const godot = godotGames.find((game) => game.id === entry.id);
    setStatus(godot ? godot.loading : entry.titleZh);
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
      if (activeGodotRef.current) postToGodot("keydown", button);
    }
  }, [eject, postToGodot]);

  const release = useCallback((button: GameButton) => {
    if (!heldRef.current.delete(button)) return;
    sceneRef.current?.setPressed(button, false);
    if (phaseRef.current === "play" && activeGodotRef.current) {
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

    // Probe before constructing: a browser without WebGL gets the flat screen straight
    // away instead of a thrown effect and an invisible page.
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
      setSceneFailed(true);
      return;
    }

    const handBack = () => {
      // CSS3DRenderer moved the screen into its own layer, which has just been torn down.
      // Hand the element back to the node React thinks it lives in, or React's unmount
      // will look for it under a parent that no longer exists.
      if (screen.parentElement !== park) park.appendChild(screen);
    };

    let scene: ConsoleScene;
    try {
      scene = createConsoleScene({
        container: host,
        screenElement: screen,
        cartridges: CARTRIDGE_SPECS,
        onButtonDown: (id) => pressRef.current(id),
        onButtonUp: (id) => releaseRef.current(id),
        onInsertBegin: (id) => beginRef.current(id),
        onInsert: (id) => loadRef.current(id),
        onHover: setHoveredId,
        onDragState: setCarrying,
        isInteractive: () => phaseRef.current !== "boot",
        onFatal: () => {
          // The context died mid-session. Fold down to the flat screen without losing
          // whatever was playing — phase and activeId are React state, not scene state.
          sceneRef.current = null;
          scene.dispose();
          handBack();
          setCarrying(false);
          setHoveredId(null);
          setSceneFailed(true);
        },
      });
    } catch {
      setSceneFailed(true);
      return;
    }
    sceneRef.current = scene;

    return () => {
      if (sceneRef.current) {
        sceneRef.current = null;
        scene.dispose();
      }
      handBack();
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
      // Resolve against the cartridge that is actually loaded, not one shared table:
      // `e` is Night Tide's phase cut and Star Vein's inventory, so a single global map
      // would light the wrong key on the console for one of them.
      const code = String(data.code ?? "");
      const keyName = String(data.key ?? "").toLowerCase();
      let button: GameButton | undefined;
      let label: string | undefined;
      const game = activeGodotRef.current;
      if (game) {
        for (const [candidate, mapping] of Object.entries(game.buttons)) {
          if (!mapping) continue;
          if (mapping.code === code || mapping.key.toLowerCase() === keyName) {
            button = candidate as GameButton;
            label = mapping.label;
            break;
          }
        }
      }
      button ??= KEY_TO_BUTTON[keyName];
      if (!button) return;
      if (data.action === "keydown") {
        heldRef.current.add(button);
        sceneRef.current?.setPressed(button, true);
        if (label) setStatus(label);
      } else if (data.action === "keyup") {
        heldRef.current.delete(button);
        sceneRef.current?.setPressed(button, false);
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("message", onMessage);
    };
  }, [press, release]);

  // --- canvas game lifecycle ------------------------------------------------
  useEffect(() => {
    if (phase !== "play" || !activeId || godotGames.some((game) => game.id === activeId)) return;
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
    { keys: "BACKSPACE / SELECT", action: "退出卡带" },
  ];

  useEffect(() => {
    onVisualStateChange?.({ phase, carrying, activeId });
  }, [activeId, carrying, onVisualStateChange, phase]);

  return (
    <div className={styles.stage}>
      {/* The three.js canvas and the CSS3D layer are appended here by the scene. The live
          screen lives inside the CSS3D layer, so this subtree must stay AT-visible; only
          the WebGL canvas marks itself decorative. */}
      <div className={styles.sceneWell} data-game-liquid-shape="scene">
        {!sceneFailed && (
          <div
            className={[styles.scene, carrying ? styles.sceneCarrying : ""].filter(Boolean).join(" ")}
            ref={sceneHostRef}
          />
        )}

      {phase === "play" && (
        <button type="button" className={styles.ejectChip} onClick={eject}>
          ⏏ 退出卡带
        </button>
      )}

      {/*
        The screen's React home. `createConsoleScene` lifts the inner element into the CSS3D
        layer on mount and the cleanup puts it back, so React only ever sees it here. When
        WebGL is unavailable the park stops hiding and becomes the screen's flat frame.
      */}
        <div ref={screenParkRef} className={sceneFailed ? styles.screenFlat : styles.screenPark}>
          <div
            ref={screenRef}
            className={styles.screen}
            style={sceneFailed ? undefined : { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
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
            activeGodot ? (
              <iframe
                // Keyed by cartridge so switching builds tears the old frame down instead
                // of pointing one long-lived iframe at a different wasm module.
                key={activeGodot.id}
                ref={iframeRef}
                title={`${activeGodot.titleZh} 试玩版`}
                src={buildUrl(activeGodot)}
                allow="autoplay; fullscreen; gamepad"
                allowFullScreen
                onLoad={() => setStatus(`${activeGodot.title} ONLINE`)}
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
      </div>

      <div className={styles.rail} data-game-liquid-shape="rail">
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
          are the same cartridges as buttons, so the game centre still works from a
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
                if (phase === "boot") return;
                if (activeId === entry.id && phase === "play") return;
                if (sceneRef.current) {
                  // The 3D machine takes it from here: aligning → sinking → seated fires
                  // onInsert, which mounts the game. Loading here as well would mount it
                  // twice and clobber the game's own status line.
                  beginLoad(entry.id);
                  sceneRef.current.setInserted(entry.id);
                } else {
                  loadCartridge(entry.id);
                }
              }}
            >
              {entry.titleZh}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
