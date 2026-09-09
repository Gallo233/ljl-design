import { pacman } from "./pacman";
import { snake } from "./snake";
import { tetris } from "./tetris";
import { PALETTE, type ArcadeGame, type GameButton } from "./types";

export { PALETTE, SCREEN_HEIGHT, SCREEN_WIDTH } from "./types";
export type { ArcadeGame, GameButton, GameHandle, GameInput } from "./types";

/**
 * What the cartridge shelf holds.
 *
 * The Godot builds are not in this list because they are not canvas games — they are
 * WebAssembly in an iframe, and the shell mounts them differently. The three classics exist
 * so the select screen has something to select *between*: a game centre with one cartridge
 * is just a game.
 */
export const arcadeGames: ArcadeGame[] = [snake, tetris, pacman];

/**
 * The Godot builds.
 *
 * Described the same way as a canvas game so the select screen and the 3D rack can lay
 * them out together, plus the two things a WebAssembly build in an iframe needs and a
 * canvas game does not: where its export lives, and which key each shell button sends.
 *
 * `code` is the field that matters. Both builds bind *physical* keycodes
 * (`InputEventKey.physical_keycode`), which the web export resolves from
 * `KeyboardEvent.code` — so a mapping with the right `code` works on any keyboard layout,
 * and one with only the right `key` does not work at all.
 */
export type GodotGame = {
  id: string;
  title: string;
  titleZh: string;
  blurb: string;
  blurbZh: string;
  accent: string;
  controls: Array<{ keys: string; keysZh?: string; action: string; actionZh: string }>;
  /** Site-root-relative; the shell prefixes `basePath` and a cache-busting version. */
  build: string;
  /** Shown on the input monitor while the wasm downloads. */
  loading: string;
  buttons: Partial<Record<GameButton, { key: string; code: string; label: string; labelZh: string }>>;
};

export const nightTideEntry: GodotGame = {
  id: "night-tide",
  title: "ZERO HOUR: NIGHT TIDE",
  titleZh: "零刻：夜潮",
  blurb: "Godot action prototype · v0.1 demo",
  blurbZh: "Godot 动作原型 · v0.1 试玩版",
  accent: PALETTE.indigo,
  build: "/games/night-tide/index.html?v=embedded-font-2",
  loading: "LOADING BUILD",
  controls: [
    { keys: "WASD", action: "Move", actionZh: "移动" },
    { keys: "SPACE / A", action: "Jump", actionZh: "跳跃" },
    { keys: "SHIFT / B", action: "Dodge", actionZh: "闪避" },
    { keys: "J / X", action: "Light attack", actionZh: "轻攻击" },
    { keys: "K / Y", action: "Heavy attack", actionZh: "重攻击" },
    { keys: "L / L1", action: "Parry", actionZh: "弹反" },
    { keys: "Q / L2", action: "Pull", actionZh: "牵引" },
    { keys: "E / R1", action: "Phase slash", actionZh: "相位斩" },
    { keys: "R / R2", action: "Gravity collapse", actionZh: "引力坍缩" },
    { keys: "ESC / START", action: "Pause", actionZh: "暂停" },
  ],
  /** Mirrors `scripts/app/app_state.gd` in the Night Tide source project. */
  buttons: {
    up: { key: "w", code: "KeyW", label: "Move up", labelZh: "移动 上" },
    down: { key: "s", code: "KeyS", label: "Move down", labelZh: "移动 下" },
    left: { key: "a", code: "KeyA", label: "Move left", labelZh: "移动 左" },
    right: { key: "d", code: "KeyD", label: "Move right", labelZh: "移动 右" },
    a: { key: " ", code: "Space", label: "Jump", labelZh: "跳跃" },
    b: { key: "Shift", code: "ShiftLeft", label: "Dodge", labelZh: "闪避" },
    x: { key: "j", code: "KeyJ", label: "Light attack", labelZh: "轻攻击" },
    y: { key: "k", code: "KeyK", label: "Heavy attack", labelZh: "重攻击" },
    l1: { key: "l", code: "KeyL", label: "Parry", labelZh: "弹反" },
    l2: { key: "q", code: "KeyQ", label: "Pull", labelZh: "牵引" },
    r1: { key: "e", code: "KeyE", label: "Phase slash", labelZh: "相位斩" },
    r2: { key: "r", code: "KeyR", label: "Gravity collapse", labelZh: "引力坍缩" },
    start: { key: "Escape", code: "Escape", label: "Pause", labelZh: "暂停" },
  },
};

export const starVeinEntry: GodotGame = {
  id: "star-vein",
  title: "STAR VEIN",
  titleZh: "星脉",
  blurb: "Godot 2D pixel sandbox survival",
  blurbZh: "Godot 2D 像素沙盒生存",
  accent: PALETTE.rose,
  build: "/games/star-vein/index.html?v=ui-scale-1",
  loading: "LOADING BUILD",
  controls: [
    { keys: "A / D / ←→", action: "Move", actionZh: "移动" },
    { keys: "SPACE / A", action: "Jump", actionZh: "跳跃" },
    { keys: "Left click", keysZh: "鼠标左键", action: "Mine", actionZh: "挖掘" },
    { keys: "Right click", keysZh: "鼠标右键", action: "Place block", actionZh: "放置方块" },
    { keys: "L1~R2", action: "Hotbar 1–4", actionZh: "快捷栏 1~4" },
    { keys: "X / E", action: "Inventory", actionZh: "背包" },
    { keys: "Y / C", action: "Craft", actionZh: "合成" },
    { keys: "B / F", action: "Talk to an NPC", actionZh: "与 NPC 交互" },
    { keys: "ESC / START", action: "Pause", actionZh: "暂停" },
  ],
  /*
   * Mirrors `scripts/engine/game_state.gd::_register_actions` in the star_vein project.
   *
   * Mining and placing are bound to the mouse there, not the keyboard, so they stay on
   * the mouse: the build's canvas is a real element on the console's screen and receives
   * real clicks. The face buttons cover everything that is a key. There is no `down`
   * because the game binds no downward action — an unmapped button is simply not sent.
   */
  buttons: {
    up: { key: "ArrowUp", code: "ArrowUp", label: "Jump", labelZh: "跳跃" },
    left: { key: "a", code: "KeyA", label: "Move left", labelZh: "移动 左" },
    right: { key: "d", code: "KeyD", label: "Move right", labelZh: "移动 右" },
    a: { key: " ", code: "Space", label: "Jump", labelZh: "跳跃" },
    b: { key: "f", code: "KeyF", label: "Interact", labelZh: "交互" },
    x: { key: "e", code: "KeyE", label: "Inventory", labelZh: "背包" },
    y: { key: "c", code: "KeyC", label: "Craft", labelZh: "合成" },
    l1: { key: "1", code: "Digit1", label: "Hotbar 1", labelZh: "快捷栏 1" },
    l2: { key: "2", code: "Digit2", label: "Hotbar 2", labelZh: "快捷栏 2" },
    r1: { key: "3", code: "Digit3", label: "Hotbar 3", labelZh: "快捷栏 3" },
    r2: { key: "4", code: "Digit4", label: "Hotbar 4", labelZh: "快捷栏 4" },
    start: { key: "Escape", code: "Escape", label: "Pause", labelZh: "暂停" },
  },
};

/** Godot builds first on the shelf, in release order. */
export const godotGames: GodotGame[] = [nightTideEntry, starVeinEntry];

export function getGame(id: string) {
  return arcadeGames.find((game) => game.id === id);
}
