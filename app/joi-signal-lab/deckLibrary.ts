/**
 * The six records Gallo chose for the site-wide deck.
 *
 * A slot has two identities on purpose. `title` and `artist` are the words Gallo wants
 * printed on the sleeve; the query fields are the provider metadata needed to resolve
 * the exact recording. That distinction matters for the Wuthering Waves radio credit
 * and the Cyberpunk soundtrack, whose public-facing context is more useful here than a
 * long provider artist line.
 *
 * Every record also carries an original synthesised voicing. It is not an imitation of
 * the named song: it is a quiet fallback that keeps the object playable when Apple is
 * unavailable, with the requested sleeve and label left intact.
 */

export type Wish = {
  /** Printed on the site. */
  title: string;
  /** Printed on the site. */
  artist: string;
  /** Sent to the preview provider when its metadata uses another language or credit. */
  queryTitle?: string;
  queryArtist?: string;
  /** Optional album guard for a title with many covers and re-recordings. */
  collection?: string;
};

export type Preview = {
  /** Index of the slot this fills, so a partial answer still lands in the right place. */
  slot: number;
  id: string;
  /** Provider metadata, retained for diagnostics rather than replacing Gallo's label. */
  title: string;
  artist: string;
  duration: number;
  src: string;
  artwork: string | null;
};

export type PreviewResponse = {
  source: "itunes" | "offline";
  tracks: Preview[];
};

export type Side = {
  id: string;
  title: string;
  artist: string;
  note: string;
  /** The label's printed ring colour. */
  color: string;
  /** Original fallback voicing; never derived from the named recording. */
  chords: number[][];
};

export const WISHLIST: Wish[] = [
  {
    title: "陀飞轮",
    artist: "陈奕迅",
    queryTitle: "陀飛輪",
    queryArtist: "Eason Chan",
  },
  {
    title: "Running for Your Life",
    artist: "鸣潮先约电台",
    queryTitle: "Running For Your Life",
    queryArtist: "Wuthering Waves Casey Lee Williams",
  },
  {
    title: "NIGHT DANCER",
    artist: "imase",
    queryArtist: "imase",
  },
  {
    title: "All My Life (feat. J. Cole)",
    artist: "Lil Durk",
    queryTitle: "All My Life",
    queryArtist: "Lil Durk J. Cole",
  },
  {
    title: "Merry Christmas Mr. Lawrence",
    artist: "坂本龙一",
    queryArtist: "Ryuichi Sakamoto",
  },
  {
    title: "I Really Want to Stay at Your House",
    artist: "Cyberpunk 2077: Radio, Vol. 2",
    queryArtist: "Rosa Walton Hallie Coggins",
    collection: "Cyberpunk 2077: Radio, Vol. 2",
  },
];

const VOICINGS = [
  [[110, 164.81, 220], [98, 146.83, 196], [123.47, 185, 246.94]],
  [[130.81, 196, 261.63], [116.54, 174.61, 233.08], [146.83, 220, 293.66]],
  [[123.47, 185, 246.94], [138.59, 207.65, 277.18], [110, 164.81, 220]],
  [[98, 146.83, 196], [110, 164.81, 220], [82.41, 123.47, 164.81]],
  [[130.81, 196, 261.63], [146.83, 220, 293.66], [116.54, 174.61, 233.08]],
  [[82.41, 123.47, 164.81], [73.42, 110, 146.83], [92.5, 138.59, 185]],
] as const;

const COLORS = ["#e0733f", "#86b7d7", "#d4b85f", "#c97972", "#ddd7cb", "#bd5d4e"];
const TEMPOS = [72, 88, 96, 78, 64, 84];

export const SIDES: Side[] = WISHLIST.map((wish, index) => ({
  id: `gallo-side-${index + 1}`,
  title: wish.title,
  artist: wish.artist,
  note: `OFFLINE SIDE · ${TEMPOS[index]} BPM`,
  color: COLORS[index],
  chords: VOICINGS[index].map((chord) => [...chord]),
}));

export type Slot = Side & {
  src?: string;
  artwork?: string | null;
  duration?: number;
  /** What Apple matched, useful when inspecting a bad provider result. */
  previewTitle?: string;
  previewArtist?: string;
};

export const initialSlots = (): Slot[] => SIDES.map((side) => ({ ...side }));

export function applyPreviews(slots: Slot[], tracks: Preview[]): Slot[] {
  const bySlot = new Map(tracks.map((track) => [track.slot, track]));
  return slots.map((slot, index) => {
    const track = bySlot.get(index);
    if (!track) return slot;
    return {
      ...slot,
      src: track.src,
      artwork: track.artwork,
      duration: track.duration,
      previewTitle: track.title,
      previewArtist: track.artist,
    };
  });
}

/** The printed identity never changes when a provider resolves or fails. */
export const slotTitle = (slot: Slot) => slot.title;
export const slotArtist = (slot: Slot) => slot.artist;
