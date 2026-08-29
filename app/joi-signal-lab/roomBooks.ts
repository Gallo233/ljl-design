/**
 * The reading timeline: eight volumes the shelf actually carries, in the order they
 * stand on it (`nodeIndex` binds a data book to the capture's `bookN` mesh, which the
 * room slides out when the timeline selects it).
 *
 * // COPY-REVIEW: notes and quotes are a first draft awaiting the author.
 * // 「春风之雪女」的作者与年份待补；其余年份为初版/中文版通行年份，可改。
 */

// COPY-REVIEW: all notes and quotes below.

export type RoomBook = {
  id: string;
  title: string;
  author: string;
  year: number | null;
  kind: "novel" | "essay" | "manga";
  /** Why it is on the shelf — one sentence. */
  note: string;
  quote: string;
  quoteBy: string;
  /** Spine and shelf colours, used by the timeline UI. */
  cover: string;
  accent: string;
  ink: string;
  /** Which captured `bookN` node this data book stands behind (1..10). */
  nodeIndex: number;
};

export const ROOM_BOOKS: RoomBook[] = [
  {
    id: "the-golden-bough",
    title: "金枝",
    author: "J. G. 弗雷泽",
    year: 1890,
    kind: "essay",
    note: "人类学的起点之一：神话、巫术与秩序的比较研究。读它像在看思想的地质层。",
    quote: "在内米圣林的湖畔，总有一棵树，昼夜有人守着。",
    quoteBy: "J. G. 弗雷泽",
    cover: "#5a4a2e",
    accent: "#c8a45a",
    ink: "#f2eee6",
    nodeIndex: 1,
  },
  {
    id: "strait-is-the-gate",
    title: "窄门",
    author: "安德烈·纪德",
    year: 1909,
    kind: "novel",
    note: "关于克制如何变成自我毁灭的实验报告。薄，但是重。",
    quote: "你们要努力进窄门。",
    quoteBy: "《路加福音》",
    cover: "#3d5a6e",
    accent: "#9ec4d8",
    ink: "#f2eee6",
    nodeIndex: 2,
  },
  {
    id: "garden-of-forking-paths",
    title: "小径分岔的花园",
    author: "豪·路·博尔赫斯",
    year: 1941,
    kind: "novel",
    note: "时间分岔、无限图书馆、作为迷宫的小说——后来所有关于并行的想象都欠它一笔。",
    quote: "时间永远分岔，通向无数的将来。",
    quoteBy: "豪·路·博尔赫斯",
    cover: "#2e2e34",
    accent: "#c9c5b2",
    ink: "#f2eee6",
    nodeIndex: 3,
  },
  {
    id: "2001-a-space-odyssey",
    title: "2001：太空漫游",
    author: "阿瑟·克拉克",
    year: 1968,
    kind: "novel",
    note: "工具、进化与沉默的宇宙。看这本书长大的话，做 AI 很难不敬畏。",
    quote: "如今他身后站着三十个鬼魂，那是支撑着他活下去的祖先。",
    quoteBy: "阿瑟·克拉克",
    cover: "#101623",
    accent: "#7fa3c9",
    ink: "#f2eee6",
    nodeIndex: 4,
  },
  {
    id: "neuromancer",
    title: "神经漫游者",
    author: "威廉·吉布森",
    year: 1984,
    kind: "novel",
    note: "赛博朋克的起点。我做的每一件「AI 进入生活」的东西，都算是在回应它。",
    quote: "港口上方的天色，是电视调到一个死频道时的颜色。",
    quoteBy: "威廉·吉布森",
    cover: "#1a3a34",
    accent: "#5fd4a8",
    ink: "#f2eee6",
    nodeIndex: 5,
  },
  {
    id: "ghost-in-the-shell",
    title: "攻壳机动队",
    author: "士郎正宗",
    year: 1989,
    kind: "manga",
    note: "义体、Ghost、灵魂的边界——它在问的问题，现在成了我的职业。",
    quote: "网络是广阔的。",
    quoteBy: "押井守",
    cover: "#2a3550",
    accent: "#8fd0e8",
    ink: "#f2eee6",
    nodeIndex: 6,
  },
  {
    id: "spring-and-snow-woman",
    title: "春风之雪女",
    author: "待补", // COPY-REVIEW: 作者与年份待作者确认
    year: null,
    kind: "manga",
    note: "待写。先占着书架上这个位置。",
    quote: "",
    quoteBy: "",
    cover: "#8fa8b8",
    accent: "#d8e8f0",
    ink: "#1b1a17",
    nodeIndex: 7,
  },
  {
    id: "neon-genesis-evangelion",
    title: "新世纪福音战士",
    author: "贞本义行 / GAINAX",
    year: 1995,
    kind: "manga",
    note: "十四岁的我以为是机器人动画。后来发现它是关于人的。",
    quote: "不能逃避。",
    quoteBy: "碇真嗣",
    cover: "#4a3a8a",
    accent: "#8ad84a",
    ink: "#f2eee6",
    nodeIndex: 8,
  },
];
