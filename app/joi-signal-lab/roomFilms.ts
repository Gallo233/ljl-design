/**
 * The camera's film rolls.
 *
 * The shelf UI is built from this data alone — roll names, exposure counts, and the
 * edge markings printed along the filmstrip are all drawn, not photographed, which is
 * the site's standing rule: drawn things may look drawn, they must never pretend to be
 * something else.
 *
 * Real photographs slot in by dropping files at the paths listed below; a frame whose
 * file is missing renders as the placeholder slate. That is the whole asset contract:
 * the page never ships a broken figure, and the author never edits code to add photos.
 *
 * // COPY-REVIEW: roll grouping is a placeholder awaiting the author's real rolls.
 */

// COPY-REVIEW: roll names/groups are placeholders.

export type RoomFilmFrame = {
  /** Where the real scan lives once the author drops it in. */
  src: string;
  caption: string;
};

export type RoomFilmRoll = {
  id: string;
  title: string;
  year: string;
  /** Stock printed on the strip's edge. */
  stock: string;
  iso: string;
  edgeText: string;
  accent: string;
  frames: RoomFilmFrame[];
};

const frame = (roll: string, index: number, caption: string): RoomFilmFrame => ({
  src: `/media/films/${roll}/${String(index).padStart(2, "0")}.jpg`,
  caption,
});

export const ROOM_FILMS: RoomFilmRoll[] = [
  {
    id: "guangzhou-2026",
    title: "广州 2026",
    year: "2026",
    stock: "KODAK PORTRA 400",
    iso: "ISO 400",
    edgeText: "KODAK 5036 400-6",
    accent: "#e0b34a",
    frames: [
      frame("guangzhou-2026", 1, "广州 · 蓝调时刻"),
      frame("guangzhou-2026", 2, "老城骑楼"),
      frame("guangzhou-2026", 3, "珠江夜渡"),
      frame("guangzhou-2026", 4, "楼下的猫"),
    ],
  },
  {
    id: "roaming-2025",
    title: "漫游 2025",
    year: "2025",
    stock: "KODAK GOLD 200",
    iso: "ISO 200",
    edgeText: "KODAK GOLD 200-12",
    accent: "#d88a3a",
    frames: [
      frame("roaming-2025", 1, "旅途中"),
      frame("roaming-2025", 2, "车站"),
      frame("roaming-2025", 3, "海"),
      frame("roaming-2025", 4, "旅馆窗外"),
    ],
  },
  {
    id: "everyday-2025",
    title: "日常 2025",
    year: "2025",
    stock: "ILFORD HP5 PLUS",
    iso: "ISO 400",
    edgeText: "ILFORD HP5 400-36",
    accent: "#b8b8b0",
    frames: [
      frame("everyday-2025", 1, "工位一角"),
      frame("everyday-2025", 2, "Nick"),
      frame("everyday-2025", 3, "深夜的屏"),
    ],
  },
];
