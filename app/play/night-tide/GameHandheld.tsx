"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type ButtonId =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "x"
  | "y"
  | "l1"
  | "l2"
  | "r1"
  | "r2"
  | "start"
  | "select";
type ScreenMode = "menu" | "game";

type Binding = {
  button: ButtonId;
  gameKey: string;
  code: string;
  label: string;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const GAME_BUILD_URL = `${basePath}/games/night-tide/index.html?v=embedded-font-2`;

// Mirrors scripts/app/app_state.gd in the Night Tide source project.
// Arrow keys are shell-level aliases and are forwarded as the game's WASD keys.
const bindings: Record<string, Binding> = {
  w: { button: "up", gameKey: "w", code: "KeyW", label: "MOVE UP" },
  ArrowUp: { button: "up", gameKey: "w", code: "KeyW", label: "MOVE UP" },
  s: { button: "down", gameKey: "s", code: "KeyS", label: "MOVE DOWN" },
  ArrowDown: { button: "down", gameKey: "s", code: "KeyS", label: "MOVE DOWN" },
  a: { button: "left", gameKey: "a", code: "KeyA", label: "MOVE LEFT" },
  ArrowLeft: { button: "left", gameKey: "a", code: "KeyA", label: "MOVE LEFT" },
  d: { button: "right", gameKey: "d", code: "KeyD", label: "MOVE RIGHT" },
  ArrowRight: { button: "right", gameKey: "d", code: "KeyD", label: "MOVE RIGHT" },
  " ": { button: "a", gameKey: " ", code: "Space", label: "JUMP" },
  Shift: { button: "b", gameKey: "Shift", code: "ShiftLeft", label: "DODGE" },
  j: { button: "x", gameKey: "j", code: "KeyJ", label: "LIGHT ATTACK" },
  k: { button: "y", gameKey: "k", code: "KeyK", label: "HEAVY ATTACK" },
  l: { button: "l1", gameKey: "l", code: "KeyL", label: "PARRY" },
  q: { button: "l2", gameKey: "q", code: "KeyQ", label: "TETHER" },
  e: { button: "r1", gameKey: "e", code: "KeyE", label: "PHASE SLASH" },
  r: { button: "r2", gameKey: "r", code: "KeyR", label: "GRAVITY COLLAPSE" },
  Escape: { button: "start", gameKey: "Escape", code: "Escape", label: "PAUSE" },
};

function postGameKey(iframe: HTMLIFrameElement | null, action: "keydown" | "keyup", binding: Binding) {
  iframe?.contentWindow?.postMessage(
    { type: "joi-key", action, key: binding.gameKey, code: binding.code },
    "*",
  );
}

export function GameHandheld() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeKeysRef = useRef<Map<string, Binding>>(new Map());
  const [mode, setMode] = useState<ScreenMode>("menu");
  const [pressed, setPressed] = useState<Set<ButtonId>>(() => new Set());
  const [lastAction, setLastAction] = useState("READY / PRESS A");

  const press = (button: ButtonId, binding?: Binding) => {
    setPressed((value) => new Set(value).add(button));
    if (binding) {
      setLastAction(binding.label);
      postGameKey(iframeRef.current, "keydown", binding);
    }
  };

  const release = (button: ButtonId, binding?: Binding) => {
    setPressed((value) => {
      const next = new Set(value);
      next.delete(button);
      return next;
    });
    if (binding) postGameKey(iframeRef.current, "keyup", binding);
  };

  const startSelectedGame = () => {
    setMode("game");
    setLastAction("LOADING CURRENT BUILD");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (mode === "menu") {
        if (key === "Enter") {
          if (event.repeat) return;
          event.preventDefault();
          press("start");
          window.setTimeout(() => release("start"), 130);
          startSelectedGame();
          return;
        }
        if (key === " " || key === "j") startSelectedGame();
      }

      const binding = bindings[key];
      if (!binding || event.repeat) return;
      event.preventDefault();
      activeKeysRef.current.set(key, binding);
      press(binding.button, binding);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const binding = activeKeysRef.current.get(key) ?? bindings[key];
      if (binding) {
        release(binding.button, binding);
        activeKeysRef.current.delete(key);
      }
    };

    const handleBlur = () => {
      activeKeysRef.current.forEach((binding) => postGameKey(iframeRef.current, "keyup", binding));
      activeKeysRef.current.clear();
      setPressed(new Set());
    };

    // Godot focuses its own canvas after loading, so physical keyboard events then
    // live inside the iframe. The embedded build mirrors them back for shell feedback.
    const handleGameKey = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== iframeRef.current?.contentWindow || !data || data.type !== "joi-game-key") return;
      const rawKey = typeof data.key === "string" ? data.key : "";
      const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
      const binding = bindings[key];
      if (!binding) return;

      if (data.action === "keydown") {
        setPressed((value) => new Set(value).add(binding.button));
        setLastAction(binding.label);
      } else if (data.action === "keyup") {
        setPressed((value) => {
          const next = new Set(value);
          next.delete(binding.button);
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", handleBlur);
    window.addEventListener("message", handleGameKey);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("message", handleGameKey);
    };
  }, [mode]);

  const buttonBinding = (button: ButtonId): Binding | undefined => {
    const first = Object.values(bindings).find((binding) => binding.button === button);
    return first;
  };

  const renderButton = (button: ButtonId, className: string, label: string) => {
    const binding = buttonBinding(button);
    const isPressed = pressed.has(button);
    return (
      <button
        type="button"
        className={`${styles.deviceButton} ${className} ${isPressed ? styles.deviceButtonPressed : ""}`}
        aria-label={`${label} button`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          if (mode === "menu" && (button === "start" || button === "a")) startSelectedGame();
          press(button, binding);
        }}
        onPointerUp={() => release(button, binding)}
        onPointerCancel={() => release(button, binding)}
        onPointerLeave={() => release(button, binding)}
      >
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className={styles.handheldStage}>
      <div className={styles.handheld}>
        <div className={styles.shoulderRail} aria-label="Shoulder buttons">
          {renderButton("l2", styles.shoulderL2, "L2")}
          {renderButton("l1", styles.shoulderL1, "L1")}
          {renderButton("r1", styles.shoulderR1, "R1")}
          {renderButton("r2", styles.shoulderR2, "R2")}
        </div>
        <div className={styles.handheldTopline}>
          <span>JOI / POCKET-NT</span>
          <span>{mode === "menu" ? "GAME CENTER" : "NIGHT TIDE / LIVE"}</span>
        </div>
        <div className={styles.consoleFace}>
          <div className={`${styles.controlDeck} ${styles.controlDeckLeft}`}>
            <div className={styles.analogStick} aria-hidden="true"><span /></div>
            <div className={styles.dpad} aria-label="Directional pad">
              {renderButton("up", styles.dpadUp, "↑")}
              {renderButton("left", styles.dpadLeft, "←")}
              <span className={styles.dpadCenter} aria-hidden="true" />
              {renderButton("right", styles.dpadRight, "→")}
              {renderButton("down", styles.dpadDown, "↓")}
            </div>
            <span className={`${styles.statusLight} ${styles.statusLightCyan}`} aria-hidden="true" />
          </div>

          <div className={styles.screenHousing}>
            <div className={styles.screenGlow} />
            <div className={styles.screen}>
              {mode === "menu" ? (
                <div className={styles.menuScreen}>
                  <img src={`${basePath}/media/night-tide/main-menu.avif`} alt="Zero Hour: Night Tide main menu with readable Chinese interface" />
                  <div className={styles.launchPlate}>
                    <span>CURRENT BUILD / 0.1 DEMO</span>
                    <button type="button" onClick={startSelectedGame}>PLAY NIGHT TIDE <b>→</b></button>
                    <small>ENTER / A TO START</small>
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  title="Zero Hour: Night Tide playable demo"
                  src={GAME_BUILD_URL}
                  allow="autoplay; fullscreen; gamepad"
                  allowFullScreen
                  onLoad={() => setLastAction("NIGHT TIDE ONLINE")}
                />
              )}
            </div>
          </div>

          <div className={`${styles.controlDeck} ${styles.controlDeckRight}`}>
            <div className={styles.faceButtons} aria-label="Action buttons">
              {renderButton("y", styles.faceY, "Y")}
              {renderButton("x", styles.faceX, "X")}
              {renderButton("b", styles.faceB, "B")}
              {renderButton("a", styles.faceA, "A")}
            </div>
            <div className={styles.analogStick} aria-hidden="true"><span /></div>
            <span className={`${styles.statusLight} ${styles.statusLightAmber}`} aria-hidden="true" />
          </div>
        </div>

        <div className={styles.deviceFooter}>
          <div className={styles.speaker} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
          <div className={styles.centerControls}>
            {renderButton("select", styles.selectButton, "SELECT")}
            {renderButton("start", styles.startButton, "START")}
          </div>
          <div className={styles.deviceBrand}>NIGHT TIDE <span>///</span> JOI LAB</div>
          <div className={styles.speaker} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
        </div>
      </div>
      <div className={styles.handheldRail}>
        <div>
          <span className={styles.railLabel}>INPUT MONITOR</span>
          <strong>{lastAction}</strong>
        </div>
        <div className={styles.mappingList} aria-label="Keyboard mapping">
          <span><b>WASD</b> d-pad / move</span>
          <span><b>SPACE / A</b> jump</span>
          <span><b>SHIFT / B</b> dodge</span>
          <span><b>J / X</b> light attack</span>
          <span><b>K / Y</b> heavy attack</span>
          <span><b>L / L1</b> parry</span>
          <span><b>Q / L2</b> tether</span>
          <span><b>E / R1</b> phase slash</span>
          <span><b>R / R2</b> gravity</span>
          <span><b>ESC / START</b> pause</span>
        </div>
        {mode === "game" && (
          <button type="button" className={styles.exitButton} onClick={() => setMode("menu")}>
            GAME SELECT
          </button>
        )}
      </div>
    </div>
  );
}
