"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMAND_NAMES,
  completeInput,
  runCommand,
  welcomeLines,
  type TerminalLine,
} from "./terminalProgram";
import styles from "./room-terminal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** A route, a section of this page, or an external address. */
  onOpenHref: (href: string) => void;
};

/** One printed block, kept as a unit so the echoed command stays with its answer. */
type Block = { id: number; prompt?: string; lines: TerminalLine[] };

/**
 * The machine on the desk, opened.
 *
 * `terminalProgram.ts` is what it knows and why it is DOM rather than a texture on the
 * laptop's screen mesh. This file is only the shell: scrollback, a command line, history,
 * completion, and the keys the reference's terminal answers to.
 *
 * The input is a real `<input>`, which is the one place being DOM pays off twice. The
 * reference had to hide a 1px text field behind its canvas and forward keystrokes into it
 * to raise an iOS keyboard at all; here the field *is* the prompt, so the mobile keyboard,
 * IME composition and screen readers all work without a bridge.
 */
export function TerminalSheet({ open, onClose, onOpenHref }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [input, setInput] = useState("");
  const [recallIndex, setRecallIndex] = useState<number | null>(null);
  const historyRef = useRef<string[]>([]);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const print = useCallback((lines: TerminalLine[], prompt?: string) => {
    if (lines.length === 0 && !prompt) return;
    nextId.current += 1;
    setBlocks((previous) => [...previous, { id: nextId.current, prompt, lines }]);
  }, []);

  // The banner is printed on open rather than held as initial state, so re-opening the
  // panel is a fresh session rather than yesterday's scrollback with a second banner.
  useEffect(() => {
    if (!open) return;
    historyRef.current = [];
    setBlocks([]);
    setInput("");
    setRecallIndex(null);
    nextId.current += 1;
    setBlocks([{ id: nextId.current, lines: welcomeLines() }]);
    // Focus after paint: the panel animates in, and focusing a not-yet-laid-out field
    // scrolls the page behind the overlay on Safari.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  // Always looking at the newest line, the way a terminal does.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [blocks]);

  const submit = useCallback(() => {
    const entered = input;
    setInput("");
    setRecallIndex(null);
    const trimmed = entered.trim();
    if (!trimmed) {
      print([], "");
      return;
    }
    // History is read by the `history` command, so it is recorded before the run.
    const context = {
      open: onOpenHref,
      close: onClose,
      clear: () => setBlocks([]),
      history: historyRef.current,
    };
    const lines = runCommand(trimmed, context);
    historyRef.current = [...historyRef.current, trimmed];
    // `clear` empties the scrollback inside the run; printing its echo afterwards would
    // leave one stray prompt on an otherwise empty screen.
    if (trimmed.split(/\s+/)[0].toLowerCase() === "clear") return;
    print(lines, entered);
  }, [input, onClose, onOpenHref, print]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const history = historyRef.current;

    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const completed = completeInput(input);
      if (completed) {
        setInput(completed);
        return;
      }
      // Nothing unique to complete to, so show the candidates instead of doing nothing.
      const head = input.trim().toLowerCase();
      const matches = COMMAND_NAMES.filter((name) => name.startsWith(head));
      if (head && matches.length > 1) print([{ text: `  ${matches.join("   ")}`, tone: "dim" }]);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next = recallIndex === null ? history.length - 1 : Math.max(0, recallIndex - 1);
      setRecallIndex(next);
      setInput(history[next]);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (recallIndex === null) return;
      const next = recallIndex + 1;
      if (next >= history.length) {
        setRecallIndex(null);
        setInput("");
        return;
      }
      setRecallIndex(next);
      setInput(history[next]);
      return;
    }

    // The reference's clear-screen key, and the one every shell has.
    if (event.key.toLowerCase() === "l" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setBlocks([]);
    }
  }, [input, print, recallIndex, submit]);

  if (!open) return null;

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Desk terminal">
      <button className={styles.backdrop} type="button" aria-label="Close terminal" onClick={onClose} />
      <div className={styles.panel}>
        <header className={styles.head}>
          <span>TERMINAL / 终端</span>
          <button className={styles.close} type="button" onClick={onClose}>CLOSE · ESC</button>
        </header>

        {/*
          The scrollback is a log, so it is announced politely rather than as an alert —
          a screen reader should hear the answer, not be interrupted mid-word by it.
        */}
        <div className={styles.screen} onClick={() => inputRef.current?.focus()}>
          <div className={styles.scroll} ref={scrollRef} role="log" aria-live="polite">
            {blocks.map((block) => (
              <div key={block.id} className={styles.block}>
                {block.prompt !== undefined && (
                  <p className={styles.echo}>
                    <span className={styles.caret}>{">"}</span>
                    {block.prompt}
                  </p>
                )}
                {block.lines.map((entry, index) => (
                  <p
                    key={index}
                    className={`${styles.line} ${(entry.tone && styles[entry.tone]) || ""}`}
                  >
                    {entry.text || " "}
                  </p>
                ))}
              </div>
            ))}

            <label className={styles.prompt}>
              <span className={styles.caret} aria-hidden="true">{">"}</span>
              <input
                ref={inputRef}
                className={styles.input}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Terminal command"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
              />
            </label>
          </div>
        </div>

        <p className={styles.hint}>
          <span>TAB 补全 · ↑ ↓ 历史 · CTRL+L 清屏</span>
          <span className={styles.hintEn}>TAB · ARROWS · CTRL+L</span>
        </p>
      </div>
    </div>
  );
}
