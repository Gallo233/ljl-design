/**
 * The room's object registry — the single source of truth binding three surfaces:
 *
 * 1. `room3d.ts` builds one pickable object per entry and tags its meshes with the id.
 * 2. The About panel's interest chips carry `data-interest={id}`.
 * 3. Hover/click in the room highlights the matching chip; interest copy (when the
 *    author supplies it) will file under the same ids.
 *
 * Change an id here and both the scene and the panel follow.
 */

export type RoomObjectId =
  | "crt-monitor"
  | "tablet-pen"
  | "handheld"
  | "headphones"
  | "camera"
  | "cat-figure"
  | "bookstack"
  | "window";

export type RoomObjectDef = {
  id: RoomObjectId;
  label: string;
  labelZh: string;
};

export const ROOM_OBJECTS: RoomObjectDef[] = [
  { id: "crt-monitor", label: "GRAPHICS & RENDERING", labelZh: "图形与渲染" },
  { id: "tablet-pen", label: "PRODUCT DESIGN", labelZh: "产品设计" },
  { id: "handheld", label: "GAMES", labelZh: "游戏" },
  { id: "headphones", label: "MUSIC", labelZh: "音乐" },
  { id: "camera", label: "PHOTOGRAPHY", labelZh: "摄影" },
  { id: "cat-figure", label: "CATS", labelZh: "猫" },
  { id: "bookstack", label: "READING", labelZh: "阅读" },
  { id: "window", label: "GUANGZHOU", labelZh: "广州" },
];
