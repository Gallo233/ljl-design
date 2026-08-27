"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./joi-signal-lab.module.css";

type JoiMusicPlayerProps = {
  open: boolean;
  onClose: () => void;
  /**
   * A record the room has just dropped on the turntable. The panel is not the only way
   * in any more — carrying a record across the desk starts the same three mixes — so
   * the deck asks for a mix by id and this owns the audio either way.
   */
  /** Fires whenever playback starts or stops, so the platter knows to turn. */
  onPlayingChange?: (mixId: string | null) => void;
  /**
   * How far through the side we are, 0 to 1, or null when nothing is playing. The
   * tonearm rides this, so it tracks inward exactly as far as the music has run.
   */
  onProgressChange?: (progress: number | null) => void;
  /** 33⅓ or 45, owned by the host so the platter and the pitch stay in step. */
  rpm: number;
  onRpmChange: (rpm: number) => void;
  /** Put the deck back the way it was found after a drag. */
  onResetView: () => void;
};

type Mix = {
  id: string;
  title: string;
  /** Shown under the title, where a record player would name the artist. */
  artist: string;
  note: string;
  color: string;
  /**
   * The seam for real audio. Leave it out and the track is synthesised here, which is
   * what ships today — no files, nothing copyrighted, nothing to download. Point it at a
   * committed file under `public/` and this plays that instead, with a real duration and
   * a working scrubber. Nothing else in the deck has to change.
   */
  src?: string;
  /** Fallback voicing for the synthesised version. Ignored when `src` is set. */
  chords: number[][];
};

/**
 * How long a synthesised side runs before the arm reaches the run-out and lifts. The
 * generative mixes never actually end, so this is the length we agree to call a side —
 * it exists to give the tonearm somewhere to travel.
 */
const SIDE_SECONDS = 240;

const MIXES: Mix[] = [
  {
    id: "blue-hour",
    title: "BLUE HOUR",
    artist: "Gallo",
    note: "GUANGZHOU · 72 BPM",
    color: "#86b7d7",
    chords: [[110, 164.81, 220], [98, 146.83, 196], [123.47, 185, 246.94]],
  },
  {
    id: "joi-signal",
    title: "JOI SIGNAL",
    artist: "Gallo",
    note: "SYSTEM DREAM · 64 BPM",
    color: "#ec7358",
    chords: [[130.81, 196, 261.63], [116.54, 174.61, 233.08], [146.83, 220, 293.66]],
  },
  {
    id: "night-bus",
    title: "NIGHT BUS",
    artist: "Gallo",
    note: "AFTER RAIN · 58 BPM",
    color: "#ddd7cb",
    chords: [[82.41, 123.47, 164.81], [73.42, 110, 146.83], [92.5, 138.59, 185]],
  },
];

type ActiveAudio = {
  context: AudioContext;
  master: GainNode;
  oscillators: OscillatorNode[];
  voices: GainNode[];
  timer: number;
  /**
   * The chord being held, at 33⅓. Speed changes multiply *this*, not the frequency
   * currently on the oscillator — rescaling a value that already carries the old rate
   * compounds it, and the pitch walks away a little further every time the switch is
   * touched.
   */
  chord: number[];
};

/**
 * Three tiny generative ambient records. They begin only after a visitor gesture,
 * stay deliberately quiet, and require no external/copyrighted audio files.
 */
export function JoiMusicPlayer({
  open,
  onClose,
  onPlayingChange,
  onProgressChange,
  rpm,
  onRpmChange,
  onResetView,
}: JoiMusicPlayerProps) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<ActiveAudio | null>(null);
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef(0);

  const current = MIXES.find((mix) => mix.id === playing) ?? null;
  const duration = current?.src ? elementRef.current?.duration || 0 : SIDE_SECONDS;

  const stop = (updateState = true) => {
    const element = elementRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    const active = audioRef.current;
    if (active) {
      window.clearInterval(active.timer);
      const now = active.context.currentTime;
      active.master.gain.cancelScheduledValues(now);
      active.master.gain.setValueAtTime(Math.max(active.master.gain.value, 0.0001), now);
      active.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      active.oscillators.forEach((oscillator) => oscillator.stop(now + 0.46));
      window.setTimeout(() => active.context.close().catch(() => {}), 520);
      audioRef.current = null;
    }
    if (updateState) {
      setPlaying(null);
      setElapsed(0);
    }
  };

  const play = async (mix: Mix) => {
    if (playing === mix.id) {
      stop();
      return;
    }
    stop(false);
    startedAtRef.current = performance.now();
    setElapsed(0);

    // The seam: a track with a file plays the file, a track without one is synthesised.
    if (mix.src) {
      const element = elementRef.current;
      if (element) {
        element.src = mix.src;
        element.volume = volume;
        // 45 spins a third faster than 33⅓, and a record played fast sounds fast.
        element.playbackRate = rpm / (33 + 1 / 3);
        await element.play().catch(() => {});
      }
      setPlaying(mix.id);
      return;
    }

    const context = new AudioContext();
    await context.resume();

    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = 0.0001;
    filter.type = "lowpass";
    filter.frequency.value = 1250;
    filter.Q.value = 0.5;
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    master.connect(filter).connect(compressor).connect(context.destination);

    // The speed switch is a real pitch change here too, for the same reason.
    const rate = rpm / (33 + 1 / 3);
    const oscillators: OscillatorNode[] = [];
    const voices: GainNode[] = [];
    mix.chords[0].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency * rate;
      oscillator.detune.value = index * 2.5 - 2.5;
      gain.gain.value = index === 0 ? 0.36 : 0.21;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      oscillators.push(oscillator);
      voices.push(gain);
    });

    const now = context.currentTime;
    master.gain.exponentialRampToValueAtTime(0.034 * volume, now + 1.8);
    let chordIndex = 0;
    const advance = () => {
      chordIndex = (chordIndex + 1) % mix.chords.length;
      const at = context.currentTime;
      const live = rpmRef.current / (33 + 1 / 3);
      if (audioRef.current) audioRef.current.chord = mix.chords[chordIndex];
      mix.chords[chordIndex].forEach((frequency, index) => {
        oscillators[index].frequency.cancelScheduledValues(at);
        oscillators[index].frequency.setTargetAtTime(frequency * live, at, 1.25);
      });
    };
    const timer = window.setInterval(advance, 7200);
    audioRef.current = { context, master, oscillators, voices, timer, chord: mix.chords[0] };
    setPlaying(mix.id);
  };

  // `rpm` changes while a chord is held, so the interval reads it from a ref rather than
  // from the closure it was created in.
  const rpmRef = useRef(rpm);
  useEffect(() => { rpmRef.current = rpm; }, [rpm]);

  // Speed changes take effect on whatever is already playing.
  useEffect(() => {
    const rate = rpm / (33 + 1 / 3);
    if (elementRef.current) elementRef.current.playbackRate = rate;
    const active = audioRef.current;
    if (!active) return;
    const at = active.context.currentTime;
    active.oscillators.forEach((oscillator, index) => {
      const base = active.chord[index];
      if (base === undefined) return;
      oscillator.frequency.cancelScheduledValues(at);
      oscillator.frequency.setTargetAtTime(base * rate, at, 0.4);
    });
  }, [rpm]);

  useEffect(() => {
    if (elementRef.current) elementRef.current.volume = volume;
    const active = audioRef.current;
    if (!active) return;
    const at = active.context.currentTime;
    active.master.gain.setTargetAtTime(0.034 * volume, at, 0.2);
  }, [volume]);

  // One timer drives the readout and the tonearm together, so the arm can never be
  // somewhere the clock disagrees with.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const element = elementRef.current;
      const next = current?.src && element
        ? element.currentTime
        : (performance.now() - startedAtRef.current) / 1000;
      setElapsed(next);
    };
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [playing, current?.src]);

  const progress = playing && duration > 0 ? Math.min(elapsed / duration, 1) : null;

  const onProgressChangeRef = useRef(onProgressChange);
  useEffect(() => { onProgressChangeRef.current = onProgressChange; }, [onProgressChange]);
  useEffect(() => { onProgressChangeRef.current?.(progress); }, [progress]);

  const step = (direction: 1 | -1) => {
    const index = MIXES.findIndex((mix) => mix.id === playing);
    const next = MIXES[(((index === -1 ? 0 : index) + direction) + MIXES.length) % MIXES.length];
    play(next);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  const onPlayingChangeRef = useRef(onPlayingChange);
  useEffect(() => { onPlayingChangeRef.current = onPlayingChange; }, [onPlayingChange]);
  useEffect(() => { onPlayingChangeRef.current?.(playing); }, [playing]);

  useEffect(() => () => stop(false), []);

  if (!open) return null;

  const clock = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  return (
    <div className={styles.deckLayer} role="presentation">
      {/* The controls at the bottom need a ground of their own; the room does not
          provide one, and ink on a black plinth is not a design. */}
      <div className={styles.deckTray} aria-hidden="true" />
      {/* Present whether or not a track has a file, so the seam needs no new markup. */}
      <audio ref={elementRef} preload="none" hidden />

      <div className={styles.deckSpeed}>
        <span>SPEED</span>
        <div role="group" aria-label="Platter speed">
          {[33 + 1 / 3, 45].map((value) => (
            <button
              key={value}
              type="button"
              className={Math.abs(rpm - value) < 0.01 ? styles.deckSpeedOn : ""}
              aria-pressed={Math.abs(rpm - value) < 0.01}
              onClick={() => onRpmChange(value)}
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
          <i style={{ "--record-color": current?.color ?? "#5b6b76" } as CSSProperties} aria-hidden="true" />
          <div>
            <strong>{current ? current.title : "NO RECORD"}</strong>
            <span>{current ? current.artist : "CHOOSE ONE BELOW"}</span>
          </div>
        </div>

        <div className={styles.deckTransport}>
          <button type="button" onClick={() => step(-1)} aria-label="Previous record">⏮</button>
          <button
            type="button"
            className={styles.deckPlay}
            onClick={() => (current ? play(current) : play(MIXES[0]))}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next record">⏭</button>
        </div>

        <div className={styles.deckSeek}>
          <span>{clock(elapsed)}</span>
          <div className={styles.deckTrack} aria-hidden="true">
            <i style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
          <span>{current?.src ? clock(duration) : "SIDE A"}</span>
        </div>

        <label className={styles.deckVolume}>
          <span aria-hidden="true">🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </label>
      </section>

      <div className={styles.deckShelf}>
        <span>CHOOSE A RECORD</span>
        <div>
          {MIXES.map((mix, index) => (
            <button
              key={mix.id}
              type="button"
              className={playing === mix.id ? styles.deckSleeveOn : ""}
              aria-pressed={playing === mix.id}
              onClick={() => play(mix)}
            >
              <i style={{ "--record-color": mix.color } as CSSProperties} aria-hidden="true">
                <b>{String(index + 1).padStart(2, "0")}</b>
              </i>
              <strong>{mix.title}</strong>
              <span>{mix.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
