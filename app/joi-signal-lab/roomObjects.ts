/**
 * One hotspot per entry. The same ids bind the capture's node names (`roomBase.ts`),
 * the pointer label and the focus camera.
 *
 * The room started as the desk study alone; it now also carries the props that make it
 * Gallo's — the handheld, Nick, the balls and the posters on the wall (`roomProps.ts`
 * builds those, so their ids have no capture nodes). Interests with no object in the
 * room still have no chip rather than a chip that points at nothing.
 *
 * Story copy is a first draft — `// COPY-REVIEW` — written to be read, not filler.
 */

// COPY-REVIEW: every labelZh / story below is a draft awaiting the author.

export type RoomObjectId =
  | "crt-monitor"
  | "joi-music-box"
  | "camera"
  | "bookshelf"
  | "poster"
  | "handheld"
  | "cat"
  | "balls";

export type RoomObjectDef = {
  id: RoomObjectId;
  label: string;
  labelZh: string;
  /** One sentence this object would say about itself, shown in its sheet. */
  storyZh: string;
};

export const ROOM_OBJECTS: RoomObjectDef[] = [
  {
    id: "crt-monitor",
    label: "THE TERMINAL",
    labelZh: "JOI9000 终端",
    storyZh: "我最重要的作品都从这样的屏幕里长出来。这台能打字，试试 help。",
  },
  {
    id: "joi-music-box",
    label: "JOI RECORDS",
    labelZh: "JOI 唱片台",
    storyZh: "写代码和写歌用的是同一块脑子。这里是它发呆的地方。",
  },
  {
    id: "camera",
    label: "FILM PHOTOGRAPHY",
    labelZh: "胶片相机",
    storyZh: "按快门和做产品是一回事：决定留住哪一秒。",
  },
  {
    id: "bookshelf",
    label: "READING",
    labelZh: "书架",
    storyZh: "从控制论到漫画，书架是输入的账本。",
  },
  {
    id: "poster",
    label: "POSTERS",
    labelZh: "墙上的海报",
    storyZh: "贴在墙上的，都是想成为的东西。",
  },
  {
    id: "handheld",
    label: "GAME CENTER",
    labelZh: "夜潮掌机",
    storyZh: "夜潮的第四盘卡带还没做完，机器先摆在这儿了。",
  },
  {
    id: "cat",
    label: "NICK",
    labelZh: "Nick",
    storyZh: "黑色的狸花，黄色的眼睛。房间最暖的位置是它的。",
  },
  {
    id: "balls",
    label: "AFTER HOURS",
    labelZh: "球场下班",
    storyZh: "屏幕看久了，就去楼下投两个。",
  },
];
