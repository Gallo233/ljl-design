export type ProjectSection = {
  heading: string;
  headingZh: string;
  body: string[];
  bodyZh: string[];
};

export type ProjectFigure = {
  src: string;
  alt: string;
  caption: string;
};

export type ProjectCase = {
  slug: string;
  index: string;
  title: string;
  date: string;
  kind: string;
  /** Optional line shown under the title on the detail page. */
  tagline?: string;
  role: string;
  repo: string;
  summary: string;
  summaryZh: string;
  question: string;
  caseFrame: {
    decision: string;
    outcome: string;
  };
  cover: string;
  figures: ProjectFigure[];
  sections: ProjectSection[];
  nextSlug: string;
  nextTitle: string;
};

export const projects: ProjectCase[] = [
  {
    slug: "joi",
    index: "01",
    title: "JOI — PRESENCE",
    date: "MAY — JULY 2026",
    kind: "WINDOWS-FIRST MULTIMODAL COMPANION",
    tagline: "A machine learning how to live with you.",
    role: "PRODUCT / DESIGN / DEVELOPMENT",
    repo: "https://github.com/Gallo233/Joi",
    summary:
      "Joi explores what changes when an AI assistant gains continuity, boundaries, a character, and a visible way of acting inside a person's computer.",
    summaryZh:
      "Joi 探索的是：当 AI 助手拥有连续性、边界、人格，以及在人的电脑里清晰可见的行动方式时，我们与它的关系会发生什么变化。",
    question: "How can an agent feel present without taking control away from the person beside it?",
    caseFrame: {
      decision:
        "Separate planning, policy, memory, events, and tools—then expose actions as inspectable, interruptible states.",
      outcome:
        "A working Windows-first companion prototype with approvals, character states, memory, and an observe → act → verify trail.",
    },
    cover: "/assets/joi-app-v3.png",
    figures: [
      {
        src: "/assets/joi-app-v3.png",
        alt: "Joi character system showing front, side, back, expressions, and accessories",
        caption: "Joi identity system / character continuity across product states",
      },
      {
        src: "/media/joi-live2d-preview.png",
        alt: "Joi Live2D working reference",
        caption: "Embodied interface study / Live2D working reference",
      },
    ],
    sections: [
      {
        heading: "The Question",
        headingZh: "问题",
        body: [
          "Most assistants disappear between requests. Joi starts from the opposite premise: a useful companion should remember context, show intention, and remain interruptible while work is happening.",
          "The character is not decoration. It is the visible edge of a system made from planning, memory, policy, tools, and review.",
        ],
        bodyZh: [
          "大多数助手会在请求之间消失。Joi 从相反的前提出发：一个有用的伴侣应该记住上下文、表达意图，并在工作发生时随时可以被打断。",
          "角色并不是装饰，而是规划、记忆、策略、工具与复核机制共同构成的系统边界。",
        ],
      },
      {
        heading: "A Legible Agent",
        headingZh: "可理解的智能体",
        body: [
          "The Python core separates planning, policy gates, memory, events, and tool adapters. The Tauri and Vue shell translates that machinery into task cards, approvals, conversation, character states, and a developer audit view.",
          "Computer Use actions preserve an observe, target, approve, act, and verify trail so automation remains inspectable instead of magical.",
        ],
        bodyZh: [
          "Python 核心把规划、策略网关、记忆、事件和工具适配器分开；Tauri 与 Vue 前端再把这些机制翻译为任务卡、审批、对话、角色状态与开发者审计视图。",
          "Computer Use 操作保留观察、定位、确认、执行和验证记录，让自动化保持可检查，而不是神秘地发生。",
        ],
      },
      {
        heading: "Where It Goes",
        headingZh: "下一步",
        body: [
          "The next milestone is not maximum autonomy. It is a convincing shared loop: Joi notices a context, proposes a small next step, waits for consent, acts, and checks what changed.",
        ],
        bodyZh: [
          "下一阶段的目标不是最大化自主性，而是建立一个可信的共同循环：Joi 注意到上下文，提出一个小步骤，等待确认，执行，并检查发生了什么变化。",
        ],
      },
    ],
    nextSlug: "joi-map",
    nextTitle: "JOI MAP — REACH",
  },
  {
    slug: "joi-map",
    index: "02",
    title: "JOI MAP — REACH",
    date: "JUNE — JULY 2026",
    kind: "WORLD-FACING AI GUIDE",
    role: "PRODUCT / DESIGN / SWIFTUI",
    repo: "https://github.com/Gallo233/joi-map-ios",
    summary:
      "Joi Map extends a virtual personality toward real places, combining location, maps, visual recognition, narration, routes, and follow-up questions.",
    summaryZh:
      "Joi Map 把虚拟人格延伸到真实地点，把定位、地图、视觉识别、讲解、路线与追问连接成一个持续的现场体验。",
    question: "How far can a personality travel before it changes the way we notice the world?",
    caseFrame: {
      decision:
        "Treat locate → understand → narrate → recommend → remember as one continuous guide loop.",
      outcome:
        "A working SwiftUI MVP connecting MapKit, multilingual interaction, visual recognition, narration, routes, sources, and correction.",
    },
    cover: "/assets/joi-map-v3.png",
    figures: [
      {
        src: "/assets/joi-map-v3.png",
        alt: "Joi Map character system with a map, camera, bag, and location details",
        caption: "Joi Map identity / the same personality prepared for the field",
      },
      {
        src: "/assets/joi-map-main-ui.png",
        alt: "Joi Map iOS interface showing a three-dimensional city map",
        caption: "Working SwiftUI MVP / location, route, recognition, and narration",
      },
    ],
    sections: [
      {
        heading: "Beyond Location",
        headingZh: "不只定位",
        body: [
          "A normal map answers where. Joi Map is interested in where, what, why, and what might be worth noticing next.",
          "The MVP combines MapKit, location state, nearby cultural routes, photo recognition, narration, sources, correction, and follow-up questions.",
        ],
        bodyZh: [
          "普通地图回答在哪里，Joi Map 更关心在哪里、这是什么、为什么值得注意，以及下一步还可以看见什么。",
          "当前 MVP 把 MapKit、定位状态、附近文化路线、拍照识别、讲解、信源、纠错与追问整合到一起。",
        ],
      },
      {
        heading: "A Continuous Guide",
        headingZh: "持续的导览",
        body: [
          "The interaction is designed as one loop rather than a collection of AI buttons: locate, understand, narrate, recommend, remember, and continue the conversation.",
          "Manual language switching currently supports Simplified Chinese, Traditional Chinese, English, Japanese, and Korean, while visual fallback keeps recognition useful when network services are unavailable.",
        ],
        bodyZh: [
          "交互不是一组 AI 按钮，而是一个连续循环：定位、理解、讲解、推荐、记住，并继续对话。",
          "应用目前支持简中、繁中、英语、日语和韩语手动切换，本地 Vision 兜底则让识景在网络服务不可用时仍然可用。",
        ],
      },
      {
        heading: "The Boundary",
        headingZh: "边界",
        body: [
          "The deeper design problem is deciding how close a virtual personality should stand to a real moment. The product should add attention and context without replacing the place itself.",
        ],
        bodyZh: [
          "更深层的设计问题是：虚拟人格应该站得离真实时刻多近。产品应当增加注意力与上下文，而不是替代地点本身。",
        ],
      },
    ],
    nextSlug: "joi",
    nextTitle: "JOI — PRESENCE",
  },
];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}
