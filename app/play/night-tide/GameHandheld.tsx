"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type ButtonId = "up" | "down" | "left" | "right" | "a" | "b" | "x" | "y" | "start" | "select";
type ScreenMode = "menu" | "game";

type Binding = {
  button: ButtonId;
  gameKey: string;
  code: string;
  label: string;
};

const GAME_BUILD_URL = "https://gallo233.github.io/joi-doorway/night-tide/?v=handheld-bridge-1";

const bindings: Record<string, Binding> = {
  w: { button: "up", gameKey: " ", code: "Space", label: "JUMP" },
  ArrowUp: { button: "up", gameKey: " ", code: "Space", label: "JUMP" },
  s: { button: "down", gameKey: "ArrowDown", code: "ArrowDown", label: "DOWN" },
  ArrowDown: { button: "down", gameKey: "ArrowDown", code: "ArrowDown", label: "DOWN" },
  a: { button: "left", gameKey: "a", code: "KeyA", label: "MOVE LEFT" },
  ArrowLeft: { button: "left", gameKey: "a", code: "KeyA", label: "MOVE LEFT" },
  d: { button: "right", gameKey: "d", code: "KeyD", label: "MOVE RIGHT" },
  ArrowRight: { button: "right", gameKey: "d", code: "KeyD", label: "MOVE RIGHT" },
  " ": { button: "a", gameKey: " ", code: "Space", label: "JUMP" },
  j: { button: "b", gameKey: "j", code: "KeyJ", label: "ATTACK" },
  k: { button: "x", gameKey: "k", code: "KeyK", label: "ATTACK 2" },
  l: { button: "y", gameKey: "l", code: "KeyL", label: "PARRY" },
  Shift: { button: "y", gameKey: "Shift", code: "ShiftLeft", label: "DODGE" },
  e: { button: "b", gameKey: "e", code: "KeyE", label: "PHASE DASH" },
  r: { button: "select", gameKey: "r", code: "KeyR", label: "GRAVITY" },
  Enter: { button: "start", gameKey: "Enter", code: "Enter", label: "START" },
  Escape: { button: "select", gameKey: "Escape", code: "Escape", label: "BACK" },
};

const buttonLabels: Record<ButtonId, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  start: "Start",
  select: "Select",
};

const gameSlots = [
  { title: "ZERO HOUR", subtitle: "NIGHT TIDE", status: "PLAYABLE", accent: "cyan" },
  { title: "SILT RUNNER", subtitle: "COMING SOON", status: "SLOT 02", accent: "orange" },
  { title: "UNTITLED SIGNAL", subtitle: "RESERVED", status: "SLOT 03", accent: "muted" },
] as const;

function postGameKey(iframe: HTMLIFrameElement | null, action: "keydown" | "keyup", binding: Binding) {
  iframe?.contentWindow?.postMessage(
    { type: "joi-key", action, key: binding.gameKey, code: binding.code },
    "*",
  );
}

export function GameHandheld() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<ScreenMode>("menu");
  const [selectedGame, setSelectedGame] = useState(0);
  const [pressed, setPressed] = useState<Set<ButtonId>>(() => new Set());
  const [lastAction, setLastAction] = useState("SELECT A GAME");

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
    if (selectedGame !== 0) {
      setLastAction("SLOT NOT READY");
      return;
    }
    setMode("game");
    setLastAction("NIGHT TIDE ONLINE");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (mode === "menu") {
        if (key === "ArrowUp" || key === "w") {
          event.preventDefault();
          const binding = bindings[key];
          if (binding) press(binding.button, binding);
          setSelectedGame((value) => (value + gameSlots.length - 1) % gameSlots.length);
          setLastAction("SELECT PREVIOUS");
          return;
        }
        if (key === "ArrowDown" || key === "s") {
          event.preventDefault();
          const binding = bindings[key];
          if (binding) press(binding.button, binding);
          setSelectedGame((value) => (value + 1) % gameSlots.length);
          setLastAction("SELECT NEXT");
          return;
        }
        if (key === "Enter" || key === " " || key === "j") {
          event.preventDefault();
          const binding = bindings[key];
          if (binding) press(binding.button, binding);
          startSelectedGame();
          return;
        }
      }

      const binding = bindings[key];
      if (!binding || event.repeat) return;
      event.preventDefault();
      press(binding.button, binding);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const binding = bindings[key];
      if (binding) release(binding.button, binding);
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, selectedGame]);

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
          if (mode === "menu" && (button === "up" || button === "down")) {
            setSelectedGame((value) => button === "up"
              ? (value + gameSlots.length - 1) % gameSlots.length
              : (value + 1) % gameSlots.length);
            setLastAction(button === "up" ? "SELECT PREVIOUS" : "SELECT NEXT");
          }
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
        <div className={styles.handheldTopline}>
          <span>JOI / POCKET-03</span>
          <span>{mode === "menu" ? "GAME SELECT" : "NIGHT TIDE"}</span>
        </div>
        <div className={styles.screenHousing}>
          <div className={styles.screenGlow} />
          <div className={styles.screen}>
            {mode === "menu" ? (
              <div className={styles.menuScreen} role="listbox" aria-label="Game selection">
                <div className={styles.menuHeader}>
                  <span>ZERO HOUR // POCKET OS</span>
                  <span>03:07</span>
                </div>
                <div className={styles.menuTitle}>SELECT GAME</div>
                <div className={styles.gameList}>
                  {gameSlots.map((game, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedGame === index}
                      key={game.title}
                      className={`${styles.gameSlot} ${styles[`gameSlot${game.accent}`]} ${selectedGame === index ? styles.gameSlotActive : ""}`}
                      onClick={() => {
                        setSelectedGame(index);
                        if (index === 0) startSelectedGame();
                      }}
                    >
                      <span className={styles.slotNumber}>{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <strong>{game.title}</strong>
                        <small>{game.subtitle}</small>
                      </span>
                      <em>{game.status}</em>
                    </button>
                  ))}
                </div>
                <div className={styles.menuFooter}>
                  <span>W / S  SELECT</span>
                  <span>ENTER  START</span>
                </div>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                title="Zero Hour: Night Tide playable demo"
                src={GAME_BUILD_URL}
                allow="autoplay; fullscreen; gamepad"
                allowFullScreen
              />
            )}
          </div>
        </div>

        <div className={styles.deviceControls}>
          <div className={styles.dpad} aria-label="Directional pad">
            {renderButton("up", styles.dpadUp, "↑")}
            {renderButton("left", styles.dpadLeft, "←")}
            {renderButton("right", styles.dpadRight, "→")}
            {renderButton("down", styles.dpadDown, "↓")}
          </div>
          <div className={styles.centerControls}>
            {renderButton("select", styles.selectButton, "SELECT")}
            {renderButton("start", styles.startButton, "START")}
          </div>
          <div className={styles.faceButtons} aria-label="Action buttons">
            {renderButton("y", styles.faceY, "Y")}
            {renderButton("x", styles.faceX, "X")}
            {renderButton("b", styles.faceB, "B")}
            {renderButton("a", styles.faceA, "A")}
          </div>
        </div>
        <div className={styles.deviceBrand}>NIGHT TIDE <span>///</span> JOI LAB</div>
      </div>
      <div className={styles.handheldRail}>
        <div>
          <span className={styles.railLabel}>INPUT MONITOR</span>
          <strong>{lastAction}</strong>
        </div>
        <div className={styles.mappingList} aria-label="Keyboard mapping">
          <span><b>W / ↑</b> jump</span>
          <span><b>A / D</b> move</span>
          <span><b>J / K / L</b> action</span>
          <span><b>SHIFT</b> dodge</span>
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
