/**
 * One hotspot per entry. The same ids bind the capture's node names (`roomBase.ts`), the
 * About interest chips, the pointer label and the focus camera.
 *
 * The room is the desk study and nothing else, so this list is only what is actually in
 * it. Interests with no object in the room — the cat, the handheld — have no chip rather
 * than a chip that points at nothing.
 *
 * The ball games used to be named here as a third one with nothing to point at. That is
 * no longer true: `roomBasketball.ts` retired the capture's guitar and stands a ball on
 * the floor where they were, so it has a chip now.
 */

export type RoomObjectId =
  | "crt-monitor"
  | "joi-music-box"
  | "camera"
  | "bookshelf"
  | "whiteboard"
  | "basketball";

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
  { id: "whiteboard", label: "DRAW ON IT", labelZh: "画板" },
  // COPY-REVIEW — the author is drafting this one; the pair below is a placeholder
  // written to the register of the five above it, not the copy.
  { id: "basketball", label: "BALL GAMES", labelZh: "打球" },
];
