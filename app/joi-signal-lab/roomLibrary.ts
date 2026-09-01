/**
 * The shelf, as data.
 *
 * The capture came with ten books whose spines are somebody else's — baked art from the
 * source model. `roomBookshelf.ts` retires them and stands these in their place, built in
 * code so a spine can carry a real title. Same shape as `roomObjects.ts` and
 * `reelProjects.ts`: a table with no behaviour, so there is one place a book is defined.
 *
 * The list is the author's, given 2026-09-01. Nothing has been added to it.
 *
 * ## What is drafted, and what is not
 *
 * Titles, authors and the order are the author's. Two fields are not, and both are marked
 * so they can be corrected rather than trusted:
 *
 * - **`year`** — the author said the years were up to me (「读的年份随意就行」). They are
 *   spread across three years to give the timeline's axis something to measure, and they
 *   are *not a reading record*. Nobody should later read them as one.
 * - **`quote`** — the brief was the most famous or most evocative line in each book. These
 *   are drafted from the works' best-known lines and want checking against the editions
 *   actually on the shelf, particularly the Chinese wording, which varies by translator.
 *   `无限之住人` has none: it is the one book here whose famous line I could not name, and
 *   inventing a line for a book is worse than a shelf entry with a blank.
 *
 * ## Spine design
 *
 * `height` and `thickness` are in the capture's own units and stay inside the range the
 * ten captured books occupied (1.31–1.82 tall, 0.18–0.28 thick), so the row still reads
 * as the same shelf. Both are set by what the book physically is — `金枝` is a single
 * scholarly volume and is the tallest and thickest thing here; `窄门` is a short novel.
 *
 * The colours are drawn off each book's own cover rather than picked to make a nice row:
 * `金枝` is black and gold because that edition is, `无限之住人` is the indigo and blood red
 * of its first volume, `EVA` is Unit-01's purple and green.
 *
 * ## Cover scans
 *
 * Seven of the eight have one, from Open Library's cover API — the one free source that
 * needs no scraping. It first answered every request with a 1×1 blank; the cause was the
 * default `curl` User-Agent, which archive.org (where the CDN redirects) refuses. With a
 * browser UA and about four seconds between requests they come back as real files.
 *
 * Every one was looked at before it was wired, because a cover API will hand you a
 * plausible wrong book without complaining. Two are worth naming for what they are:
 *
 * - `forking-paths` is the jacket of **Ficciones**, the collection the story is in. There
 *   is no standalone edition with a cover in that index, and the collection is how anyone
 *   actually holds that story.
 * - `golden-bough` is **The Illustrated Golden Bough**, the Mary Douglas abridgement —
 *   not the black-and-gold Chinese edition the author owns, which is what the spine
 *   colours are drawn from. Its cover art is Turner's own *Golden Bough*, which is the
 *   painting the quote on this entry asks about.
 *
 * All eight have one now. `春风之雪女` was on this shelf first and is not any more: Open
 * Library does not hold `春風のスネグラチカ`, only Samura's *Blade of the Immortal*, and the
 * author chose to put that on the shelf instead. The entry is volume 1, *Blood of a
 * Thousand* — Manji against the moon, `無限の住人` down the side in red, which is where the
 * spine's indigo and red come from.
 *
 * The panel still draws no cover block for an entry without one, so the slot stays honest
 * if a ninth book arrives before its jacket does. `docs/asset-requests.md` item 8 is now
 * only about a Chinese `金枝`.
 */

export type LibraryBook = {
  id: string;
  /** As the author gave it. */
  title: string;
  /** The work's own title, where it differs. Printed under the Chinese in the panel. */
  titleOriginal?: string;
  author: string;
  authorOriginal?: string;
  /** COPY-REVIEW — see the header. Not a reading record. */
  year: string;
  /** COPY-REVIEW — see the header. Empty where no line could be named. */
  quote?: string;
  quoteZh?: string;
  /** Spine and covers. Two colours off the book's own edition, plus the ink on the spine. */
  spine: string;
  cover: string;
  ink: string;
  /**
   * The cover, when there is a file for it. A path under `public/`, and only ever one
   * that exists — the panel shows the block when this is set and omits it when it is not,
   * so an entry without a scan is an entry without a picture, not a broken image.
   */
  art?: string;
  /** Capture units. The ten it replaces ran 1.31–1.82 tall and 0.18–0.28 thick. */
  height: number;
  thickness: number;
};

export const LIBRARY: LibraryBook[] = [
  {
    id: "space-odyssey",
    art: "/work/about-room/library/space-odyssey.jpg",
    title: "2001：太空漫游",
    titleOriginal: "2001: A Space Odyssey",
    author: "阿瑟·克拉克",
    authorOriginal: "Arthur C. Clarke",
    year: "2024",
    quote: "It's full of stars.",
    quoteZh: "天啊——全是星星。",
    spine: "#10131c",
    cover: "#0a0d14",
    ink: "#e8e2d2",
    height: 1.74,
    thickness: 0.22,
  },
  {
    id: "neuromancer",
    art: "/work/about-room/library/neuromancer.jpg",
    title: "神经漫游者",
    titleOriginal: "Neuromancer",
    author: "威廉·吉布森",
    authorOriginal: "William Gibson",
    year: "2024",
    quote: "The sky above the port was the color of television, tuned to a dead channel.",
    quoteZh: "港口上空的天空，是电视调到没有信号的那种颜色。",
    spine: "#1d2b30",
    cover: "#162125",
    ink: "#7fd8cf",
    height: 1.66,
    thickness: 0.20,
  },
  {
    id: "strait-gate",
    art: "/work/about-room/library/strait-gate.jpg",
    title: "窄门",
    titleOriginal: "La Porte étroite",
    author: "安德烈·纪德",
    authorOriginal: "André Gide",
    year: "2025",
    quote: "Strive to enter in at the strait gate.",
    quoteZh: "你们要努力进窄门。",
    spine: "#d8cdb4",
    cover: "#c9bda2",
    ink: "#3b3a30",
    height: 1.38,
    thickness: 0.18,
  },
  {
    id: "forking-paths",
    art: "/work/about-room/library/forking-paths.jpg",
    title: "小径分岔的花园",
    titleOriginal: "El jardín de senderos que se bifurcan",
    author: "博尔赫斯",
    authorOriginal: "Jorge Luis Borges",
    year: "2025",
    quote: "Time forks perpetually toward innumerable futures.",
    quoteZh: "时间永远分岔，通向无数的未来。",
    spine: "#8a6a3c",
    cover: "#77592f",
    ink: "#f2e6cc",
    height: 1.58,
    thickness: 0.21,
  },
  {
    id: "golden-bough",
    art: "/work/about-room/library/golden-bough.jpg",
    title: "金枝",
    titleOriginal: "The Golden Bough",
    author: "詹姆斯·弗雷泽",
    authorOriginal: "James George Frazer",
    year: "2026",
    quote: "Who does not know Turner's picture of the Golden Bough?",
    quoteZh: "谁不知道透纳那幅《金枝》呢？",
    spine: "#12100c",
    cover: "#0d0b08",
    ink: "#d3a84e",
    height: 1.82,
    thickness: 0.28,
  },
  {
    id: "ghost-in-the-shell",
    art: "/work/about-room/library/ghost-in-the-shell.jpg",
    title: "攻壳机动队",
    titleOriginal: "攻殻機動隊 / Ghost in the Shell",
    author: "士郎正宗",
    authorOriginal: "Masamune Shirow",
    year: "2025",
    quote: "The net is vast and infinite.",
    quoteZh: "网络无限广阔。",
    spine: "#1b2f3c",
    cover: "#152530",
    ink: "#e2557f",
    height: 1.46,
    thickness: 0.24,
  },
  {
    id: "blade-of-the-immortal",
    art: "/work/about-room/library/blade-of-the-immortal.jpg",
    title: "无限之住人",
    titleOriginal: "無限の住人 / Blade of the Immortal",
    author: "沙村广明",
    authorOriginal: "Hiroaki Samura",
    year: "2026",
    // COPY-REVIEW — deliberately blank. See the header: no line invented for a book.
    spine: "#1b2440",
    cover: "#151c33",
    ink: "#d1503c",
    height: 1.48,
    thickness: 0.24,
  },
  {
    id: "evangelion",
    art: "/work/about-room/library/evangelion.jpg",
    title: "新世纪福音战士",
    titleOriginal: "新世紀エヴァンゲリオン / EVA",
    author: "贞本义行",
    authorOriginal: "Yoshiyuki Sadamoto",
    year: "2026",
    quote: "I mustn't run away.",
    quoteZh: "不能逃避。",
    spine: "#3b2a55",
    cover: "#2f2245",
    ink: "#8fd14f",
    height: 1.42,
    thickness: 0.23,
  },
];

/** The axis the timeline draws, derived rather than typed so it cannot fall out of step. */
export const LIBRARY_YEARS = [...new Set(LIBRARY.map((book) => book.year))].sort();
