import type { Locale } from "./locale";

/**
 * Every string the interface says in its own voice.
 *
 * What is *not* here: anything that already carries both languages in its own table —
 * the lab entries, the cartridges, the library's titles and quotes, the room's object
 * labels. Those stay where they are and are chosen with `pick()`, so a table remains the
 * single source of truth for its own content instead of being copied into this one.
 *
 * Also not here: names. GALLO, JOI, JOI9000, GITHUB and the machine's own model numbers
 * read the same in both languages, and translating a name is how a site starts calling
 * itself two different things.
 */

type Entry = Record<Locale, string>;

export const STRINGS = {
  // ── language switch ───────────────────────────────────────────────────────
  localeSwitchLabel: { zh: "切换语言 / Switch language", en: "切换语言 / Switch language" },
  localeToEnglish: { zh: "EN", en: "EN" },
  localeToChinese: { zh: "中", en: "中" },

  // ── section navigation ────────────────────────────────────────────────────
  navHome: { zh: "首页", en: "HOME" },
  navSelectedWork: { zh: "精选作品", en: "SELECTED WORK" },
  navAboutMe: { zh: "关于我", en: "ABOUT ME" },
  navContact: { zh: "联系", en: "CONTACT" },
  navSectionsLabel: { zh: "章节导航", en: "Sections" },

  /*
   * What the browser tab says. The shell rewrites `document.title` as the reader passes
   * each section and again when the language changes, so the tab tracks both.
   */
  docTitleHome: { zh: "Gallo — AI 产品与产品设计", en: "Gallo — AI Product & Product Design" },
  docTitleSelectedWork: { zh: "精选作品", en: "Selected Work" },
  docTitleAboutMe: { zh: "关于我", en: "About Me" },
  docTitleContact: { zh: "联系", en: "Contact" },

  // ── header and menu ───────────────────────────────────────────────────────
  brandHomeLabel: { zh: "回到 Gallo 首页", en: "Back to Gallo home" },
  menuOpen: { zh: "打开菜单", en: "Open menu" },
  menuClose: { zh: "关闭菜单", en: "Close menu" },
  menuTheLab: { zh: "实验室", en: "THE LAB" },
  menuGameCenter: { zh: "游戏厅", en: "GAME CENTER" },

  // ── hero ──────────────────────────────────────────────────────────────────
  heroKicker: { zh: "个人 AI 系统 · 广州 / 2026", en: "PERSONAL AI SYSTEM · GUANGZHOU / 2026" },
  heroLine1: { zh: "我做的是", en: "I DESIGN" },
  heroLine2: { zh: "AI 如何进入", en: "HOW AI ENTERS" },
  heroLine3: { zh: "人的生活。", en: "HUMAN LIFE." },
  heroScroll: { zh: "向下滚动，进入精选作品", en: "SCROLL TO ENTER SELECTED WORK" },

  // ── boot screen ───────────────────────────────────────────────────────────
  loaderBooting: { zh: "JOI9000 启动中", en: "BOOTING JOI9000" },
  loaderFilmTransport: { zh: "走片机构", en: "FILM TRANSPORT" },
  loaderOpticalCore: { zh: "光学核心", en: "OPTICAL CORE" },
  loaderTypeSetter: { zh: "排字机", en: "TYPE SETTER" },
  /** Rendered as `{n}` + this, so the count stays a numeral in both languages. */
  loaderSystemsSuffix: { zh: "/3 系统就绪", en: "/3 SYSTEMS" },

  // ── sea / terminal HUD ────────────────────────────────────────────────────
  hudOpticalCore: { zh: "JOI9000 / 光学核心", en: "JOI9000 / OPTICAL CORE" },
  hudMove: { zh: "移动", en: "MOVE" },
  hudWind: { zh: "控风", en: "WIND" },
  hudClick: { zh: "点击", en: "CLICK" },
  hudSeaState: { zh: "换海况", en: "SEA STATE" },

  // ── reel ──────────────────────────────────────────────────────────────────
  reelViewProject: { zh: "查看项目", en: "View project" },

  // ── about panel ───────────────────────────────────────────────────────────
  aboutLabel: { zh: "关于我", en: "About me" },
  actionGithub: { zh: "GITHUB", en: "GITHUB" },
  actionEmail: { zh: "邮箱", en: "EMAIL" },

  // ── contact ───────────────────────────────────────────────────────────────
  contactLabel: { zh: "联系", en: "Contact" },
  contactKicker: { zh: "04 / 联系", en: "04 / CONTACT" },
  contactTitle: {
    zh: "让技术成为人能共处的东西。",
    en: "Let’s make technology people can live with.",
  },
  contactStatement: {
    zh: "在找 AI 产品 / 产品设计的机会，也接有意思的项目。来聊。",
    en: "Open to AI product and product design roles, and to projects worth doing. Let’s talk.",
  },
  contactMeta: { zh: "广州 · GMT+8 · 2026", en: "GUANGZHOU · GMT+8 · 2026" },
  contactCopy: { zh: "复制邮箱", en: "COPY" },
  contactCopied: { zh: "已复制", en: "COPIED" },
  contactCopyFailed: { zh: "复制失败", en: "COPY FAILED" },
  contactCopiedAnnounce: { zh: "邮箱已复制到剪贴板", en: "Email address copied to clipboard" },
  /** Followed by the address itself, so the reader still gets it when copying fails. */
  contactCopyFailedAnnounce: { zh: "复制失败，邮箱是", en: "Copy failed. The address is" },

  // ── the room's sheets ─────────────────────────────────────────────────────
  shelfTitle: { zh: "书架", en: "SHELF" },
  shelfHint: { zh: "点书脊或列表 · ← → 翻", en: "Click a spine or the list · ← → to turn" },
  shelfNoQuote: { zh: "还没记下这本里的句子", en: "No line noted from this one yet" },
  terminalTitle: { zh: "终端", en: "TERMINAL" },
  terminalHint: {
    zh: "TAB 补全 · ↑ ↓ 历史 · CTRL+L 清屏",
    en: "TAB to complete · ↑ ↓ history · CTRL+L to clear",
  },
  whiteboardTitle: { zh: "画板", en: "WHITEBOARD" },
  whiteboardHint: {
    zh: "画上去的东西会留在墙上的板子上",
    en: "Your marks stay on the board",
  },

  // ── the visitor badge ─────────────────────────────────────────────────────
  badgeFront: { zh: "访客工牌 — 点按翻到背面", en: "Visitor badge — tap to turn it over" },
  badgeBack: { zh: "工牌背面 — 点按翻回正面", en: "Badge reverse — tap to turn it back" },
  stickerDrag: {
    zh: "拖动这张贴纸，把它贴到工牌上",
    en: "Drag this sticker onto the badge",
  },

  // ── global music ──────────────────────────────────────────────────────────
  musicLabel: { zh: "全站音乐", en: "Site music" },
  musicPlay: { zh: "播放", en: "Play" },
  musicPause: { zh: "暂停", en: "Pause" },
  musicNext: { zh: "下一首", en: "Next track" },

  // ── the lab ───────────────────────────────────────────────────────────────
  labTitle: { zh: "实验室", en: "THE LAB" },
  labRouteTitle: { zh: "实验室", en: "The Lab" },
  labKicker: { zh: "04 / 研究与实验", en: "04 / RESEARCH & EXPERIMENTS" },
  labIntro: {
    zh: "三个关于游戏与空间的实验：用 UE5 打磨战斗，用 Three.js 构建可探索的世界，用 Blender 对照参考重建场景。",
    en: "Three studies in games and space: combat in UE5, an explorable world in Three.js, and a reference-led environment in Blender.",
  },
  labNavLabel: { zh: "实验室导航", en: "Lab navigation" },
  labBackToReel: { zh: "回到胶片", en: "BACK TO REEL" },
  labBackToReelShort: { zh: "胶片", en: "REEL" },
  labBackToReelPrefix: { zh: "回到", en: "BACK TO " },
  labAbout: { zh: "关于", en: "ABOUT" },
  labOpenFile: { zh: "打开一份档案", en: "OPEN A FILE" },
  labHoverLine1: { zh: "悬停查看。", en: "Hover to inspect." },
  labHoverLine2: { zh: "点击展开。", en: "Click to unfold." },
  labFilesLabel: { zh: "实验档案", en: "Lab files" },
  labLearnedLabel: { zh: "它教会了什么", en: "What it taught" },
  labWorkingMaterialSuffix: { zh: "过程材料", en: "working material" },

  // ── game center ───────────────────────────────────────────────────────────
  gameCenterTitle: { zh: "游戏厅", en: "Game Center" },
  gameCenterBlurb: {
    zh: "把卡带拖进插槽，完整试玩夜潮、星脉、贪吃蛇、俄罗斯方块和吃豆人。",
    en: "Drag a cartridge into the slot and play Night Tide, Starvein, Snake, Tetris and Pac-Man in full.",
  },
  gameCenterChoose: { zh: "选择并试玩一张卡带", en: "Choose a cartridge and play" },
  gameCenterNavLabel: { zh: "游戏厅导航", en: "Game Center navigation" },
  gameCenterBackToReel: { zh: "回到胶片", en: "BACK TO REEL" },
  /** Rendered around the cartridge count, which stays a numeral in both languages. */
  gameCenterKickerPrefix: { zh: "03 / 游戏厅 / ", en: "03 / GAME CENTER / " },
  gameCenterKickerSuffix: { zh: " 张卡带", en: " CARTRIDGES" },
  gameCenterPhaseCarrying: { zh: "卡带在手", en: "CARTRIDGE IN HAND" },
  gameCenterPhasePlaying: { zh: "游戏运行中", en: "GAME ONLINE" },
  gameCenterPhaseIdle: { zh: "等待卡带", en: "WAITING FOR CARTRIDGE" },
  gameCenterPhaseBooting: { zh: "POCKET-NT 启动中", en: "BOOTING POCKET-NT" },
  reelFramesLabel: { zh: "胶片格", en: "Reel frames" },
  reelNextPrefix: { zh: "下一格 / ", en: "NEXT / " },
  reelPrevPrefix: { zh: "上一格 / ", en: "PREV / " },
  cartridges: { zh: "卡带", en: "CARTRIDGES" },
  cartridgeDragAction: { zh: "放到机器顶部插槽", en: "into the slot on top" },
  cartridgeDragKeys: { zh: "拖动卡带", en: "Drag a cartridge" },
  cartridgeEject: { zh: "退出卡带", en: "Eject cartridge" },
  cartridgeDropHere: { zh: "把卡带拖进插槽", en: "Drag a cartridge into the slot" },
  cartridgeLoading: { zh: "读取", en: "Loading" },
  cartridgeDemoSuffix: { zh: "试玩版", en: "demo" },
  cartridgeSeating: { zh: "卡带就位中", en: "CARTRIDGE SEATING" },
  cartridgeScreenSuffix: { zh: "游戏画面", en: "game screen" },
  /** Rendered as `{n}` between the two halves. */
  cartridgeShelfPrefix: { zh: "右边有", en: "There are" },
  cartridgeShelfSuffix: {
    zh: "张卡带 · 拖到机器顶部即可开始",
    en: "cartridges on the right · drag one onto the machine to start",
  },

  // ── the Joi embed ─────────────────────────────────────────────────────────
  joiEnter: { zh: "进入后启动 Joi", en: "Start Joi to enter" },
  joiConnecting: { zh: "正在为你启动一份 Joi…", en: "Starting a Joi just for you…" },
  joiUnavailable: { zh: "Joi 现在不在线", en: "Joi is offline right now" },
  joiReal: {
    zh: "这是真正的 Joi，跑在为你单独启动的一份运行时里。",
    en: "This is the real Joi, running in a runtime started just for you.",
  },
  joiNotConnected: {
    zh: "这台站点还没有连上 Joi 体验服。",
    en: "This site is not connected to a Joi demo server yet.",
  },
  joiTemporarilyDown: { zh: "Joi 体验暂时不可用。", en: "The Joi demo is temporarily unavailable." },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
