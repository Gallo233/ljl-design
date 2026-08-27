import {
  PALETTE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  createLoop,
  type ArcadeGame,
  type GameContext,
} from "./types";

/**
 * The maze. `#` wall, `.` pellet, `o` power pellet, ` ` empty, `-` ghost-house door.
 * 21 columns × 21 rows, with a wrap tunnel on the middle row.
 */
const MAZE = [
  "#####################",
  "#.........#.........#",
  "#o###.###.#.###.###o#",
  "#.###.###.#.###.###.#",
  "#...................#",
  "#.###.#.#####.#.###.#",
  "#.....#...#...#.....#",
  "#####.###.#.###.#####",
  "    #.#.......  #.#  ",
  "#####.#.##---##.#.###",
  "     ...#     #...   ",
  "#####.#.#######.#.###",
  "    #.#.........#.#  ",
  "#####.#.#####.#.#.###",
  "#..........#........#",
  "#.###.#####.#.#####.#",
  "#o..#.........   ..o#",
  "###.#.#.#####.#.#.###",
  "#.....#...#...#.....#",
  "#.#######.#.#######.#",
  "#...................#",
];

const COLUMNS = MAZE[0].length;
const ROWS = MAZE.length;
const CELL = 21;
const BOARD_WIDTH = COLUMNS * CELL;
const BOARD_HEIGHT = ROWS * CELL;
const ORIGIN_X = Math.round((SCREEN_WIDTH - BOARD_WIDTH) / 2);
const ORIGIN_Y = Math.round((SCREEN_HEIGHT - BOARD_HEIGHT) / 2);

const PLAYER_SPEED = 5.4;
const GHOST_SPEED = 4.6;
const FRIGHTENED_SPEED = 3.1;
const FRIGHTENED_SECONDS = 7;

type Vector = { x: number; y: number };
type Actor = {
  /** Tile-space position, fractional while moving between tiles. */
  x: number;
  y: number;
  dir: Vector;
  next: Vector;
};

type Ghost = Actor & {
  color: string;
  /** Where this ghost aims while chasing — the four differ only here. */
  target: (player: Actor, blinky: Ghost) => Vector;
  frightened: number;
  home: Vector;
  eaten: boolean;
};

const DIRECTIONS: Vector[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * Pac-Man.
 *
 * The ghosts are the point, and the thing that makes them ghosts rather than four copies of
 * the same chaser is that each one only differs in the *tile it aims at*: Blinky at the
 * player, Pinky four tiles ahead of them, Inky mirrored through Blinky, Clyde at the player
 * until it gets close and then at its corner. Movement itself is one shared rule — at every
 * tile centre, take the legal turn that lands nearest the target, never reversing.
 */
export const pacman: ArcadeGame = {
  id: "pacman",
  title: "PAC-MAN",
  titleZh: "吃豆人",
  blurb: "Four ghosts, four different ideas about you.",
  blurbZh: "四只鬼，四种追法。",
  accent: PALETTE.amber,
  controls: [
    { keys: "WASD / D-PAD", action: "移动" },
    { keys: "A", action: "重开" },
  ],
  mount(canvas: HTMLCanvasElement, { input, setStatus }: GameContext) {
    const context = canvas.getContext("2d");
    if (!context) return { destroy: () => {} };

    let tiles: string[][] = [];
    let player: Actor;
    let ghosts: Ghost[] = [];
    let score = 0;
    let lives = 3;
    let pelletsLeft = 0;
    let mouth = 0;
    let dead = false;
    let won = false;
    let respawnTimer = 0;
    let chainMultiplier = 1;

    const isWall = (x: number, y: number) => {
      const column = ((Math.round(x) % COLUMNS) + COLUMNS) % COLUMNS;
      const row = Math.round(y);
      if (row < 0 || row >= ROWS) return true;
      const cell = tiles[row][column];
      return cell === "#" || cell === "-";
    };
    /** Ghosts may pass their own door; the player may not. */
    const isWallForGhost = (x: number, y: number) => {
      const column = ((Math.round(x) % COLUMNS) + COLUMNS) % COLUMNS;
      const row = Math.round(y);
      if (row < 0 || row >= ROWS) return true;
      return tiles[row][column] === "#";
    };

    const wrap = (value: number) => ((value % COLUMNS) + COLUMNS) % COLUMNS;

    const makeGhosts = (): Ghost[] => {
      const blinkyTarget = (p: Actor) => ({ x: p.x, y: p.y });
      const base = { frightened: 0, eaten: false, dir: { x: -1, y: 0 }, next: { x: -1, y: 0 } };
      const list: Ghost[] = [
        {
          ...base, x: 10, y: 8, color: PALETTE.coral, home: { x: 10, y: 8 },
          target: blinkyTarget,
        },
        {
          ...base, x: 9, y: 10, color: PALETTE.rose, home: { x: 9, y: 10 },
          // Four tiles ahead of the player, so Pinky cuts corners rather than following.
          target: (p) => ({ x: p.x + p.dir.x * 4, y: p.y + p.dir.y * 4 }),
        },
        {
          ...base, x: 10, y: 10, color: PALETTE.mint, home: { x: 10, y: 10 },
          // Two ahead of the player, then doubled through Blinky — pincers with Blinky.
          target: (p, blinky) => ({
            x: (p.x + p.dir.x * 2) * 2 - blinky.x,
            y: (p.y + p.dir.y * 2) * 2 - blinky.y,
          }),
        },
        {
          ...base, x: 11, y: 10, color: PALETTE.amber, home: { x: 11, y: 10 },
          // Chases until within eight tiles, then loses its nerve and goes home.
          target: (p, self) => {
            const distance = Math.hypot(p.x - self.x, p.y - self.y);
            return distance > 8 ? { x: p.x, y: p.y } : { x: 1, y: ROWS - 2 };
          },
        },
      ];
      return list;
    };

    const reset = (fullReset: boolean) => {
      if (fullReset) {
        tiles = MAZE.map((row) => row.split(""));
        pelletsLeft = tiles.flat().filter((cell) => cell === "." || cell === "o").length;
        score = 0;
        lives = 3;
        won = false;
      }
      player = { x: 10, y: 14, dir: { x: -1, y: 0 }, next: { x: -1, y: 0 } };
      ghosts = makeGhosts();
      dead = false;
      chainMultiplier = 1;
      setStatus(`PAC-MAN / ${score} · ♥${lives}`);
    };
    reset(true);

    const atCentre = (actor: Actor) =>
      Math.abs(actor.x - Math.round(actor.x)) < 0.06 && Math.abs(actor.y - Math.round(actor.y)) < 0.06;

    const moveActor = (actor: Actor, speed: number, delta: number, wallAt: (x: number, y: number) => boolean) => {
      if (atCentre(actor)) {
        actor.x = Math.round(actor.x);
        actor.y = Math.round(actor.y);
        // A queued turn is taken at the first centre where it is legal, which is what makes
        // pre-turning into a corner feel responsive instead of dropped.
        if (!wallAt(actor.x + actor.next.x, actor.y + actor.next.y)) actor.dir = actor.next;
        if (wallAt(actor.x + actor.dir.x, actor.y + actor.dir.y)) return;
      }
      actor.x += actor.dir.x * speed * delta;
      actor.y += actor.dir.y * speed * delta;
      actor.x = wrap(actor.x);
    };

    const chooseGhostDirection = (ghost: Ghost, blinky: Ghost) => {
      const target = ghost.eaten
        ? ghost.home
        : ghost.frightened > 0
          ? { x: Math.random() * COLUMNS, y: Math.random() * ROWS }
          : ghost.target(player, ghost === blinky ? ghost : blinky);
      let best: Vector | null = null;
      let bestDistance = Infinity;
      const originX = Math.round(ghost.x);
      const originY = Math.round(ghost.y);
      for (const direction of DIRECTIONS) {
        // Reversing is forbidden — it is what stops ghosts oscillating in a corridor.
        if (direction.x === -ghost.dir.x && direction.y === -ghost.dir.y) continue;
        const nx = originX + direction.x;
        const ny = originY + direction.y;
        if (isWallForGhost(nx, ny)) continue;
        const distance = Math.hypot(wrap(nx) - target.x, ny - target.y);
        if (distance < bestDistance) { bestDistance = distance; best = direction; }
      }
      if (best) ghost.next = best;
    };

    const step = (delta: number) => {
      if (won || (dead && respawnTimer <= 0)) {
        if (input.pressed("a") || input.pressed("start")) reset(true);
        return;
      }
      if (dead) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) {
          if (lives > 0) reset(false);
          else setStatus(`GAME OVER / ${score} · A 重开`);
        }
        return;
      }

      // Keep both held and edge-triggered input: a quick physical-button tap between
      // animation frames must still queue the next turn.
      if (input.pressed("up") || input.isDown("up")) player.next = { x: 0, y: -1 };
      else if (input.pressed("down") || input.isDown("down")) player.next = { x: 0, y: 1 };
      else if (input.pressed("left") || input.isDown("left")) player.next = { x: -1, y: 0 };
      else if (input.pressed("right") || input.isDown("right")) player.next = { x: 1, y: 0 };

      moveActor(player, PLAYER_SPEED, delta, isWall);
      mouth += delta * 9;

      const tileX = Math.round(player.x);
      const tileY = Math.round(player.y);
      if (tiles[tileY]?.[tileX] === "." || tiles[tileY]?.[tileX] === "o") {
        const power = tiles[tileY][tileX] === "o";
        tiles[tileY][tileX] = " ";
        pelletsLeft -= 1;
        score += power ? 50 : 10;
        if (power) {
          chainMultiplier = 1;
          ghosts.forEach((ghost) => { if (!ghost.eaten) ghost.frightened = FRIGHTENED_SECONDS; });
        }
        setStatus(`PAC-MAN / ${score} · ♥${lives}`);
        if (pelletsLeft === 0) {
          won = true;
          setStatus(`CLEARED / ${score} · A 再来`);
          return;
        }
      }

      const blinky = ghosts[0];
      ghosts.forEach((ghost) => {
        if (ghost.frightened > 0) ghost.frightened = Math.max(0, ghost.frightened - delta);
        if (atCentre(ghost)) chooseGhostDirection(ghost, blinky);
        const speed = ghost.eaten ? GHOST_SPEED * 1.8 : ghost.frightened > 0 ? FRIGHTENED_SPEED : GHOST_SPEED;
        moveActor(ghost, speed, delta, isWallForGhost);
        if (ghost.eaten && Math.hypot(ghost.x - ghost.home.x, ghost.y - ghost.home.y) < 0.5) {
          ghost.eaten = false;
          ghost.frightened = 0;
        }

        const gap = Math.hypot(wrap(ghost.x - player.x + COLUMNS / 2) - COLUMNS / 2, ghost.y - player.y);
        if (gap > 0.7 || ghost.eaten) return;
        if (ghost.frightened > 0) {
          ghost.eaten = true;
          ghost.frightened = 0;
          score += 200 * chainMultiplier;
          chainMultiplier = Math.min(8, chainMultiplier * 2);
          setStatus(`PAC-MAN / ${score} · ♥${lives}`);
        } else {
          lives -= 1;
          dead = true;
          respawnTimer = 1.1;
          setStatus(lives > 0 ? `CAUGHT / ♥${lives}` : `GAME OVER / ${score} · A 重开`);
        }
      });
    };

    const draw = () => {
      context.fillStyle = PALETTE.paper;
      context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLUMNS; x += 1) {
          const cell = tiles[y][x];
          const px = ORIGIN_X + x * CELL;
          const py = ORIGIN_Y + y * CELL;
          if (cell === "#") {
            context.fillStyle = "#dfe4f0";
            context.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
            context.strokeStyle = "#ccd4e6";
            context.lineWidth = 1;
            context.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
          } else if (cell === "-") {
            context.fillStyle = PALETTE.muted;
            context.fillRect(px + 2, py + CELL / 2 - 1.5, CELL - 4, 3);
          } else if (cell === ".") {
            context.fillStyle = "#b3bccf";
            context.beginPath();
            context.arc(px + CELL / 2, py + CELL / 2, 2.4, 0, Math.PI * 2);
            context.fill();
          } else if (cell === "o") {
            context.fillStyle = PALETTE.indigo;
            context.beginPath();
            context.arc(px + CELL / 2, py + CELL / 2, 5.4, 0, Math.PI * 2);
            context.fill();
          }
        }
      }

      if (!dead) {
        const angle = (Math.sin(mouth) * 0.5 + 0.5) * 0.62 + 0.06;
        const facing = Math.atan2(player.dir.y, player.dir.x);
        context.fillStyle = PALETTE.amber;
        context.beginPath();
        context.moveTo(ORIGIN_X + player.x * CELL + CELL / 2, ORIGIN_Y + player.y * CELL + CELL / 2);
        context.arc(
          ORIGIN_X + player.x * CELL + CELL / 2,
          ORIGIN_Y + player.y * CELL + CELL / 2,
          CELL * 0.44,
          facing + angle,
          facing - angle,
        );
        context.closePath();
        context.fill();
      }

      ghosts.forEach((ghost) => {
        const cx = ORIGIN_X + ghost.x * CELL + CELL / 2;
        const cy = ORIGIN_Y + ghost.y * CELL + CELL / 2;
        const radius = CELL * 0.42;
        if (ghost.eaten) {
          context.fillStyle = PALETTE.muted;
        } else if (ghost.frightened > 0) {
          // The last second and a half flashes, the classic warning that it is ending.
          context.fillStyle = ghost.frightened < 1.5 && Math.floor(ghost.frightened * 6) % 2 === 0
            ? PALETTE.panel
            : PALETTE.indigo;
        } else {
          context.fillStyle = ghost.color;
        }
        context.beginPath();
        context.arc(cx, cy - radius * 0.15, radius, Math.PI, 0);
        context.lineTo(cx + radius, cy + radius * 0.75);
        for (let i = 0; i < 3; i += 1) {
          const step = (radius * 2) / 3;
          context.lineTo(cx + radius - step * i - step / 2, cy + radius * 0.4);
          context.lineTo(cx + radius - step * (i + 1), cy + radius * 0.75);
        }
        context.closePath();
        context.fill();

        if (!ghost.eaten) {
          context.fillStyle = PALETTE.panel;
          [-1, 1].forEach((side) => {
            context.beginPath();
            context.arc(cx + side * radius * 0.34, cy - radius * 0.2, radius * 0.27, 0, Math.PI * 2);
            context.fill();
          });
          context.fillStyle = PALETTE.ink;
          [-1, 1].forEach((side) => {
            context.beginPath();
            context.arc(
              cx + side * radius * 0.34 + ghost.dir.x * radius * 0.1,
              cy - radius * 0.2 + ghost.dir.y * radius * 0.1,
              radius * 0.13,
              0,
              Math.PI * 2,
            );
            context.fill();
          });
        }
      });

      context.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textBaseline = "middle";
      context.fillStyle = PALETTE.muted;
      context.fillText(`SCORE ${score}`, ORIGIN_X, ORIGIN_Y - 16);
      context.textAlign = "right";
      context.fillText("♥".repeat(Math.max(0, lives)), ORIGIN_X + BOARD_WIDTH, ORIGIN_Y - 16);
      context.textAlign = "left";

      if (won || (dead && lives <= 0)) {
        context.fillStyle = "rgba(242, 244, 249, 0.86)";
        context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        context.fillStyle = PALETTE.ink;
        context.font = "600 34px ui-sans-serif, system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText(won ? "MAZE CLEARED" : "GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 14);
        context.fillStyle = PALETTE.muted;
        context.font = "500 16px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.fillText(`${score} 分 · 按 A 重开`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 22);
        context.textAlign = "left";
      }
    };

    const stop = createLoop(step, draw);
    return { destroy: stop };
  },
};
