/**
 * The reel's six frames, as data.
 *
 * Read by the shell that renders the reel and by the art that draws the four frames
 * with no footage behind them, which is why it is neither's file. Same shape as
 * `roomObjects.ts`: a table with no behaviour, so there is one place a frame is defined.
 *
 * Every frame is a real destination now: 01–03 are work,
 * 04 is the lab, and 05/06 land on sections of this same page — the open handler
 * turns those two into scrolls rather than route pushes, because pushing /about-me
 * would remount the whole lab and reboot both scenes.
 */
export const projects = [
  { index: "01", title: "Joi Presence", subtitle: "Multimodal AI Companion", href: "/work/joi", palette: ["#07121d", "#f2eee7", "#ea6448"] },
  { index: "02", title: "Joi Mobile", subtitle: "Native Character Companion", href: "/work/joi-mobile", palette: ["#d8d6ef", "#17152c", "#6558f5"] },
  { index: "03", title: "Game Center", subtitle: "One Handheld · Four Cartridges", href: "/play/night-tide", palette: ["#071a2b", "#d9edf2", "#2f9ed0"] },
  { index: "04", title: "The Lab", subtitle: "Research & Experiments", href: "/lab", palette: ["#0b2236", "#dce9ef", "#7caed0"] },
  { index: "05", title: "My Room", subtitle: "About · 我的房间", href: "/about-me", palette: ["#2b2033", "#f1dfda", "#ee795c"] },
  { index: "06", title: "Contact", subtitle: "Call Sheet · 联系", href: "/contact", palette: ["#e9e3d8", "#111214", "#e55f43"] },
] as const;

export type ProjectSignal = (typeof projects)[number];

/**
 * The reel's two moving frames, and the three ways they can be delivered.
 *
 * `src` is the desktop master. `mobileSrc` is the same footage at 960×540 — the Joi Mobile
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
 */
export const reelMotionSources = [
  {
    projectIndex: 0,
    src: "/reel/01-joi/showcase.mp4",
    mobileSrc: "/reel/01-joi/showcase-mobile.mp4",
    poster: "/reel/01-joi/still.avif",
    sheets: { dir: "/reel/01-joi/sheets-mobile", count: 5 },
  },
  {
    projectIndex: 1,
    src: "/reel/02-joi-mobile/showcase.mp4",
    mobileSrc: "/reel/02-joi-mobile/showcase-mobile.mp4",
    poster: "/reel/02-joi-mobile/still.avif",
    sheets: { dir: "/reel/02-joi-mobile/sheets-mobile", count: 5 },
  },
] as const;
export const reelPosterSources = reelMotionSources.map(({ projectIndex, poster }) => ({ projectIndex, poster }));
