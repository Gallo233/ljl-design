/**
 * Sound for the three canvas games, synthesised.
 *
 * The two Godot cartridges carry recorded audio in their packs. These three never had
 * any — no code and no assets — so rather than source a sample library for three games
 * that are a few hundred lines each, the sound is generated: square and triangle
 * oscillators, short envelopes, a noise burst for impacts. That is what these machines
 * sounded like, and it costs no bytes over the wire.
 *
 * ## One context, owned by the shell
 *
 * `GameHandheld` builds this when a cartridge is inserted — a real click, which is what
 * lets an AudioContext start at all — and disposes it on eject. A game never touches the
 * browser directly; it calls `context.audio.sfx("eat")`, the same way it never touches
 * the DOM for input. That keeps the games portable between the handheld and the bench.
 *
 * ## Why the music is scheduled ahead rather than per frame
 *
 * A frame-driven sequencer inherits every stutter the render loop has, and these games
 * share a page with a 3D console. So the loop runs off the AudioContext's own clock: a
 * 25 ms timer walks a cursor 120 ms into the future and books notes at exact times. The
 * audio thread plays them whether or not a frame happened to land.
 */

type Wave = OscillatorType;

/** A note in a loop: semitones from A3, how long it lasts, how loud. Null is a rest. */
type Note = [semitone: number | null, beats: number, gain?: number];

export type SfxName =
  | "move"
  | "turn"
  | "eat"
  | "power"
  | "lock"
  | "rotate"
  | "clear"
  | "levelUp"
  | "hit"
  | "die"
  | "start";

export type TrackId = "snake" | "tetris" | "pacman";

export type GameAudio = {
  sfx: (name: SfxName) => void;
  /** Start a loop, or `null` to stop. Re-selecting the running track does nothing. */
  music: (id: TrackId | null) => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  dispose: () => void;
};

const A3 = 220;
const hz = (semitone: number) => A3 * Math.pow(2, semitone / 12);

/**
 * Three loops, written rather than borrowed.
 *
 * Deliberately not Korobeiniki: the folk tune is old enough to be free, but a chiptune of
 * it over a falling-block game is the trademark, not the melody. These are ours — a
 * bouncing major line for the snake, a minor ostinato for the blocks, a chirpy round for
 * the maze — so nothing here is anyone else's to object to.
 */
const TRACKS: Record<TrackId, { bpm: number; wave: Wave; gain: number; lead: Note[]; bass: Note[] }> = {
  snake: {
    bpm: 132,
    wave: "square",
    gain: 0.055,
    lead: [
      [12, 0.5], [16, 0.5], [19, 0.5], [16, 0.5],
      [14, 0.5], [17, 0.5], [21, 1.0],
      [12, 0.5], [16, 0.5], [19, 0.5], [24, 0.5],
      [21, 0.5], [19, 0.5], [16, 1.0],
    ],
    bass: [
      [0, 1.0], [0, 1.0], [5, 1.0], [5, 1.0],
      [0, 1.0], [0, 1.0], [7, 1.0], [5, 1.0],
    ],
  },
  tetris: {
    bpm: 144,
    wave: "square",
    gain: 0.05,
    lead: [
      [12, 0.5], [15, 0.25], [17, 0.25], [19, 0.5], [17, 0.25], [15, 0.25],
      [12, 0.5], [12, 0.25], [17, 0.25], [19, 1.0],
      [20, 0.5], [19, 0.25], [17, 0.25], [15, 0.75], [12, 0.25],
      [12, 0.5], [17, 0.5], [12, 1.0],
    ],
    bass: [
      [-12, 0.75], [-5, 0.25], [-12, 0.75], [-5, 0.25],
      [-10, 0.75], [-3, 0.25], [-12, 0.75], [-5, 0.25],
    ],
  },
  pacman: {
    bpm: 150,
    wave: "triangle",
    gain: 0.06,
    lead: [
      [12, 0.25], [24, 0.25], [19, 0.25], [16, 0.25],
      [23, 0.25], [19, 0.25], [16, 0.5],
      [13, 0.25], [25, 0.25], [20, 0.25], [17, 0.25],
      [24, 0.25], [20, 0.25], [17, 0.5],
    ],
    bass: [
      [0, 0.5], [null, 0.5], [0, 0.5], [null, 0.5],
      [1, 0.5], [null, 0.5], [1, 0.5], [null, 0.5],
    ],
  },
};

export function createGameAudio(): GameAudio {
  const Ctor: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    // No Web Audio: the games are still games. Every call becomes a no-op rather than
    // making each caller check.
    return {
      sfx: () => {}, music: () => {}, setMuted: () => {}, isMuted: () => true, dispose: () => {},
    };
  }

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const musicBus = ctx.createGain();
  musicBus.gain.value = 1;
  musicBus.connect(master);
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(master);

  let muted = false;
  let track: TrackId | null = null;
  let timer = 0;
  let cursor = 0;
  let leadStep = 0;
  let bassStep = 0;
  const live: Array<{ stop: () => void }> = [];

  /** One oscillator with a percussive envelope. Everything here is built from this. */
  const tone = (
    bus: GainNode,
    wave: Wave,
    frequency: number,
    at: number,
    duration: number,
    peak: number,
    slideTo?: number,
  ) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, at);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), at + duration);
    // A 6 ms attack: enough to stop the click a hard start makes, short enough to stay percussive.
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(bus);
    osc.start(at);
    osc.stop(at + duration + 0.02);
    const entry = { stop: () => { try { osc.stop(); } catch { /* already stopped */ } } };
    live.push(entry);
    osc.onended = () => {
      const index = live.indexOf(entry);
      if (index >= 0) live.splice(index, 1);
    };
  };

  /** Filtered white noise, for impacts — a square wave cannot do a thud. */
  const noise = (at: number, duration: number, peak: number, from: number, to: number) => {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + duration);
    filter.Q.value = 1.1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(env).connect(sfxBus);
    source.start(at);
  };

  const SFX: Record<SfxName, (at: number) => void> = {
    // Short, dry, and pitched apart from each other so two in a row are distinguishable.
    move: (at) => tone(sfxBus, "square", 320, at, 0.045, 0.10),
    turn: (at) => tone(sfxBus, "square", 480, at, 0.05, 0.09),
    eat: (at) => { tone(sfxBus, "square", 640, at, 0.07, 0.16); tone(sfxBus, "square", 960, at + 0.05, 0.09, 0.13); },
    power: (at) => [0, 4, 7, 12].forEach((s, i) => tone(sfxBus, "triangle", hz(12 + s), at + i * 0.06, 0.11, 0.16)),
    rotate: (at) => tone(sfxBus, "square", 540, at, 0.05, 0.11, 700),
    lock: (at) => { noise(at, 0.09, 0.24, 900, 180); tone(sfxBus, "triangle", 150, at, 0.1, 0.16, 90); },
    clear: (at) => [0, 5, 9, 14, 17].forEach((s, i) => tone(sfxBus, "square", hz(12 + s), at + i * 0.055, 0.13, 0.17)),
    levelUp: (at) => [0, 7, 12, 19].forEach((s, i) => tone(sfxBus, "triangle", hz(12 + s), at + i * 0.08, 0.2, 0.18)),
    hit: (at) => { noise(at, 0.16, 0.3, 1400, 200); tone(sfxBus, "square", 220, at, 0.16, 0.16, 70); },
    die: (at) => {
      tone(sfxBus, "square", 440, at, 0.7, 0.2, 60);
      noise(at + 0.05, 0.5, 0.16, 800, 90);
    },
    start: (at) => [0, 7, 12].forEach((s, i) => tone(sfxBus, "square", hz(12 + s), at + i * 0.07, 0.12, 0.16)),
  };

  const sfx = (name: SfxName) => {
    if (muted) return;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    // A hair in the future: scheduling at exactly `currentTime` can land in a block the
    // audio thread has already rendered, which drops the front of the envelope.
    SFX[name]?.(ctx.currentTime + 0.005);
  };

  const beat = () => 60 / (track ? TRACKS[track].bpm : 120);

  const schedule = () => {
    if (!track || muted) return;
    const spec = TRACKS[track];
    const horizon = ctx.currentTime + 0.12;
    // Lead and bass advance independently, so loops of different lengths stay in phase
    // with the clock rather than with each other's bar counts.
    while (cursor < horizon) {
      const note = spec.lead[leadStep % spec.lead.length];
      const bassNote = spec.bass[bassStep % spec.bass.length];
      const duration = note[1] * beat();
      if (note[0] !== null) {
        tone(musicBus, spec.wave, hz(note[0]), cursor, duration * 0.9, spec.gain * (note[2] ?? 1));
      }
      if (bassNote[0] !== null && leadStep % 2 === 0) {
        tone(musicBus, "triangle", hz(bassNote[0]), cursor, beat() * 0.85, spec.gain * 0.9);
        bassStep += 1;
      }
      cursor += duration;
      leadStep += 1;
    }
  };

  const music = (id: TrackId | null) => {
    if (id === track) return;
    track = id;
    window.clearInterval(timer);
    timer = 0;
    if (!id) return;
    leadStep = 0;
    bassStep = 0;
    cursor = ctx.currentTime + 0.08;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    timer = window.setInterval(schedule, 25);
    schedule();
  };

  return {
    sfx,
    music,
    setMuted: (next) => {
      muted = next;
      master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.02);
      if (next) {
        // Silence is not enough on its own: the scheduler would keep booking notes into
        // a muted bus and they would all arrive at once on unmute.
        window.clearInterval(timer);
        timer = 0;
      } else if (track && !timer) {
        cursor = ctx.currentTime + 0.08;
        timer = window.setInterval(schedule, 25);
      }
    },
    isMuted: () => muted,
    dispose: () => {
      window.clearInterval(timer);
      timer = 0;
      track = null;
      live.slice().forEach((entry) => entry.stop());
      void ctx.close().catch(() => {});
    },
  };
}
