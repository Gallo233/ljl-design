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
  experience?: {
    href: string;
    eyebrow: string;
    title: string;
    body: string;
    bodyZh: string;
    action: string;
  };
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
    nextSlug: "joi-mobile",
    nextTitle: "JOI MOBILE — WITH YOU",
  },
  {
    slug: "joi-mobile",
    index: "02",
    title: "JOI MOBILE — WITH YOU",
    date: "JULY — AUGUST 2026",
    kind: "NATIVE CHARACTER COMPANION",
    tagline: "The same relationship, carried with you.",
    role: "PRODUCT / DESIGN / SWIFTUI",
    repo: "https://github.com/Gallo233/Joi-Mobile",
    status: "WORKING NATIVE PROTOTYPE",
    stack: "SWIFTUI / LIVE2D / VRM / LOCAL MEMORY",
    summary:
      "Joi Mobile brings the companion relationship to iPhone: a native character stage, conversation, user-confirmed memory, and a local library for characters the person already owns.",
    summaryZh:
      "Joi Mobile 把陪伴关系带到 iPhone：原生角色舞台、持续对话、由用户确认的记忆，以及存放用户自有角色文件的本地角色库。",
    question: "How can the same companion move to a phone without turning character files and memory into somebody else's cloud account?",
    caseFrame: {
      decision:
        "Design the phone around a character-first stage, local character ownership, and memory that only becomes durable after explicit confirmation.",
      outcome:
        "A working SwiftUI prototype with full- and half-body stages, conversation controls, a consented memory flow, and local character import.",
    },
    cover: "/work/joi-mobile/chat-stage.png",
    motion: {
      src: "/work/joi-mobile/reel-joi-mobile.mp4",
      poster: "/reel/02-joi-mobile/still.avif",
      label: "JOI MOBILE / GENERATED PRODUCT FILM",
      caption: "The restored Joi Mobile product film moves through conversation, character, place, and explicit memory states.",
    },
    loopTitle: "A companion should survive the change of screen.",
    loopTitleZh: "换了一块屏幕，关系也不该重置。",
    loop: [
      {
        index: "01",
        label: "ARRIVE",
        title: "Begin with the character, not a dashboard.",
        body: "The app opens on a native stage where presence, conversation, and the current character remain one continuous surface.",
      },
      {
        index: "02",
        label: "TALK",
        title: "Keep conversation close to the body.",
        body: "Text, push-to-talk, session controls, and full- or half-body presentation stay reachable without covering the character.",
      },
      {
        index: "03",
        label: "REMEMBER",
        title: "Make durable memory a choice.",
        body: "A proposed memory becomes persistent only after the person reviews and confirms it; an empty state remains honest when nothing is saved.",
      },
      {
        index: "04",
        label: "BRING",
        title: "Let people bring characters they own.",
        body: "The local library accepts Joi character packages, VRM files, and Live2D ZIP archives without presenting upload as the default path.",
      },
    ],
    figures: [
      {
        src: "/work/joi-mobile/chat-stage.png",
        alt: "Current Joi Mobile conversation stage in the iOS Simulator",
        caption: "Current native build / conversation, session, memory, and library remain on one stage",
      },
      {
        src: "/work/joi-mobile/half-body-stage.png",
        alt: "Joi Mobile half-body character presentation in the current iOS build",
        caption: "Presentation state / the stage can move between full- and half-body framing",
      },
      {
        src: "/work/joi-mobile/memory-empty.png",
        alt: "Joi Mobile memory screen showing an honest empty state",
        caption: "Memory boundary / nothing is implied to be saved before confirmation",
      },
      {
        src: "/work/joi-mobile/character-library.png",
        alt: "Joi Mobile local character library accepting character package, VRM, and Live2D ZIP files",
        caption: "Local character library / the test character shown is a third-party sample, not original Joi character art",
      },
    ],
    sections: [
      {
        heading: "Companion, Not Mini Desktop",
        headingZh: "不是桌面版的缩小",
        body: [
          "Joi Mobile does not copy the Windows shell onto a narrow screen. It starts from the moment that matters on a phone: opening the app and finding the same character already there.",
          "Conversation, character presentation, memory, and the library stay close enough to feel like one relationship instead of four product tabs.",
        ],
        bodyZh: [
          "Joi Mobile 不是把 Windows 外壳缩小塞进手机，而是从手机上最重要的时刻出发：打开应用时，同一个角色已经在那里。",
          "对话、角色呈现、记忆与角色库彼此保持靠近，让它们像同一段关系，而不是四个相互割裂的功能标签。",
        ],
      },
      {
        heading: "The Character Stays Yours",
        headingZh: "角色仍然属于用户",
        body: [
          "The current library is built around local import. Joi character packages, VRM files, and Live2D ZIP archives can enter the app from files the person controls.",
          "This is an ownership decision before it is a format decision: a character should not become inaccessible just because an account, marketplace, or server changes.",
        ],
        bodyZh: [
          "当前角色库围绕本地导入设计，用户可以从自己控制的文件中导入 Joi 角色包、VRM 与 Live2D ZIP。",
          "这首先是所有权选择，其次才是格式选择：角色不应该因为账号、市场或服务器变化而突然失去访问权。",
        ],
      },
      {
        heading: "Memory By Consent",
        headingZh: "经确认才成为记忆",
        body: [
          "Continuity on a phone can easily become surveillance by convenience. The prototype instead treats durable memory as a proposal the person can inspect, accept, or leave empty.",
          "The empty state is a product state, not missing content. It makes the boundary visible before the system asks to cross it.",
        ],
        bodyZh: [
          "手机上的连续性很容易以便利之名滑向监视。当前原型把长期记忆视为一项提议：用户可以检查、确认，也可以让它保持为空。",
          "空状态不是缺失内容，而是一种正式的产品状态；系统在请求跨越边界之前，先让边界可见。",
        ],
      },
      {
        heading: "What Is Real Now",
        headingZh: "当前真实完成的部分",
        body: [
          "The portfolio now shows the current SwiftUI build: native conversation stage, full- and half-body framing, session controls, memory empty state, and local character library.",
          "The character used during testing is a third-party sample. It validates rendering and interaction, but is not presented as original Joi artwork.",
        ],
        bodyZh: [
          "作品集现在展示的是当前 SwiftUI 版本：原生对话舞台、全身与半身构图、会话控制、记忆空状态以及本地角色库。",
          "测试中使用的角色是第三方样例，用于验证渲染和交互，不会被表述为 Joi 的原创角色资产。",
        ],
      },
      {
        heading: "Where It Goes",
        headingZh: "下一步",
        body: [
          "The next milestone is a reliable daily loop across character import, conversation, explicit memory review, and handoff between desktop and phone—without reviving the retired Joi Map product.",
        ],
        bodyZh: [
          "下一阶段是把角色导入、对话、明确的记忆复核，以及桌面与手机之间的连续体验做成可靠的日常循环，而不是重新启用已经废止的 Joi Map。",
        ],
      },
    ],
    nextSlug: "joi",
    nextTitle: "JOI — PRESENCE",
  },
];

export function getProject(slug: string) {
  const canonicalSlug = slug === "joi-map" ? "joi-mobile" : slug;
  return projects.find((project) => project.slug === canonicalSlug);
}
