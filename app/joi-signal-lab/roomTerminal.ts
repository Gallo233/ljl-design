import * as THREE from "three";

/**
 * The JOI9000 terminal, painted onto the room's own screen.
 *
 * A 2D canvas is redrawn on every keystroke and uploaded as a CanvasTexture that
 * `room3d.ts` mixes over the screen's baked atlas, so the terminal lives where the
 * fiction says it does — inside the machine on the desk — rather than in a DOM sheet
 * over the room. The site's CRT post chain then does to it whatever it does to
 * everything else on the stage.
 *
 * Input arrives two ways and meets the same buffer: desktop key events forwarded by
 * the stage's capture handler, and composed text from the hidden mobile input bridge
 * (`roomApps.tsx`), the trick the reference room validated: a 1px invisible field that
 * keeps the iOS keyboard honest while the real buffer lives here.
 *
 * Navigation commands (`works go 1`) do not route from inside this module; they call
 * the `onNavigate` callback the host hands in, so this file stays route-free.
 */

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 640;
const PADDING = 26;
/** Row height and glyph size are paired to the canvas, not to any DOM font size. */
const FONT_SIZE = 22;
const LINE_HEIGHT = 30;
const MAX_HISTORY = 200;

const FONT_STACK = `"IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace`;

const COLOURS = {
  bg: "#0b0e0c",
  text: "#e8e4d4",
  dim: "#8f8d7e",
  promptUser: "#e0704a",
  promptHost: "#7fa3c9",
  promptPath: "#e8e4d4",
  accent: "#e0704a",
  echo: "#c9c5b2",
  error: "#d95f43",
  art: "#b9b5a2",
};

type Segment = { text: string; color: string };
type Line = { input: string | null; valid: boolean; segments: Segment[] };

const COMMANDS: Record<string, { desc: string; hasArgs?: boolean }> = {
  help: { desc: "看看有什么命令" },
  about: { desc: "关于 Gallo" },
  works: { desc: " Selected Work 项目", hasArgs: true },
  lab: { desc: "实验室的抽屉" },
  games: { desc: "夜潮 Game Center", hasArgs: true },
  socials: { desc: "找到我的地方", hasArgs: true },
  contact: { desc: "来聊" },
  echo: { desc: "把话原样说回去", hasArgs: true },
  history: { desc: "命令历史" },
  welcome: { desc: "重播欢迎屏" },
  clear: { desc: "清屏" },
};

export type RoomTerminalRig = {
  canvasTexture: any;
  activate: () => void;
  deactivate: () => void;
  isActive: () => boolean;
  /** Desktop path. The caller owns preventDefault; every key here is already ours. */
  handleKey: (event: KeyboardEvent) => void;
  /** Mobile bridge path: composed input from the hidden field. */
  insertText: (text: string) => void;
  backspace: () => void;
  submit: () => void;
  /** Cursor blink. */
  update: (delta: number) => void;
  onActiveChange: (callback: (active: boolean) => void) => void;
  onNavigate: (callback: (href: string) => void) => void;
};

export function createRoomTerminal(): RoomTerminalRig {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[room-terminal] 2D context failed");

  const canvasTexture = new THREE.CanvasTexture(canvas);
  canvasTexture.name = "about-room-terminal";
  canvasTexture.colorSpace = THREE.SRGBColorSpace;
  canvasTexture.minFilter = THREE.LinearFilter;
  canvasTexture.magFilter = THREE.LinearFilter;
  canvasTexture.generateMipmaps = false;
  canvasTexture.anisotropy = 4;

  const lines: Line[] = [];
  const history: string[] = [];
  let buffer = "";
  let historyIndex = -1;
  let active = false;
  let everActivated = false;
  let cursorVisible = true;
  let cursorTimer = 0;
  let dirty = true;
  let scrollOffset = 0;

  let activeCallback: ((active: boolean) => void) | null = null;
  let navigateCallback: ((href: string) => void) | null = null;

  const textWidth = () => CANVAS_WIDTH - PADDING * 2;
  const visibleRows = () => Math.floor((CANVAS_HEIGHT - PADDING * 2) / LINE_HEIGHT);

  const pushSegments = (segments: Segment[]) => {
    lines.push({ input: null, valid: true, segments });
    if (lines.length > MAX_HISTORY) lines.shift();
    dirty = true;
  };

  const text = (value: string, color = COLOURS.text) => pushSegments([{ text: value, color }]);

  /** Word-wrap one string into painted segments at the current canvas width. */
  const wrapInto = (value: string, color: string, out: Segment[]) => {
    if (!value) {
      out.push({ text: "", color });
      return;
    }
    ctx.font = `${FONT_SIZE}px ${FONT_STACK}`;
    let rest = value;
    while (ctx.measureText(rest).width > textWidth()) {
      let cut = rest.length;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > textWidth()) cut -= 1;
      const space = rest.lastIndexOf(" ", cut);
      const breakAt = space > 0 ? space : cut;
      out.push({ text: rest.slice(0, breakAt), color });
      rest = rest.slice(breakAt).replace(/^ +/, "");
    }
    out.push({ text: rest, color });
  };

  const commandRows = (): Segment[] => {
    const out: Segment[] = [];
    for (const line of lines) {
      if (line.input !== null) {
        out.push({ text: `${line.input}`, color: line.valid ? COLOURS.echo : COLOURS.error });
      }
      out.push(...line.segments);
      out.push({ text: "", color: COLOURS.text });
    }
    return out;
  };

  const paint = () => {
    if (!dirty) return;
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = `${FONT_SIZE}px ${FONT_STACK}`;
    ctx.textBaseline = "top";

    const rows = commandRows();
    const rowsCapacity = visibleRows();
    const livePrompt: Segment[] = [
      { text: "guest@joi9000", color: COLOURS.promptUser },
      { text: ":", color: COLOURS.dim },
      { text: "~", color: COLOURS.promptPath },
      { text: "$ ", color: COLOURS.dim },
      { text: buffer, color: COLOURS.text },
    ];

    // The live line never scrolls away; everything above it yields.
    const maxScroll = Math.max(0, rows.length + 1 - rowsCapacity);
    scrollOffset = Math.min(scrollOffset, maxScroll);
    const start = Math.max(0, rows.length - (rowsCapacity - 1) - scrollOffset);
    const shown = rows.slice(start, start + rowsCapacity - 1);

    let y = PADDING;
    for (const segment of shown) {
      ctx.fillStyle = segment.color;
      ctx.fillText(segment.text, PADDING, y);
      y += LINE_HEIGHT;
    }

    ctx.fillStyle = COLOURS.promptUser;
    let x = PADDING;
    for (const [index, segment] of livePrompt.entries()) {
      const isCursorSlot = index === livePrompt.length - 1;
      ctx.fillStyle = segment.color;
      ctx.fillText(segment.text, x, y);
      x += ctx.measureText(segment.text).width;
      if (isCursorSlot && active && cursorVisible) {
        ctx.fillStyle = COLOURS.text;
        ctx.fillRect(x + 1, y + 1, 11, LINE_HEIGHT - 8);
      }
    }
    dirty = false;
  };

  const prompt = (input: string, valid: boolean, segments: Segment[]) => {
    lines.push({ input, valid, segments });
    if (lines.length > MAX_HISTORY) lines.shift();
    dirty = true;
  };

  const flushBuffer = () => {
    const raw = buffer.trim();
    buffer = "";
    historyIndex = -1;
    scrollOffset = 0;
    if (!raw) {
      prompt("", true, []);
      return;
    }
    if (history[0] !== raw) history.unshift(raw);

    const tokens = raw.split(/\s+/);
    const name = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    if (name === "clear") {
      lines.length = 0;
      dirty = true;
      return;
    }

    const out: Segment[] = [];
    const unknown = () => {
      prompt(raw, false, [{ text: `command not found: ${name} — 试试 help`, color: COLOURS.error }]);
    };

    const command = COMMANDS[name];
    if (!command) {
      unknown();
      return;
    }
    if (command.hasArgs && args.length > 0 && args[0] !== "go") {
      prompt(raw, true, [{ text: `用法: ${name} go <序号>`, color: COLOURS.dim }]);
      return;
    }
    switch (name) {
      case "help": {
        out.push({ text: "可用命令：", color: COLOURS.accent });
        for (const [key, entry] of Object.entries(COMMANDS)) {
          out.push({ text: `  ${key.padEnd(10)} ${entry.desc}`, color: COLOURS.text });
        }
        out.push({ text: "", color: COLOURS.text });
        out.push({ text: "  ls / cat / whoami / pwd / sudo — 也认得", color: COLOURS.dim });
        break;
      }
      case "about": {
        wrapInto("Gallo —— 广州的产品设计师。", COLOURS.text, out);
        wrapInto("设计 AI 如何进入人的生活：语音助手、移动应用、游戏掌机、一间 3D 房间。", COLOURS.text, out);
        out.push({ text: "", color: COLOURS.text });
        wrapInto("这个房间也是作品之一 —— 你现在就站在里面。", COLOURS.dim, out);
        break;
      }
      case "works": {
        if (args.length === 0) {
          out.push({ text: "1  JOI         语音 AI 助手，活的对话", color: COLOURS.text });
          out.push({ text: "2  JOI MOBILE  把它装进口袋的那一次", color: COLOURS.text });
          out.push({ text: "", color: COLOURS.text });
          out.push({ text: "works go <序号> 打开案例", color: COLOURS.dim });
        } else {
          const href = args[1] === "1" ? "/work/joi/" : args[1] === "2" ? "/work/joi-mobile/" : null;
          if (!href) out.push({ text: `没有第 ${args[1] ?? "?"} 号作品`, color: COLOURS.error });
          else {
            navigateCallback?.(href);
            out.push({ text: `弹出 ${href}`, color: COLOURS.accent });
          }
        }
        break;
      }
      case "lab": {
        out.push({ text: "LAB —— 研究与退役原型：", color: COLOURS.text });
        out.push({ text: "  · CRT / shader 研究（本页的画面就是它）", color: COLOURS.text });
        out.push({ text: "  · Live2D 绑定、粒子开场、leitower 复盘", color: COLOURS.text });
        out.push({ text: "", color: COLOURS.text });
        out.push({ text: "知道为什么停下来，和知道为什么开始一样重要。", color: COLOURS.dim });
        break;
      }
      case "games": {
        if (args.length === 0) {
          out.push({ text: "NIGHT TIDE GAME CENTER —— 四盘卡带：", color: COLOURS.text });
          out.push({ text: "  1 SNAKE   2 TETRIS   3 PAC-MAN   4 NIGHT TIDE", color: COLOURS.text });
          out.push({ text: "", color: COLOURS.text });
          out.push({ text: "games go 4 进游戏中心", color: COLOURS.dim });
        } else {
          navigateCallback?.("/play/night-tide/");
          out.push({ text: "上机。", color: COLOURS.accent });
        }
        break;
      }
      case "socials": {
        if (args.length === 0) {
          out.push({ text: "1  GITHUB   github.com/Gallo233", color: COLOURS.text });
          out.push({ text: "2  EMAIL    18520455682@163.com", color: COLOURS.text });
          out.push({ text: "3  RESUME   /resume/gallo-liu-resume-cn.pdf", color: COLOURS.text });
          out.push({ text: "", color: COLOURS.text });
          out.push({ text: "socials go <序号> 打开", color: COLOURS.dim });
        } else {
          const targets = ["https://github.com/Gallo233", "mailto:18520455682@163.com", "/resume/gallo-liu-resume-cn.pdf"];
          const target = targets[Number(args[1]) - 1];
          if (!target) out.push({ text: `没有第 ${args[1] ?? "?"} 号社交位`, color: COLOURS.error });
          else {
            navigateCallback?.(target);
            out.push({ text: "已打开。", color: COLOURS.accent });
          }
        }
        break;
      }
      case "contact": {
        out.push({ text: "18520455682@163.com", color: COLOURS.promptHost });
        out.push({ text: "在找 AI 产品 / 产品设计的机会，也接有意思的项目。", color: COLOURS.text });
        break;
      }
      case "echo": {
        wrapInto(args.join(" ").replace(/^['"`]|['"`]$/g, ""), COLOURS.text, out);
        break;
      }
      case "history": {
        if (history.length === 0) out.push({ text: "还没有历史。", color: COLOURS.dim });
        [...history].reverse().forEach((entry, index) => {
          out.push({ text: `  ${String(index + 1).padStart(3)}  ${entry}`, color: COLOURS.text });
        });
        break;
      }
      case "welcome": {
        for (const row of WELCOME_ART) out.push({ text: row, color: COLOURS.art });
        out.push({ text: "", color: COLOURS.text });
        wrapInto("欢迎进入 JOI9000。", COLOURS.text, out);
        wrapInto("这是一间广州的房间，住着一个把 AI 做进生活里的人。", COLOURS.text, out);
        out.push({ text: "", color: COLOURS.text });
        out.push({ text: "help 看命令。ls 看看房间里有什么。", color: COLOURS.dim });
        break;
      }
      case "ls": {
        out.push({ text: "macbook/  turntable/  camera/  bookshelf/", color: COLOURS.text });
        out.push({ text: "posters/  handheld/   nick    balls", color: COLOURS.text });
        out.push({ text: "", color: COLOURS.text });
        out.push({ text: "都是可以点的。", color: COLOURS.dim });
        break;
      }
      case "cat": {
        for (const row of NICK_ART) out.push({ text: row, color: COLOURS.art });
        out.push({ text: "", color: COLOURS.text });
        wrapInto("Nick。黑色的狸花，黄色的眼睛。他批准你使用这台终端。", COLOURS.text, out);
        break;
      }
      case "whoami": {
        out.push({ text: "guest —— 但 Nick 大概已经记住你了。", color: COLOURS.text });
        break;
      }
      case "pwd": {
        out.push({ text: "/guangzhou/room/about-me", color: COLOURS.promptHost });
        break;
      }
      case "sudo": {
        out.push({ text: "guest 不在 sudoers 文件里。此事已被 Nick 记录在案。", color: COLOURS.error });
        break;
      }
    }
    prompt(raw, true, out);
  };

  const WELCOME_ART = [
    "     J   O   I   9   0   0   0    ",
    "    ┌────────────────────────┐    ",
    "    │  PERSONAL AI SYSTEM    │    ",
    "    │  GUANGZHOU · 2026      │    ",
    "    └────────────────────────┘    ",
  ];

  const NICK_ART = [
    "  ／＼＿／＼  ",
    " （ ・ω・ ） ",
    "  （　つ　つ  ",
    "   しーＪ    ",
  ];

  const setActive = (next: boolean) => {
    if (active === next) return;
    active = next;
    cursorVisible = true;
    cursorTimer = 0;
    dirty = true;
    if (next && !everActivated) {
      everActivated = true;
      lines.length = 0;
      buffer = "";
      const rows: Segment[] = [];
      for (const row of WELCOME_ART) rows.push({ text: row, color: COLOURS.art });
      rows.push({ text: "", color: COLOURS.text });
      wrapInto("欢迎进入 JOI9000。", COLOURS.text, rows);
      wrapInto("这是一间广州的房间，住着一个把 AI 做进生活里的人。", COLOURS.text, rows);
      rows.push({ text: "", color: COLOURS.text });
      rows.push({ text: "help 看命令。ls 看看房间里有什么。", color: COLOURS.dim });
      prompt("welcome", true, rows);
      if (history[0] !== "welcome") history.unshift("welcome");
    }
    activeCallback?.(next);
  };

  return {
    canvasTexture,
    activate: () => setActive(true),
    deactivate: () => setActive(false),
    isActive: () => active,
    handleKey: (event) => {
      if (!active) return;
      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        lines.length = 0;
        dirty = true;
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "c") {
        prompt(`${buffer}^C`, true, []);
        buffer = "";
        dirty = true;
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case "Enter":
          event.preventDefault();
          flushBuffer();
          return;
        case "Backspace":
          event.preventDefault();
          buffer = buffer.slice(0, -1);
          dirty = true;
          return;
        case "ArrowUp":
          event.preventDefault();
          if (history.length > 0) {
            historyIndex = Math.min(historyIndex + 1, history.length - 1);
            buffer = history[historyIndex];
            dirty = true;
          }
          return;
        case "ArrowDown":
          event.preventDefault();
          if (historyIndex <= 0) {
            historyIndex = -1;
            buffer = "";
          } else {
            historyIndex -= 1;
            buffer = history[historyIndex];
          }
          dirty = true;
          return;
        case "Tab": {
          event.preventDefault();
          const seed = buffer.toLowerCase();
          if (!seed || seed.includes(" ")) return;
          const match = Object.keys(COMMANDS).find((key) => key.startsWith(seed));
          if (match) {
            buffer = match;
            dirty = true;
          }
          return;
        }
        default:
          if (event.key.length === 1) {
            event.preventDefault();
            buffer += event.key;
            dirty = true;
          }
      }
    },
    insertText: (text) => {
      if (!active || !text) return;
      buffer += text;
      dirty = true;
    },
    backspace: () => {
      if (!active) return;
      buffer = buffer.slice(0, -1);
      dirty = true;
    },
    submit: () => {
      if (!active) return;
      flushBuffer();
    },
    update: (delta) => {
      if (!active) return;
      cursorTimer += delta;
      if (cursorTimer >= 0.53) {
        cursorTimer = 0;
        cursorVisible = !cursorVisible;
        dirty = true;
      }
      paint();
    },
    onActiveChange: (callback) => { activeCallback = callback; },
    onNavigate: (callback) => { navigateCallback = callback; },
  };
}
