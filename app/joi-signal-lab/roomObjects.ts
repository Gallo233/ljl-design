/**
 * One hotspot per entry. The same ids bind the capture's node names (`roomBase.ts`), the
 * About interest chips, the pointer label and the focus camera.
 *
 * The room is the desk study and nothing else, so this list is only what is actually in
 * it. Interests with no object in the room — the ball games, the cat, the handheld —
 * have no chip rather than a chip that points at nothing.
 */

export type RoomObjectId =
  | "crt-monitor"
  | "joi-music-box"
  | "camera"
  | "bookshelf";

export type RoomObjectDef = {
  id: RoomObjectId;
  label: string;
  labelZh: string;
};

export const ROOM_OBJECTS: RoomObjectDef[] = [
  { id: "crt-monitor", label: "AI PRODUCT & DESIGN", labelZh: "AI 产品与设计" },
  { id: "joi-music-box", label: "JOI RECORDS", labelZh: "JOI 唱片" },
  { id: "camera", label: "PHOTOGRAPHY", labelZh: "摄影" },
  { id: "bookshelf", label: "READING", labelZh: "阅读" },
];
