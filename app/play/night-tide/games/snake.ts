import {
  PALETTE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  createLoop,
  roundRect,
  type ArcadeGame,
  type GameContext,
} from "./types";
import { createBestScore } from "./bestScore";

const COLUMNS = 24;
const ROWS = 18;
const CELL = 22;
const BOARD_WIDTH = COLUMNS * CELL;
const BOARD_HEIGHT = ROWS * CELL;
const ORIGIN_X = (SCREEN_WIDTH - BOARD_WIDTH) / 2;
// Biased downward so the score line above the board stays on screen.
const ORIGIN_Y = (SCREEN_HEIGHT - BOARD_HEIGHT) / 2 + 10;

const START_INTERVAL = 0.16;
const MIN_INTERVAL = 0.07;

type Point = { x: number; y: number };

/**
 * Snake, with one deliberate rule choice: walls are fatal rather than wrapping.
 *
 * Wrapping is friendlier but removes the only spatial pressure the game has — with wrap
 * the board never really closes in, and the difficulty curve has to come entirely from
 * speed. Fatal walls keep the late game about the space you have left.
 */
export const snake: ArcadeGame = {
  id: "snake",
  title: "SNAKE",
  titleZh: "贪吃蛇",
  blurb: "Eat, grow, and run out of room.",
  blurbZh: "吃、变长，然后没地方走。",
  accent: PALETTE.mint,
  controls: [
    { keys: "WASD / D-PAD", action: "转向" },
    { keys: "A / SPACE", action: "重开" },
  ],
  mount(canvas: HTMLCanvasElement, { input, setStatus }: GameContext) {
    const context = canvas.getContext("2d");
    if (!context) return { destroy: () => {} };

    let body: Point[] = [];
    let direction: Point = { x: 1, y: 0 };
    /** The direction the *next* step will use. Buffered so a fast double-tap is not lost. */
    let queued: Point = { x: 1, y: 0 };
    let food: Point = { x: 0, y: 0 };
    let timer = 0;
    let interval = START_INTERVAL;
    let score = 0;
    // Kept across ejects and reloads; the readout has always claimed it was.
    const bestScore = createBestScore("snake");
    let dead = false;

    const placeFood = () => {
      const free: Point[] = [];
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLUMNS; x += 1) {
          if (!body.some((part) => part.x === x && part.y === y)) free.push({ x, y });
        }
      }
      food = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
    };

    const reset = () => {
      body = [
        { x: 6, y: Math.floor(ROWS / 2) },
        { x: 5, y: Math.floor(ROWS / 2) },
        { x: 4, y: Math.floor(ROWS / 2) },
      ];
      direction = { x: 1, y: 0 };
      queued = { x: 1, y: 0 };
      interval = START_INTERVAL;
      timer = 0;
      score = 0;
      dead = false;
      placeFood();
      setStatus("SNAKE / 000");
    };
    reset();

    const turn = (x: number, y: number) => {
      // A 180° turn would drive straight into the neck, so it is refused rather than fatal.
      if (direction.x === -x && direction.y === -y) return;
      queued = { x, y };
    };

    const step = (delta: number) => {
      if (input.pressed("up")) turn(0, -1);
      if (input.pressed("down")) turn(0, 1);
      if (input.pressed("left")) turn(-1, 0);
      if (input.pressed("right")) turn(1, 0);

      if (dead) {
        if (input.pressed("a") || input.pressed("start")) reset();
        return;
      }

      timer += delta;
      if (timer < interval) return;
      timer -= interval;
      direction = queued;

      const head = { x: body[0].x + direction.x, y: body[0].y + direction.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= COLUMNS || head.y >= ROWS;
      // The tail tip moves out of the way this same step, so it is not a collision.
      const hitSelf = body.slice(0, -1).some((part) => part.x === head.x && part.y === head.y);
      if (hitWall || hitSelf) {
        dead = true;
        const record = bestScore.submit(score);
        setStatus(
          `GAME OVER / ${String(score).padStart(3, "0")}${record ? " · NEW BEST" : ""} · A 重开`,
        );
        return;
      }

      body.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 1;
        interval = Math.max(MIN_INTERVAL, START_INTERVAL - score * 0.004);
        placeFood();
        setStatus(`SNAKE / ${String(score).padStart(3, "0")}`);
      } else {
        body.pop();
      }
    };

    const draw = () => {
      context.fillStyle = PALETTE.paper;
      context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      context.fillStyle = PALETTE.panel;
      roundRect(context, ORIGIN_X - 8, ORIGIN_Y - 8, BOARD_WIDTH + 16, BOARD_HEIGHT + 16, 14);
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

      context.fillStyle = PALETTE.coral;
      roundRect(
        context,
        ORIGIN_X + food.x * CELL + 6,
        ORIGIN_Y + food.y * CELL + 6,
        CELL - 12,
        CELL - 12,
        4,
      );
      context.fill();

      body.forEach((part, index) => {
        // The head reads solid and the tail fades, so direction is legible at a glance.
        const fade = 1 - Math.min(0.55, index / Math.max(12, body.length));
        context.globalAlpha = dead ? fade * 0.45 : fade;
        context.fillStyle = index === 0 ? PALETTE.ink : PALETTE.mint;
        const inset = index === 0 ? 3 : 4;
        roundRect(
          context,
          ORIGIN_X + part.x * CELL + inset,
          ORIGIN_Y + part.y * CELL + inset,
          CELL - inset * 2,
          CELL - inset * 2,
          index === 0 ? 7 : 5,
        );
        context.fill();
      });
      context.globalAlpha = 1;

      context.fillStyle = PALETTE.muted;
      context.font = "500 15px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textBaseline = "middle";
      context.fillText(`SCORE ${String(score).padStart(3, "0")}`, ORIGIN_X - 4, ORIGIN_Y - 26);
      context.textAlign = "right";
      context.fillText(`BEST ${String(Math.max(bestScore.get(), score)).padStart(3, "0")}`, ORIGIN_X + BOARD_WIDTH + 4, ORIGIN_Y - 26);
      context.textAlign = "left";

      if (dead) {
        context.fillStyle = "rgba(242, 244, 249, 0.82)";
        context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        context.fillStyle = PALETTE.ink;
        context.font = "600 34px ui-sans-serif, system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText("GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 14);
        context.fillStyle = PALETTE.muted;
        context.font = "500 16px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.fillText(`长度 ${body.length} · 按 A 重开`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 22);
        context.textAlign = "left";
      }
    };

    const stop = createLoop(step, draw);
    return { destroy: stop };
  },
};
