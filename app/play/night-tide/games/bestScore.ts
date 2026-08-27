/**
 * High scores that survive leaving the room.
 *
 * Snake has drawn a BEST readout since it was written and the number behind it lived in
 * a closure, so it reset every time the cartridge was ejected or the page reloaded — the
 * shell was promising a record it had no way to keep.
 *
 * Everything here is wrapped, because `localStorage` is not merely empty in a private
 * window or with site data blocked: *reading the property itself* throws in some
 * browsers. A game centre is not worth a crash, so a store that cannot be reached simply
 * behaves like one that has never been played.
 */

const KEY_PREFIX = "joi:best:";

function read(gameId: string): number {
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${gameId}`);
    if (!raw) return 0;
    const value = Number.parseInt(raw, 10);
    // A hand-edited or half-written value is not a reason to show NaN on the screen.
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function write(gameId: string, value: number) {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${gameId}`, String(value));
  } catch {
    // Private mode, blocked site data, or a full quota. The run still counts in memory.
  }
}

export type BestScore = {
  /** The record as it stands, including anything set this session. */
  get: () => number;
  /** Offer a score; returns true if it beat the record. */
  submit: (score: number) => boolean;
};

export function createBestScore(gameId: string): BestScore {
  let best = read(gameId);
  return {
    get: () => best,
    submit: (score) => {
      if (!Number.isFinite(score) || score <= best) return false;
      best = Math.floor(score);
      write(gameId, best);
      return true;
    },
  };
}
