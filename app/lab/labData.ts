/** Project dossiers. Sources recorded in docs/design-audits/lab-projects-2026-09.md. */
export type LabItem = {
  id: string; index: string; title: string; titleZh: string; year: string;
  status: "ONGOING" | "SHIPPED" | "RETIRED" | "KILLED";
  tag: string; summary: string; summaryZh: string;
  learned: string[]; learnedZh?: string[]; thumb?: string;
  link?: { href: string; label: string }; enabled: boolean;
};

// COPY-REVIEW: concise summaries of the existing project README / playtest handoff.
export const LAB_ITEMS: LabItem[] = [
  {
    id: "yuzhong", index: "A-01", title: "Yu Zhong", titleZh: "余钟",
    year: "2026", status: "ONGOING", tag: "UE5 / ARPG",
    summary: "A third-person action RPG study in Unreal Engine 5: a temple courtyard, one enemy, and a focused loop of light and charged attacks, dodging, healing and interruption.",
    summaryZh: "基于 Unreal Engine 5 的第三人称动作 RPG 样片。在寺院场景中，围绕一名敌人打磨轻重击、闪避、治疗与打断，探索战斗手感与环境氛围。",
    learned: ["Current scope: a single-enemy combat slice, with lock-on and retry.", "Environment, effects and performance are still being refined through playtesting."],
    learnedZh: ["当前范围：单敌人战斗样片，支持锁定、切换目标和重新挑战。", "环境、招式反馈与性能仍在根据试玩反馈迭代。"],
    thumb: "/work/lab/yuzhong.webp", enabled: true,
  },
  {
    id: "still-here", index: "A-02", title: "Still Here", titleZh: "余响",
    year: "2026", status: "ONGOING", tag: "THREE.JS / EXPLORATION",
    summary: "A playable third-person exploration prologue built with Three.js. A robot and its mechanical dog restore power to an abandoned gas station, solve linked puzzles and follow a signal toward a relay station.",
    summaryZh: "用 Three.js 制作的第三人称探索游戏序章。机器人与机器狗穿过废弃加油站，恢复供电、解决联动谜题，并沿信号走向中继站。",
    learned: ["Five explorable areas, a completable prologue and browser progress saving.", "Procedural models, rigid-body physics, dog pathfinding and desktop / touch controls."],
    learnedZh: ["五个探索区域、可完整通关的序章，以及浏览器进度存储。", "程序化模型、刚体物理、机器狗寻路与桌面 / 触摸操作。"],
    thumb: "/work/lab/still-here.webp", enabled: true,
  },
  {
    id: "afterlife", index: "A-03", title: "Afterlife", titleZh: "来生酒吧",
    year: "2026", status: "ONGOING", tag: "BLENDER / ENVIRONMENT",
    summary: "An environment reconstruction in Blender and Cycles, working from a supplied reference of the Afterlife bar. Independent geometry for the room, counter, seats, curved lighting canopy and pipework is refined through repeated composition and material checks.",
    summaryZh: "在 Blender 与 Cycles 中对照参考图重建来生酒吧。房间、吧台、座椅、曲面灯棚和管道均为独立三维对象，通过多轮构图、几何与材质检查逐步还原。",
    learned: ["Reference-led reconstruction; some local surfaces use reference-image UVs.", "An ongoing study of geometry, lighting and composition, with no claimed similarity score."],
    learnedZh: ["以参考图为依据的场景重建，部分局部表面使用参考图 UV。", "持续研究几何、光照和构图；不宣称未经验证的还原度。"],
    thumb: "/work/lab/afterlife.webp", enabled: true,
  },
  {
    id: "xuanzhao", index: "A-04", title: "Xuanzhao", titleZh: "玄照",
    year: "2026", status: "ONGOING", tag: "BLENDER → UE5 / CHARACTER",
    summary: "A stylised character carried end to end: parts generated from a reference pack, assembled and rigged in Blender, then played in Unreal Engine 5. The build runs in PIE with locomotion, combo and charged attacks, and spring-driven hair and fox ears; a MediaPipe face bridge maps 52 capture coefficients onto 25 morph targets and splits head rotation across two neck joints through a native Control Rig.",
    summaryZh: "一个从参考图做到可玩的角色：分件生成后在 Blender 组装、绑定，再进入 Unreal Engine 5。构建已在 PIE 中跑通位移、连段与蓄力攻击，头发与狐耳由弹簧驱动；面捕桥接把 MediaPipe 的 52 个系数映射到 25 个形态键，并经原生 Control Rig 把头部旋转分配到两段脖子。",
    learned: [
      "115 bones and 25 morph targets, measured in PIE at 555.66 cm/s running and 89.79 cm jumping, over Epic's Game Animation Sample locomotion set.",
      "Still native DefaultLit, and the skirt and ornaments have no realtime cloth yet — the NPR material pass and the live-input face session are the next stage.",
    ],
    learnedZh: [
      "115 骨骼、25 个形态键；PIE 实测跑速 555.66 cm/s、跳高 89.79 cm，位移动作基于 Epic 的 Game Animation Sample。",
      "目前仍是原生 DefaultLit，裙摆与饰物尚无实时布料；NPR 材质与实时输入的面捕接入是下一阶段。",
    ],
    thumb: "/work/lab/xuanzhao.webp", enabled: true,
  },
];
export const labItems = LAB_ITEMS.filter(item => item.enabled);
