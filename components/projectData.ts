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

export type ProjectLoopStep = {
  index: string;
  label: string;
  title: string;
  body: string;
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
  status: string;
  stack: string;
  summary: string;
  summaryZh: string;
  question: string;
  caseFrame: {
    decision: string;
    outcome: string;
  };
  cover: string;
  motion: {
    src: string;
    poster: string;
    label: string;
    caption: string;
  };
  loopTitle: string;
  loopTitleZh: string;
  loop: ProjectLoopStep[];
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
    status: "WORKING PROTOTYPE",
    stack: "PYTHON / TAURI / VUE / LIVE2D",
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
    motion: {
      src: "/work/joi/reel-joi.mp4",
      poster: "/reel/01-joi/still.avif",
      label: "REAL BUILD / THINKING → REPLY",
      caption: "A four-second loop cut from the working desktop build. The interface stays visible while Joi thinks and responds.",
    },
    loopTitle: "Presence needs a legible loop.",
    loopTitleZh: "在场感来自可理解的循环。",
    loop: [
      {
        index: "01",
        label: "OBSERVE",
        title: "Notice only what is in scope.",
        body: "Joi begins from the conversation and resources the person has deliberately placed inside the current project.",
      },
      {
        index: "02",
        label: "PROPOSE",
        title: "Turn intention into a small next step.",
        body: "The system explains what it wants to do before a tool action becomes an invisible side effect.",
      },
      {
        index: "03",
        label: "APPROVE",
        title: "Keep permission in the foreground.",
        body: "Reading, drafting, and sending are different boundaries. The person can stop the loop before control changes hands.",
      },
      {
        index: "04",
        label: "VERIFY",
        title: "Show what changed.",
        body: "The result returns as a visible report and trace, not as a vague claim that the task is finished.",
      },
    ],
    figures: [
      {
        src: "/work/joi/joi-reply.png",
        alt: "Working Joi desktop app with the Live2D character and a completed conversation reply",
        caption: "Working desktop build / Joi remains present beside the conversation",
      },
      {
        src: "/work/joi/joi-thinking.png",
        alt: "Working Joi desktop app while Joi is thinking",
        caption: "Thinking state / the system shows that work is still in progress",
      },
      {
        src: "/media/joi-live2d-preview.png",
        alt: "Joi Live2D working reference",
        caption: "Embodied interface study / Live2D working reference",
      },
      {
        src: "/assets/joi-app-v3.png",
        alt: "Joi character system showing front, side, back, expressions, and accessories",
        caption: "Identity system / character continuity across product states",
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
        heading: "Presence Is a System",
        headingZh: "在场不是一个表情",
        body: [
          "A character can make an assistant recognizable, but recognition alone does not create presence. Presence comes from continuity: the same project, the same conversation, a visible state, and a clear boundary around what Joi can currently touch.",
          "The Live2D body is therefore treated as part of the interface. Expression, attention, speech, and system state have to agree with the work happening beside it.",
        ],
        bodyZh: [
          "角色能让助手变得可辨认，但仅有角色并不会产生在场感。在场来自连续性：同一个项目、同一段对话、可见的状态，以及 Joi 当前能接触什么的明确边界。",
          "因此 Live2D 不是贴在产品上的装饰。表情、注意方向、说话状态与旁边真正发生的工作必须一致。",
        ],
      },
      {
        heading: "A Legible Agent",
        headingZh: "让智能体可以被读懂",
        body: [
          "The Python core separates planning, policy gates, memory, events, and tool adapters. The Tauri and Vue shell translates that machinery into conversation, project resources, approvals, character states, and a developer audit view.",
          "Computer Use actions preserve an observe, target, approve, act, and verify trail so automation remains inspectable instead of magical.",
        ],
        bodyZh: [
          "Python 核心把规划、策略网关、记忆、事件和工具适配器分开；Tauri 与 Vue 前端再把这些机制翻译为对话、项目资源、审批、角色状态与开发者审计视图。",
          "Computer Use 操作保留观察、定位、确认、执行和验证记录，让自动化保持可检查，而不是神秘地发生。",
        ],
      },
      {
        heading: "Consent Is a State",
        headingZh: "同意不是一次弹窗",
        body: [
          "Approval is designed as a durable product state rather than a modal that interrupts the person at the last second. Joi can explain the intended action, wait, continue after consent, and report the exact result.",
          "This makes autonomy graduated. Reading a selected thread, drafting locally, and sending something outward do not inherit the same permission.",
        ],
        bodyZh: [
          "审批被设计成一种持续的产品状态，而不是最后一刻突然打断用户的弹窗。Joi 可以先解释行动意图，等待确认，在获得同意后继续，并明确报告结果。",
          "因此自主性可以分级：读取被选中的内容、在本地起草、向外发送，不会自动继承同一种权限。",
        ],
      },
      {
        heading: "Memory With Boundaries",
        headingZh: "有边界的记忆",
        body: [
          "Projects make memory concrete. A conversation can bind folders, websites, applications, or games, while the rest of the machine remains outside the relationship by default.",
          "The goal is not to remember everything. It is to retain enough shared context to continue naturally without turning continuity into surveillance.",
        ],
        bodyZh: [
          "项目让记忆边界变得具体。一段对话可以绑定文件夹、网站、应用或游戏，而机器上的其它内容默认不进入这段关系。",
          "目标不是记住一切，而是保留足够的共同上下文，让协作可以自然继续，同时不把连续性变成监视。",
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
    status: "WORKING SWIFTUI MVP",
    stack: "SWIFTUI / MAPKIT / VISION / LOCAL FALLBACK",
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
    motion: {
      src: "/work/joi-map/reel-joi-map.mp4",
      poster: "/reel/02-joi-map/still.avif",
      label: "REAL BUILD / LOCATING → PLACE",
      caption: "The Simulator controls are cropped away; the loop uses only the running iOS product and its on-device place state.",
    },
    loopTitle: "A guide should continue across modes.",
    loopTitleZh: "导览不应被拆成一组 AI 按钮。",
    loop: [
      {
        index: "01",
        label: "LOCATE",
        title: "Begin with the place.",
        body: "Map state, walking context, and nearby candidates establish where the guide is standing with the person.",
      },
      {
        index: "02",
        label: "UNDERSTAND",
        title: "Make uncertainty visible.",
        body: "Recognition can stay local, show confidence, expose sources, and ask the person to correct what the system cannot confirm.",
      },
      {
        index: "03",
        label: "NARRATE",
        title: "Add context without replacing the place.",
        body: "Joi turns a result into a short explanation that can be heard while attention stays on the world outside the screen.",
      },
      {
        index: "04",
        label: "REMEMBER",
        title: "Let the route become a conversation.",
        body: "The next recommendation can use what has already been noticed instead of resetting at every map pin.",
      },
    ],
    figures: [
      {
        src: "/work/joi-map/joi-map-place.png",
        alt: "Joi Map working iOS interface showing the Contemporary Jewish Museum place guide",
        caption: "Place guide / confidence, sources, correction, narration, and nearby picks",
      },
      {
        src: "/work/joi-map/joi-map-locating.png",
        alt: "Joi Map working iOS interface in local locating mode",
        caption: "Local locating state / the app remains useful while the backend is offline",
      },
      {
        src: "/assets/joi-map-v3.png",
        alt: "Joi Map character system with a map, camera, bag, and location details",
        caption: "Field identity / the same personality prepared for the outside world",
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
        heading: "A Continuous Field Loop",
        headingZh: "连续的现场循环",
        body: [
          "The interaction is designed as one loop rather than a collection of AI buttons: locate, understand, narrate, recommend, remember, and continue the conversation.",
          "The map, place card, audio player, nearby list, sources, correction tools, and follow-up questions all belong to the same place state rather than separate feature demos.",
        ],
        bodyZh: [
          "交互不是一组 AI 按钮，而是一个连续循环：定位、理解、讲解、推荐、记住，并继续对话。",
          "地图、地点卡、音频播放器、附近列表、信源、纠错与追问共同属于同一个地点状态，而不是彼此割裂的功能演示。",
        ],
      },
      {
        heading: "Local Before Certain",
        headingZh: "先在本地工作，再谈确定",
        body: [
          "The MVP can enter a local mode when backend services are unavailable. On-device suggestions remain useful, but the interface names uncertainty instead of presenting every result as fact.",
          "The place view exposes confidence, source access, and correction together. Verification is part of the guide loop, not a settings task hidden somewhere else.",
        ],
        bodyZh: [
          "当后端服务不可用时，MVP 可以进入本地模式。设备端建议仍然可用，但界面会明确表达不确定性，而不是把每个结果都包装成事实。",
          "地点页把置信度、信源入口和纠错放在一起。核验属于导览循环本身，而不是藏在设置里的额外任务。",
        ],
      },
      {
        heading: "Language and Pace",
        headingZh: "语言与行走节奏",
        body: [
          "Manual language switching currently supports Simplified Chinese, Traditional Chinese, English, Japanese, and Korean. Narration is designed to be short enough to accompany walking rather than demand full-screen attention.",
          "The deeper opportunity is pace: what Joi says next should depend on whether the person is approaching, pausing, asking a follow-up, or choosing to move on.",
        ],
        bodyZh: [
          "应用目前支持简中、繁中、英语、日语和韩语手动切换。讲解被控制在适合行走时聆听的长度，而不是要求用户一直盯着屏幕。",
          "更深的机会在于节奏：Joi 下一句说什么，应该取决于人正在靠近、停留、追问，还是决定继续前行。",
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
