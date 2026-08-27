/**
 * The lab's filing cabinet.
 *
 * Every entry is something that actually happened in this repo's orbit — research,
 * bindings, retired prototypes. No fabricated work: an entry without an image simply
 * files without one. Thumbnails must point at files that exist in `public/` today.
 */

export type LabItem = {
  id: string;
  index: string;
  title: string;
  titleZh: string;
  year: string;
  status: "ONGOING" | "SHIPPED" | "RETIRED" | "KILLED";
  tag: string;
  summary: string;
  summaryZh: string;
  /** 每条「在试什么 / 试到哪 / 学到什么」中的最后一段。 */
  learned: string[];
  thumb?: string;
  link?: { href: string; label: string };
  /** Flip to false to file the drawer without this entry. */
  enabled: boolean;
};

// COPY-REVIEW: 文案初稿，等作者过目。

export const LAB_ITEMS: LabItem[] = [
  {
    id: "crt-shader",
    index: "A-01",
    title: "CRT / Shader Pipeline Research",
    titleZh: "CRT 后期链研究",
    year: "2026",
    status: "ONGOING",
    tag: "RENDERING",
    summary:
      "Reverse-engineering shader.se's single-pass composite — bloom, phosphor tint, lens distortion, chromatic aberration, luminance-aware grain — and rebuilding it in raw WebGL for this site's own shell.",
    summaryZh:
      "逆向 shader.se 的单次后期合成——bloom、荧光体着色、镜头畸变、色差、随亮度反比的颗粒——并用原生 WebGL 在本站的外壳里重建。",
    learned: [
      "后期不是滤镜叠加：九个步骤的顺序本身就是显像管的物理叙事。",
      "The order of the nine passes is the story of a picture tube; treating them as stackable filters is what makes CRT looks feel fake.",
    ],
    link: { href: "/", label: "IT RUNS THIS SITE →" },
    enabled: true,
  },
  {
    id: "live2d-binding",
    index: "A-02",
    title: "Live2D Binding & 3D Verification",
    titleZh: "Live2D 绑定与三维验证",
    year: "2026",
    status: "SHIPPED",
    tag: "CHARACTER",
    summary:
      "Rigging Joi's Live2D body and verifying the character against 3D generations — expression maps, attention states, and the seams where a 2D rig has to pretend to be a person.",
    summaryZh:
      "为 Joi 绑定 Live2D 身体，并用 3D 生成结果做三维一致性验证——表情映射、注意力状态，以及一个 2D 骨骼假装成人的那些接缝。",
    learned: [
      "表情不是资产，是状态机：绑定做到后面全是产品问题，不是美术问题。",
      "Expressions are a state machine, not an asset list — late-stage rigging problems are all product problems.",
    ],
    thumb: "/media/joi-live2d-preview.png",
    link: { href: "/work/joi", label: "LIVES IN JOI →" },
    enabled: true,
  },
  {
    id: "particle-prologue",
    index: "A-03",
    title: "Particle Prologue / Doorway QTE",
    titleZh: "粒子开场与门廊 QTE 复盘",
    year: "2026",
    status: "RETIRED",
    tag: "INTERACTION",
    summary:
      "The site's first entrance: a particle prologue and a knock-the-door QTE in front of a peephole. Retired when the CRT shell became the doorway. The particle system moved into the JOI9000's screen and lived there for a while; the terminal now shows an open sea instead.",
    summaryZh:
      "本站的第一版入口：粒子开场，加上猫眼前的敲门 QTE。CRT 外壳成为新的「门」之后退役——但粒子系统活在了 JOI9000 的屏幕里。",
    learned: [
      "仪式感值得做，但一个站只能有一扇门；两套入场仪式会互相谋杀。",
      "A site can only afford one door. Two entrance rituals murder each other.",
    ],
    thumb: "/assets/doorway-bg.png",
    enabled: true,
  },
  {
    id: "leitower",
    index: "A-04",
    title: "Leitower — Why I Killed It",
    titleZh: "类塔——为什么砍掉它",
    year: "2026",
    status: "KILLED",
    tag: "POSTMORTEM",
    summary:
      "A tower-defense prototype that never found its one interesting decision. Killing it made room for Night Tide — the judgement call mattered more than the artifact.",
    summaryZh:
      "一个始终没有找到「那一个有趣决策」的塔防原型。砍掉它，才有了夜潮——比起半成品本身，做出取舍的判断更重要。",
    learned: [
      "半成品不是资产，是负债；「为什么停」比「做了多少」更能说明判断力。",
      "An unfinished prototype is a liability, not an asset. Knowing why you stopped says more than how far you got.",
    ],
    enabled: true,
  },
];

export const labItems = LAB_ITEMS.filter((item) => item.enabled);
