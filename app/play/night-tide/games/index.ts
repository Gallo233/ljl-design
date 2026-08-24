import { pacman } from "./pacman";
import { snake } from "./snake";
import { tetris } from "./tetris";
import { PALETTE, type ArcadeGame } from "./types";

export { PALETTE, SCREEN_HEIGHT, SCREEN_WIDTH } from "./types";
export type { ArcadeGame, GameButton, GameHandle, GameInput } from "./types";

/**
 * What the cartridge shelf holds.
 *
 * Night Tide is not in this list because it is not a canvas game — it is a Godot build in an
 * iframe, and the shell special-cases it. The three classics exist so the select screen has
 * something to select *between*: a game centre with one cartridge is just a game.
 */
export const arcadeGames: ArcadeGame[] = [snake, tetris, pacman];

/** The Godot build, described the same way so the select screen can lay them out together. */
export const nightTideEntry = {
  id: "night-tide",
  title: "ZERO HOUR: NIGHT TIDE",
  titleZh: "零刻：夜潮",
  blurb: "Godot action prototype · v0.1 demo",
  blurbZh: "Godot 动作原型 · v0.1 试玩版",
  accent: PALETTE.indigo,
  controls: [
    { keys: "WASD", action: "移动" },
    { keys: "SPACE / A", action: "跳跃" },
    { keys: "SHIFT / B", action: "闪避" },
    { keys: "J / X", action: "轻攻击" },
    { keys: "K / Y", action: "重攻击" },
    { keys: "L / L1", action: "弹反" },
    { keys: "Q / L2", action: "牵引" },
    { keys: "E / R1", action: "相位斩" },
    { keys: "R / R2", action: "引力坍缩" },
    { keys: "ESC / START", action: "暂停" },
  ],
} as const;

export function getGame(id: string) {
  return arcadeGames.find((game) => game.id === id);
}
