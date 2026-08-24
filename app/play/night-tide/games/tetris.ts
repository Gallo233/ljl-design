import {
  PALETTE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  createLoop,
  roundRect,
  type ArcadeGame,
  type GameContext,
} from "./types";

const COLUMNS = 10;
const ROWS = 20;
const CELL = 21;
const BOARD_WIDTH = COLUMNS * CELL;
const BOARD_HEIGHT = ROWS * CELL;
const ORIGIN_X = 150;
const ORIGIN_Y = (SCREEN_HEIGHT - BOARD_HEIGHT) / 2;

/** Rotation states are written out rather than computed, so kicks stay predictable. */
const SHAPES: Record<string, { cells: number[][][]; color: string }> = {
  I: {
    color: PALETTE.indigo,
    cells: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
  },
  O: {
    color: PALETTE.amber,
    cells: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
  },
  T: {
    color: PALETTE.rose,
    cells: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  S: {
    color: PALETTE.mint,
    cells: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  Z: {
    color: PALETTE.coral,
    cells: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  J: {
    color: "#7f9ad4",
    cells: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
  L: {
    color: "#d3a07f",
    cells: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  },
};
const SHAPE_KEYS = Object.keys(SHAPES);

type Piece = { key: string; rotation: number; x: number; y: number };

/**
 * Tetris.
 *
 * Two conventions worth naming because they are what make it feel right rather than merely
 * correct: pieces are dealt from a shuffled **bag** of all seven, not by independent random
 * draws — independent draws produce droughts that read as unfair — and a landed piece gets a
 * short **lock delay** so a last-moment slide under an overhang is possible.
 */
export const tetris: ArcadeGame = {
  id: "tetris",
  title: "TETRIS",
  titleZh: "俄罗斯方块",
  blurb: "Seven shapes, one bag, no droughts.",
  blurbZh: "七种方块轮流发牌，不会连续缺件。",
  accent: PALETTE.indigo,
  controls: [
    { keys: "← → / D-PAD", action: "左右移动" },
    { keys: "↓", action: "软降" },
    { keys: "A / X", action: "旋转" },
    { keys: "B", action: "硬降" },
    { keys: "START", action: "重开" },
  ],
  mount(canvas: HTMLCanvasElement, { input, setStatus }: GameContext) {
    const context = canvas.getContext("2d");
    if (!context) return { destroy: () => {} };

    let board: string[][] = [];
    let bag: string[] = [];
    let piece: Piece | null = null;
    let nextKey = "";
    let fallTimer = 0;
    let lockTimer = 0;
    let repeatTimer = 0;
    let score = 0;
    let lines = 0;
    let level = 1;
    let dead = false;

    const fallInterval = () => Math.max(0.08, 0.62 - (level - 1) * 0.055);

    const refillBag = () => {
      const shuffled = [...SHAPE_KEYS];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      bag.push(...shuffled);
    };

    const takeKey = () => {
      if (bag.length === 0) refillBag();
      return bag.shift() as string;
    };

    const cellsOf = (candidate: Piece) =>
      SHAPES[candidate.key].cells[candidate.rotation % 4].map(([x, y]) => ({
        x: candidate.x + x,
        y: candidate.y + y,
      }));

    const collides = (candidate: Piece) =>
      cellsOf(candidate).some(
        ({ x, y }) => x < 0 || x >= COLUMNS || y >= ROWS || (y >= 0 && board[y][x] !== ""),
      );

    const spawn = () => {
      const key = nextKey || takeKey();
      nextKey = takeKey();
      const candidate: Piece = { key, rotation: 0, x: 3, y: -1 };
      if (collides(candidate)) {
        dead = true;
        piece = null;
        setStatus(`GAME OVER / ${score} · START 重开`);
        return;
      }
      piece = candidate;
      lockTimer = 0;
    };

    const reset = () => {
      board = Array.from({ length: ROWS }, () => Array<string>(COLUMNS).fill(""));
      bag = [];
      nextKey = "";
      score = 0;
      lines = 0;
      level = 1;
      dead = false;
      fallTimer = 0;
      spawn();
      setStatus("TETRIS / 0");
    };

    const clearLines = () => {
      const kept = board.filter((row) => row.some((cell) => cell === ""));
      const cleared = ROWS - kept.length;
      if (cleared === 0) return;
      board = [
        ...Array.from({ length: cleared }, () => Array<string>(COLUMNS).fill("")),
        ...kept,
      ];
      lines += cleared;
      // The classic curve: clearing four at once is worth far more than four singles.
      score += [0, 100, 300, 500, 800][cleared] * level;
      level = Math.floor(lines / 10) + 1;
      setStatus(`TETRIS / ${score} · LV${level}`);
    };

    const lock = () => {
      if (!piece) return;
      cellsOf(piece).forEach(({ x, y }) => {
        if (y >= 0) board[y][x] = SHAPES[piece!.key].color;
      });
      clearLines();
      spawn();
    };

    const tryMove = (dx: number, dy: number) => {
      if (!piece) return false;
      const candidate = { ...piece, x: piece.x + dx, y: piece.y + dy };
      if (collides(candidate)) return false;
      piece = candidate;
      return true;
    };

    const tryRotate = () => {
      if (!piece) return;
      const candidate = { ...piece, rotation: (piece.rotation + 1) % 4 };
      // A minimal wall kick: try in place, then nudged off each wall, then up one.
      for (const dx of [0, -1, 1, -2, 2]) {
        const kicked = { ...candidate, x: candidate.x + dx };
        if (!collides(kicked)) { piece = kicked; return; }
      }
    };

    reset();

    const step = (delta: number) => {
      if (dead) {
        if (input.pressed("start") || input.pressed("a")) reset();
        return;
      }
      if (!piece) return;

      if (input.pressed("left")) { tryMove(-1, 0); repeatTimer = -0.18; }
      if (input.pressed("right")) { tryMove(1, 0); repeatTimer = -0.18; }
      // Auto-repeat after a short hold, so a held direction slides instead of stuttering.
      if (input.isDown("left") || input.isDown("right")) {
        repeatTimer += delta;
        if (repeatTimer >= 0.055) {
          repeatTimer = 0;
          tryMove(input.isDown("left") ? -1 : 1, 0);
        }
      } else {
        repeatTimer = 0;
      }

      if (input.pressed("a") || input.pressed("x") || input.pressed("up")) tryRotate();

      if (input.pressed("b")) {
        let dropped = 0;
        while (tryMove(0, 1)) dropped += 1;
        score += dropped * 2;
        lock();
        return;
      }

      const speed = input.isDown("down") ? Math.min(fallInterval(), 0.04) : fallInterval();
      fallTimer += delta;
      if (fallTimer >= speed) {
        fallTimer = 0;
        if (!tryMove(0, 1)) {
          lockTimer += speed;
          if (lockTimer >= 0.35) lock();
        } else {
          lockTimer = 0;
        }
      }
    };

    const drawCell = (x: number, y: number, color: string, alpha = 1) => {
      if (y < 0) return;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      roundRect(context, ORIGIN_X + x * CELL + 1.5, ORIGIN_Y + y * CELL + 1.5, CELL - 3, CELL - 3, 4);
      context.fill();
      context.globalAlpha = 1;
    };

    const draw = () => {
      context.fillStyle = PALETTE.paper;
      context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      context.fillStyle = PALETTE.panel;
      roundRect(context, ORIGIN_X - 10, ORIGIN_Y - 10, BOARD_WIDTH + 20, BOARD_HEIGHT + 20, 14);
      context.fill();

      context.strokeStyle = PALETTE.grid;
      context.lineWidth = 1;
      for (let x = 0; x <= COLUMNS; x += 1) {
        context.beginPath();
        context.moveTo(ORIGIN_X + x * CELL + 0.5, ORIGIN_Y);
        context.lineTo(ORIGIN_X + x * CELL + 0.5, ORIGIN_Y + BOARD_HEIGHT);
        context.stroke();
      }
      for (let y = 0; y <= ROWS; y += 1) {
        context.beginPath();
        context.moveTo(ORIGIN_X, ORIGIN_Y + y * CELL + 0.5);
        context.lineTo(ORIGIN_X + BOARD_WIDTH, ORIGIN_Y + y * CELL + 0.5);
        context.stroke();
      }

      board.forEach((row, y) => row.forEach((color, x) => { if (color) drawCell(x, y, color); }));

      if (piece) {
        // Landing shadow first, so the live piece draws over it.
        const ghost = { ...piece };
        while (!collides({ ...ghost, y: ghost.y + 1 })) ghost.y += 1;
        cellsOf(ghost).forEach(({ x, y }) => drawCell(x, y, SHAPES[piece!.key].color, 0.18));
        cellsOf(piece).forEach(({ x, y }) => drawCell(x, y, SHAPES[piece!.key].color));
      }

      context.font = "500 13px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textBaseline = "middle";
      context.fillStyle = PALETTE.muted;
      context.fillText("SCORE", 30, ORIGIN_Y + 12);
      context.fillText("LINES", 30, ORIGIN_Y + 96);
      context.fillText("LEVEL", 30, ORIGIN_Y + 150);
      context.fillText("NEXT", 30, ORIGIN_Y + 210);
      context.fillStyle = PALETTE.ink;
      context.font = "600 26px ui-sans-serif, system-ui, sans-serif";
      context.fillText(String(score), 30, ORIGIN_Y + 44);
      context.fillText(String(lines), 30, ORIGIN_Y + 124);
      context.fillText(String(level), 30, ORIGIN_Y + 178);

      if (nextKey) {
        const preview = SHAPES[nextKey].cells[0];
        preview.forEach(([x, y]) => {
          context.fillStyle = SHAPES[nextKey].color;
          roundRect(context, 28 + x * 17, ORIGIN_Y + 232 + y * 17, 14, 14, 3);
          context.fill();
        });
      }

      if (dead) {
        context.fillStyle = "rgba(242, 244, 249, 0.85)";
        context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        context.fillStyle = PALETTE.ink;
        context.font = "600 34px ui-sans-serif, system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText("GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 14);
        context.fillStyle = PALETTE.muted;
        context.font = "500 16px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.fillText(`${score} 分 · ${lines} 行 · START 重开`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 22);
        context.textAlign = "left";
      }
    };

    const stop = createLoop(step, draw);
    return { destroy: stop };
  },
};
