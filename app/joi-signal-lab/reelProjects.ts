/**
 * The reel's six frames, as data.
 *
 * Read by the shell that renders the reel and by the art that draws the four frames
 * with no footage behind them, which is why it is neither's file. Same shape as
 * `roomObjects.ts`: a table with no behaviour, so there is one place a frame is defined.
 *
 * `titleZh` / `subtitleZh` carry the Chinese the switch reads. Frames 01 and 02 repeat
 * their English title on purpose: Joi Presence and Joi Mobile are product names, and a
 * name that gets translated is how a site starts calling one thing two things.
 *
 * Every frame is a real destination now: 01–03 are work,
 * 04 is the lab, and 05/06 land on sections of this same page — the open handler
 * turns those two into scrolls rather than route pushes, because pushing /about-me
 * would remount the whole lab and reboot both scenes.
 */
export const projects = [
  { index: "01", title: "Joi Presence", titleZh: "Joi Presence", subtitle: "Multimodal AI Companion", subtitleZh: "多模态 AI 伙伴", href: "/work/joi", palette: ["#07121d", "#f2eee7", "#ea6448"] },
  { index: "02", title: "Joi Mobile", titleZh: "Joi Mobile", subtitle: "Native Character Companion", subtitleZh: "原生角色伙伴", href: "/work/joi-mobile", palette: ["#d8d6ef", "#17152c", "#6558f5"] },
  { index: "03", title: "Game Center", titleZh: "游戏厅", subtitle: "One Handheld · Four Cartridges", subtitleZh: "一台掌机 · 四张卡带", href: "/play/night-tide", palette: ["#071a2b", "#d9edf2", "#2f9ed0"] },
  { index: "04", title: "The Lab", titleZh: "实验室", subtitle: "Research & Experiments", subtitleZh: "研究与实验", href: "/lab", palette: ["#0b2236", "#dce9ef", "#7caed0"] },
  { index: "05", title: "My Room", titleZh: "我的房间", subtitle: "About", subtitleZh: "关于我", href: "/about-me", palette: ["#2b2033", "#f1dfda", "#ee795c"] },
  { index: "06", title: "Contact", titleZh: "联系", subtitle: "Say hello", subtitleZh: "打个招呼", href: "/contact", palette: ["#e9e3d8", "#111214", "#e55f43"] },
] as const;

export type ProjectSignal = (typeof projects)[number];

/**
 * The reel's three moving frames, and the three ways each can be delivered.
 *
 * `src` is the desktop master. `mobileSrc` is the same footage smaller — the Joi Mobile
 * master is **2560×1440**, and decoding that every frame *and* uploading it as a WebGL
 * texture is more than a phone GPU will do while a second WebGL context is also running.
 * That is most of why the mobile reel both stalled and dropped frames.
 *
 * `sheets` is the last resort, and it exists because a re-encode does not help against the
 * other mobile failure mode: several Chinese Android browsers (UC / Quark's T7 kernel,
 * WeChat's X5) hoist `<video>` out of the page into a native player layer. The element keeps
 * reporting a healthy `readyState` while the WebGL texture receives nothing — which is
 * exactly how the frame rendered *black* instead of falling back. Sprite sheets are plain
 * images, so no video policy can reach them.
 *
 * Sheet cell size travels with the source rather than sitting in `reelMotion.ts`: frames 01
 * and 02 are 16:9 footage, and the lab's is 4:3, so one baked-in cell size would stretch one
 * of them. Columns, rows and fps are still fixed by the bake recipe and stay in that file.
 */
export const reelMotionSources = [
  {
    projectIndex: 0,
    src: "/reel/01-joi/showcase.mp4",
    mobileSrc: "/reel/01-joi/showcase-mobile.mp4",
    poster: "/reel/01-joi/still.avif",
    sheets: { dir: "/reel/01-joi/sheets-mobile", count: 5, frameWidth: 480, frameHeight: 270 },
  },
  {
    projectIndex: 1,
    src: "/reel/02-joi-mobile/showcase.mp4",
    mobileSrc: "/reel/02-joi-mobile/showcase-mobile.mp4",
    poster: "/reel/02-joi-mobile/still.avif",
    sheets: { dir: "/reel/02-joi-mobile/sheets-mobile", count: 5, frameWidth: 480, frameHeight: 270 },
  },
  /*
   * Frame 04 is the lab, and its footage is the Xuanzhao face-capture session running in
   * UE5 — cropped to the viewport so the editor's own panels never reach the film cell.
   * It is authored 4:3 to match the cell, so the shader samples it with no inset, unlike
   * frame 02's 16:9 master. This frame used to be a three.js still life; the drawer scene
   * is gone, and the atlas art plus this poster are what stand in before the first frame.
   */
  {
    projectIndex: 3,
    src: "/reel/04-lab/showcase.mp4",
    mobileSrc: "/reel/04-lab/showcase-mobile.mp4",
    poster: "/reel/04-lab/still.avif",
    sheets: { dir: "/reel/04-lab/sheets-mobile", count: 5, frameWidth: 480, frameHeight: 360 },
  },
] as const;
export const reelPosterSources = reelMotionSources.map(({ projectIndex, poster }) => ({ projectIndex, poster }));

/**
 * The frame before this one, for the "previous project" card the destinations carry.
 *
 * Derived from the same table the reel is built from, so a re-ordered reel re-orders
 * these too rather than leaving three pages pointing at where a frame used to be.
 * Frame 01 has no previous and returns `null`; the card is simply not rendered.
 */
export function previousProject(href: string) {
  const index = projects.findIndex((project) => project.href === href);
  if (index <= 0) return null;
  const previous = projects[index - 1];
  return {
    href: previous.href,
    index: previous.index,
    title: previous.title,
    titleZh: previous.titleZh,
  };
}
