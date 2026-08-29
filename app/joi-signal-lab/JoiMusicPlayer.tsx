"use client";

import { useEffect, type CSSProperties } from "react";
import { useGlobalMusic } from "../../components/global-music/GlobalMusic";
import { slotArtist, slotTitle, type Slot } from "./deckLibrary";
import styles from "./joi-signal-lab.module.css";

type JoiMusicPlayerProps = {
  open: boolean;
  onClose: () => void;
  /** Put the deck camera back the way it was found after a drag. */
  onResetView: () => void;
};

/** Cover art as one layer in the sleeve's existing gradient stack. */
const art = (slot: Slot) => (slot.artwork ? `url("${slot.artwork}")` : "none");

/**
 * The room console is now only a view onto the site-wide player.
 *
 * The audio graph lives in `GlobalMusicProvider`, above the route tree. Returning null
 * here closes the controls and camera without touching playback, so the fixed sticker
 * can keep the same side running on every page.
 */
export function JoiMusicPlayer({ open, onClose, onResetView }: JoiMusicPlayerProps) {
  const {
    slots,
    source,
    loaded,
    current,
    playingId,
    isPlaying,
    elapsed,
    duration,
    progress,
    volume,
    tone,
    rpm,
    play,
    step,
    setVolume,
    setTone,
    setRpm,
  } = useGlobalMusic();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  if (!open) return null;

  const clock = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const audibleSide = current ?? loaded;
  const audibleSource = source === "loading" ? "loading" : audibleSide.src ? "itunes" : "offline";
  const sourceLabel = audibleSource === "loading"
    ? "READING THE SLEEVES…"
    : audibleSource === "itunes"
      ? "PREVIEWS · APPLE"
      : "SIDES · SYNTHESISED";

  return (
    <div
      className={styles.deckLayer}
      role="presentation"
      onPointerDownCapture={() => window.getSelection()?.removeAllRanges()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className={styles.deckTray} aria-hidden="true" />

      <div className={styles.deckSpeed}>
        <span>SPEED</span>
        <div role="group" aria-label="Platter speed">
          {[33 + 1 / 3, 45].map((value) => (
            <button
              key={value}
              type="button"
              className={Math.abs(rpm - value) < 0.01 ? styles.deckSpeedOn : ""}
              aria-pressed={Math.abs(rpm - value) < 0.01}
              onClick={() => setRpm(value)}
            >
              {value === 45 ? "45" : "33⅓"}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.deckAside}>
        <button type="button" onClick={onResetView} aria-label="Reset deck view">↺</button>
        <span>ROTATE</span>
      </div>

      <button type="button" className={styles.deckClose} onClick={onClose} aria-label="Leave the record player">
        ×
      </button>

      <p className={styles.deckHint} aria-hidden="true">← DRAG TO ROTATE →</p>

      <section className={styles.deckBar} aria-label="Record player">
        <div className={styles.deckNow}>
          <i style={{ "--record-color": loaded.color, "--record-art": art(loaded) } as CSSProperties} aria-hidden="true" />
          <div>
            <strong>{slotTitle(loaded)}</strong>
            <span>{slotArtist(loaded)}</span>
          </div>
        </div>

        <div className={styles.deckTransport}>
          <button type="button" onClick={() => { void step(-1); }} aria-label="Previous record">⏮</button>
          <button
            type="button"
            className={styles.deckPlay}
            onClick={() => { void play(current ?? loaded); }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={() => { void step(1); }} aria-label="Next record">⏭</button>
        </div>

        <div className={styles.deckSeek}>
          <span>{clock(elapsed)}</span>
          <div className={styles.deckTrack} aria-hidden="true">
            <i style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
          <span>{duration > 0 ? clock(duration) : "SIDE A"}</span>
        </div>

        <div className={styles.deckDials}>
          <label className={styles.deckDial}>
            <span>VOL</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
              aria-valuetext={`${Math.round(volume * 100)} percent`}
            />
          </label>
          <label className={styles.deckDial}>
            <span>TONE</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={tone}
              onChange={(event) => setTone(Number(event.target.value))}
              aria-label="Tone"
              aria-valuetext={`${Math.round(tone * 100)} percent`}
            />
          </label>
        </div>
      </section>

      <div className={styles.deckShelf}>
        <span>CHOOSE A RECORD</span>
        <p className={styles.deckSource} data-state={audibleSource}>{sourceLabel}</p>
        <div>
          {slots.map((slot, index) => (
            <button
              key={slot.id}
              type="button"
              className={playingId === slot.id ? styles.deckSleeveOn : ""}
              aria-pressed={playingId === slot.id}
              onClick={() => { void play(slot); }}
            >
              <i style={{ "--record-color": slot.color, "--record-art": art(slot) } as CSSProperties} aria-hidden="true">
                <b>{String(index + 1).padStart(2, "0")}</b>
              </i>
              <strong>{slotTitle(slot)}</strong>
              <span>{slot.src ? slotArtist(slot).toUpperCase() : slot.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
