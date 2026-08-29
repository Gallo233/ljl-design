"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyPreviews,
  initialSlots,
  slotArtist,
  slotTitle,
  type PreviewResponse,
  type Slot,
} from "../../app/joi-signal-lab/deckLibrary";
import styles from "./global-music.module.css";

const SIDE_SECONDS = 240;
/** Matches the lift / label swap / bounce timeline in `roomTurntable.ts`. */
const RECORD_SWAP_MS = 2150;

type ActiveSynth = {
  context: AudioContext;
  master: GainNode;
  lowShelf: BiquadFilterNode;
  highShelf: BiquadFilterNode;
  oscillators: OscillatorNode[];
  timer: number;
  chord: number[];
};

type MediaGraph = {
  context: AudioContext;
  master: GainNode;
  lowShelf: BiquadFilterNode;
  highShelf: BiquadFilterNode;
};

type Playback = {
  slotId: string;
  kind: "preview" | "synth";
  duration: number;
};

export type GlobalMusicValue = {
  slots: Slot[];
  source: "loading" | "itunes" | "offline";
  loaded: Slot;
  current: Slot | null;
  playingId: string | null;
  isPlaying: boolean;
  isSwitching: boolean;
  elapsed: number;
  duration: number;
  progress: number | null;
  /** Mechanically legible groove position; the seek bar keeps using exact progress. */
  tonearmProgress: number | null;
  volume: number;
  tone: number;
  rpm: number;
  play: (slotOrId: Slot | string) => Promise<void>;
  toggle: () => Promise<void>;
  stop: () => void;
  step: (direction: 1 | -1) => Promise<void>;
  setVolume: (volume: number) => void;
  setTone: (tone: number) => void;
  setRpm: (rpm: number) => void;
};

const MusicContext = createContext<GlobalMusicValue | null>(null);

export function useGlobalMusic() {
  const value = useContext(MusicContext);
  if (!value) throw new Error("useGlobalMusic must be used inside GlobalMusicProvider");
  return value;
}

/**
 * One audio engine for the whole site.
 *
 * It lives in the root layout, above every route. Closing the room console only removes
 * that console; navigating to a case study only swaps `children`. The media element and
 * Web Audio graph therefore survive both operations, which is the behaviour the fixed
 * sticker promises.
 */
export function GlobalMusicProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [source, setSource] = useState<"loading" | "itunes" | "offline">("loading");
  const [loadedId, setLoadedId] = useState(() => initialSlots()[0].id);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [tone, setTone] = useState(0.5);
  const [rpm, setRpm] = useState(33 + 1 / 3);

  const elementRef = useRef<HTMLAudioElement | null>(null);
  const mediaGraphRef = useRef<MediaGraph | null>(null);
  const synthRef = useRef<ActiveSynth | null>(null);
  const startedAtRef = useRef(0);
  const requestRef = useRef(0);
  const slotsRef = useRef(slots);
  const playbackRef = useRef(playback);
  const loadedIdRef = useRef(loadedId);
  const rpmRef = useRef(rpm);
  const volumeRef = useRef(volume);
  const toneRef = useRef(tone);
  slotsRef.current = slots;
  playbackRef.current = playback;
  loadedIdRef.current = loadedId;
  rpmRef.current = rpm;
  volumeRef.current = volume;
  toneRef.current = tone;

  // The fixed control is present on every route, so previews are useful immediately.
  // One same-origin request replaces six provider requests from the browser.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/previews?v=gallo-six-1", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((body: PreviewResponse) => {
        setSlots((previous) => applyPreviews(previous, body.tracks));
        setSource(body.tracks.length > 0 ? "itunes" : "offline");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSource("offline");
      });
    return () => controller.abort();
  }, []);

  const applyTone = (lowShelf: BiquadFilterNode, highShelf: BiquadFilterNode, value: number) => {
    const bipolar = (value - 0.5) * 2;
    const at = lowShelf.context.currentTime;
    lowShelf.gain.setTargetAtTime(-bipolar * 7, at, 0.05);
    highShelf.gain.setTargetAtTime(bipolar * 8, at, 0.05);
  };

  const ensureMediaGraph = useCallback(async () => {
    const existing = mediaGraphRef.current;
    if (existing) {
      if (existing.context.state === "suspended") await existing.context.resume();
      return existing;
    }
    const element = elementRef.current;
    if (!element) return null;
    try {
      const context = new AudioContext();
      const sourceNode = context.createMediaElementSource(element);
      const lowShelf = context.createBiquadFilter();
      const highShelf = context.createBiquadFilter();
      const master = context.createGain();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.value = 280;
      highShelf.type = "highshelf";
      highShelf.frequency.value = 2800;
      master.gain.value = volumeRef.current * volumeRef.current;
      sourceNode.connect(lowShelf).connect(highShelf).connect(master).connect(context.destination);
      applyTone(lowShelf, highShelf, toneRef.current);
      element.volume = 1;
      mediaGraphRef.current = { context, master, lowShelf, highShelf };
      await context.resume();
      return mediaGraphRef.current;
    } catch {
      // Direct element playback still gives the deck a usable volume control in a
      // browser that refuses a MediaElementSource. Tone stays neutral in that fallback.
      return null;
    }
  }, []);

  const silence = useCallback(() => {
    const element = elementRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }

    const active = synthRef.current;
    if (!active) return;
    window.clearInterval(active.timer);
    const now = active.context.currentTime;
    active.master.gain.cancelScheduledValues(now);
    active.master.gain.setValueAtTime(Math.max(active.master.gain.value, 0.0001), now);
    active.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    active.oscillators.forEach((oscillator) => oscillator.stop(now + 0.34));
    window.setTimeout(() => active.context.close().catch(() => {}), 400);
    synthRef.current = null;
  }, []);

  const stop = useCallback(() => {
    requestRef.current += 1;
    silence();
    playbackRef.current = null;
    setPlayback(null);
    setIsSwitching(false);
    setElapsed(0);
  }, [silence]);

  const startSynth = useCallback(async (slot: Slot, token: number) => {
    const context = new AudioContext();
    await context.resume();
    if (requestRef.current !== token) {
      await context.close().catch(() => {});
      return false;
    }

    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const lowShelf = context.createBiquadFilter();
    const highShelf = context.createBiquadFilter();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = 0.0001;
    filter.type = "lowpass";
    filter.frequency.value = 1250;
    filter.Q.value = 0.5;
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 280;
    highShelf.type = "highshelf";
    highShelf.frequency.value = 2800;
    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    master.connect(filter).connect(lowShelf).connect(highShelf).connect(compressor).connect(context.destination);
    applyTone(lowShelf, highShelf, toneRef.current);

    const rate = rpmRef.current / (33 + 1 / 3);
    const oscillators: OscillatorNode[] = [];
    slot.chords[0].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency * rate;
      oscillator.detune.value = index * 2.5 - 2.5;
      gain.gain.value = index === 0 ? 0.36 : 0.21;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      oscillators.push(oscillator);
    });

    const now = context.currentTime;
    master.gain.exponentialRampToValueAtTime(0.034 * volumeRef.current, now + 1.8);
    let chordIndex = 0;
    const active: ActiveSynth = {
      context,
      master,
      lowShelf,
      highShelf,
      oscillators,
      timer: 0,
      chord: slot.chords[0],
    };
    active.timer = window.setInterval(() => {
      chordIndex = (chordIndex + 1) % slot.chords.length;
      active.chord = slot.chords[chordIndex];
      const at = context.currentTime;
      const liveRate = rpmRef.current / (33 + 1 / 3);
      active.chord.forEach((frequency, index) => {
        oscillators[index].frequency.cancelScheduledValues(at);
        oscillators[index].frequency.setTargetAtTime(frequency * liveRate, at, 1.25);
      });
    }, 7200);
    synthRef.current = active;
    return true;
  }, []);

  const play = useCallback(async (slotOrId: Slot | string) => {
    const id = typeof slotOrId === "string" ? slotOrId : slotOrId.id;
    if (playbackRef.current?.slotId === id) {
      stop();
      return;
    }
    const slot = slotsRef.current.find((entry) => entry.id === id);
    if (!slot) return;

    const token = requestRef.current + 1;
    requestRef.current = token;
    const changingRecord = loadedIdRef.current !== id;
    silence();
    playbackRef.current = null;
    setPlayback(null);
    loadedIdRef.current = id;
    setLoadedId(id);
    setIsSwitching(changingRecord);
    if (changingRecord) {
      window.setTimeout(() => {
        if (requestRef.current === token) setIsSwitching(false);
      }, RECORD_SWAP_MS);
    }
    setElapsed(0);
    startedAtRef.current = performance.now();

    if (slot.src && elementRef.current) {
      const element = elementRef.current;
      element.src = slot.src;
      const graph = await ensureMediaGraph();
      element.volume = graph ? 1 : volumeRef.current;
      element.playbackRate = rpmRef.current / (33 + 1 / 3);
      try {
        await element.play();
        if (requestRef.current !== token) {
          element.pause();
          return;
        }
        const next = { slotId: id, kind: "preview" as const, duration: slot.duration || 30 };
        playbackRef.current = next;
        setPlayback(next);
        return;
      } catch {
        element.removeAttribute("src");
        setSlots((previous) => previous.map((entry) =>
          entry.id === id
            ? { ...entry, src: undefined, previewTitle: undefined, previewArtist: undefined }
            : entry,
        ));
      }
    }

    const started = await startSynth(slot, token).catch(() => false);
    if (!started || requestRef.current !== token) return;
    const next = { slotId: id, kind: "synth" as const, duration: SIDE_SECONDS };
    playbackRef.current = next;
    setPlayback(next);
  }, [ensureMediaGraph, silence, startSynth, stop]);

  const toggle = useCallback(async () => {
    if (playbackRef.current || isSwitching) {
      stop();
      return;
    }
    await play(loadedId);
  }, [isSwitching, loadedId, play, stop]);

  const step = useCallback(async (direction: 1 | -1) => {
    const liveSlots = slotsRef.current;
    const activeId = playbackRef.current?.slotId ?? loadedId;
    const index = liveSlots.findIndex((slot) => slot.id === activeId);
    const next = liveSlots[
      (((index === -1 ? 0 : index) + direction) + liveSlots.length) % liveSlots.length
    ];
    await play(next.id);
  }, [loadedId, play]);

  useEffect(() => {
    const rate = rpm / (33 + 1 / 3);
    if (elementRef.current) elementRef.current.playbackRate = rate;
    const active = synthRef.current;
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
    const media = mediaGraphRef.current;
    if (media) {
      media.master.gain.setTargetAtTime(volume * volume, media.context.currentTime, 0.05);
      if (elementRef.current) elementRef.current.volume = 1;
    } else if (elementRef.current) {
      elementRef.current.volume = volume;
    }
    const active = synthRef.current;
    if (!active) return;
    active.master.gain.setTargetAtTime(0.034 * volume, active.context.currentTime, 0.2);
  }, [volume]);

  useEffect(() => {
    const media = mediaGraphRef.current;
    if (media) applyTone(media.lowShelf, media.highShelf, tone);
    const active = synthRef.current;
    if (active) applyTone(active.lowShelf, active.highShelf, tone);
  }, [tone]);

  useEffect(() => {
    if (!playback) return;
    const tick = () => {
      const next = playback.kind === "preview" && elementRef.current
        ? elementRef.current.currentTime
        : (performance.now() - startedAtRef.current) / 1000;
      setElapsed(next);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [playback]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const onEnded = () => stop();
    element.addEventListener("ended", onEnded);
    return () => element.removeEventListener("ended", onEnded);
  }, [stop]);

  useEffect(() => () => {
    requestRef.current += 1;
    silence();
    mediaGraphRef.current?.context.close().catch(() => {});
    mediaGraphRef.current = null;
  }, [silence]);

  const loaded = slots.find((slot) => slot.id === loadedId) ?? slots[0];
  const current = playback
    ? slots.find((slot) => slot.id === playback.slotId) ?? null
    : null;
  const duration = playback?.duration ?? 0;
  const progress = playback && duration > 0 ? Math.min(elapsed / duration, 1) : null;
  /*
   * A record does not begin with four minutes of equally pitched programme groove.
   * The stylus first crosses the visibly wider lead-in, then settles into the slow
   * inward crawl. Keeping that mechanical lead-in separate from the exact seek value
   * makes a four-minute synthesised side readable without lying in the timer or bar.
   */
  const tonearmProgress = progress === null
    ? null
    : Math.min(1, (1 - Math.exp(-elapsed / 2.2)) * 0.11 + progress * 0.89);

  const value = useMemo<GlobalMusicValue>(() => ({
    slots,
    source,
    loaded,
    current,
    playingId: playback?.slotId ?? null,
    isPlaying: playback !== null,
    isSwitching,
    elapsed,
    duration,
    progress,
    tonearmProgress,
    volume,
    tone,
    rpm,
    play,
    toggle,
    stop,
    step,
    setVolume,
    setTone,
    setRpm,
  }), [
    slots, source, loaded, current, playback, isSwitching, elapsed, duration, progress,
    tonearmProgress,
    volume, tone, rpm, play, toggle, stop, step,
  ]);

  return (
    <MusicContext.Provider value={value}>
      {children}
      <GlobalMusicSticker />
      <audio ref={elementRef} preload="none" crossOrigin="anonymous" hidden />
    </MusicContext.Provider>
  );
}

function GlobalMusicSticker() {
  const { loaded, isPlaying, isSwitching, source, toggle } = useGlobalMusic();
  const sourceLabel = isSwitching
    ? "CHANGING SIDE"
    : source === "loading"
      ? "TUNING"
      : loaded.src
        ? "30 SEC MIX"
        : "OFFLINE SIDE";

  return (
    <button
      type="button"
      className={styles.sticker}
      data-playing={isPlaying ? "true" : "false"}
      data-switching={isSwitching ? "true" : "false"}
      onClick={() => { void toggle(); }}
      aria-label={isPlaying ? `暂停 ${slotTitle(loaded)}` : `播放 ${slotTitle(loaded)}`}
      aria-pressed={isPlaying}
    >
      <span className={styles.disc} aria-hidden="true">
        <i />
        <b>{isSwitching ? "↻" : isPlaying ? "Ⅱ" : "▶"}</b>
      </span>
      <span className={styles.copy}>
        <strong>{slotTitle(loaded)}</strong>
        <small>{slotArtist(loaded)} · {sourceLabel}</small>
      </span>
      <span className={styles.spark} aria-hidden="true">✦</span>
    </button>
  );
}
