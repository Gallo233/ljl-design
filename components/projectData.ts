/**
 * Case-study content model.
 *
 * Every content field is optional, so a half-written entry renders as far as it
 * has been written instead of crashing or printing `undefined`. The detail page
 * (`app/work/[slug]/page.tsx`) skips any block whose data is absent.
 *
 * Asset rule: every `src` below points at a file that exists in `public/` today.
 * Joi Mobile ships without figures until real iOS screenshots land — the wanted
 * shots are listed in `docs/asset-requests.md`. Do not stand in Joi Map imagery:
 * that is a retired, different product.
 *
 * `/work/joi` additionally hosts the live Joi session (`components/JoiWebEmbed.tsx`).
 */

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
  /** Identity. */
  slug: string;
  index: string;
  title: string;

  /** Content. */
  date?: string;
  kind?: string;
  /** Optional line shown under the title on the detail page. */
  tagline?: string;
  role?: string;
  repo?: string;
  status?: string;
  stack?: string;
  /** ISO date of the last content edit — feeds the metadata card. */
  updated?: string;
  summary?: string;
  summaryZh?: string;
  question?: string;
  caseFrame?: {
    decision: string;
    outcome: string;
  };
  cover?: string;
  motion?: {
    src: string;
    poster: string;
    label: string;
    caption: string;
  };
  interactiveShowcase?: {
    kind: "joi-mobile-native";
    poster: string;
    label: string;
    caption: string;
  };
  loopTitle?: string;
  loopTitleZh?: string;
  loop?: ProjectLoopStep[];
  figures?: ProjectFigure[];
  sections?: ProjectSection[];
  experience?: {
    href: string;
    eyebrow: string;
    title: string;
    body: string;
    bodyZh: string;
    action: string;
  };
  nextSlug?: string;
  nextTitle?: string;
  /** When the next stop is not a /work/[slug] page (e.g. the Game Center). */
  nextHref?: string;
};

// COPY-REVIEW: 所有文案为重写初稿，等作者过目后再定稿。

export const projects: ProjectCase[] = [
  {
    slug: "joi",
    index: "01",
    title: "JOI — PRESENCE",
    date: "MAY 2026 — ONGOING",
    kind: "WINDOWS-FIRST AI COMPANION",
    tagline: "A machine learning how to live with you.",
    role: "PRODUCT / DESIGN / ENGINEERING",
    repo: "https://github.com/Gallo233/Joi",
    status: "WORKING PROTOTYPE",
    stack: "PYTHON / TAURI / VUE / LIVE2D",
    updated: "2026-08-24",
    summary:
      "Joi asks what changes when an assistant stops disappearing between requests: it keeps context, shows intention before acting, and stays interruptible while it works inside your computer.",
    summaryZh:
      "Joi 想回答的问题是：当助手不再在两次请求之间消失，会发生什么——它保留上下文、行动前先表达意图、在你的电脑里工作时始终可以被打断。",
    question:
      "How can an agent feel present without taking control away from the person beside it?",
    caseFrame: {
      decision:
        "Split the system into planning, policy, memory, events, and tools — then surface every action as an inspectable, interruptible state instead of an invisible side effect.",
      outcome:
        "A working Windows companion with approvals, character states, bounded memory, and an observe → propose → approve → verify trail for everything it touches.",
    },
    cover: "/work/joi/joi-reply.png",
    motion: {
      src: "/work/joi/reel-joi.mp4",
      poster: "/reel/01-joi/still.avif",
      label: "REAL BUILD / THINKING → REPLY",
      caption:
        "A short loop cut from the working desktop build — the interface stays visible while Joi thinks and answers.",
    },
    loopTitle: "Presence needs a legible loop.",
    loopTitleZh: "在场感来自可理解的循环。",
    loop: [
      {
        index: "01",
        label: "OBSERVE",
        title: "Notice only what is in scope.",
        body: "Joi starts from the conversation and the resources the person has deliberately placed inside the current project — nothing else on the machine is hers to read.",
      },
      {
        index: "02",
        label: "PROPOSE",
        title: "Turn intention into a small next step.",
        body: "Before a tool runs, the system says what it wants to do. An action that cannot be explained does not get to happen.",
      },
      {
        index: "03",
        label: "APPROVE",
        title: "Keep permission in the foreground.",
        body: "Reading, drafting, and sending are different boundaries. Consent is a product state the person can sit in, not a modal that ambushes them.",
      },
      {
        index: "04",
        label: "VERIFY",
        title: "Show what changed.",
        body: "The result comes back as a visible report and trace — not a vague claim that the task is done.",
      },
    ],
    figures: [
      {
        src: "/work/joi/joi-reply.png",
        alt: "Working Joi desktop app with the Live2D character beside a finished reply",
        caption: "Working desktop build / Joi stays present beside the conversation",
      },
      {
        src: "/work/joi/joi-thinking.png",
        alt: "Working Joi desktop app while Joi is thinking",
        caption: "Thinking state / the system shows that work is still in progress",
      },
      {
        src: "/media/joi-live2d-preview.png",
        alt: "Joi Live2D rig in the working reference viewer",
        caption: "Embodied interface study / the Live2D body is part of the interface, not a sticker on it",
      },
      {
        src: "/assets/joi-app-v3.png",
        alt: "Joi character sheet: front, side, back, expressions, and accessories",
        caption: "Identity system / one character held consistent across every product state",
      },
    ],
    sections: [
      {
        heading: "The Question",
        headingZh: "问题",
        body: [
          "Most assistants are amnesiac by design: each request starts from nothing, and each answer ends the relationship. Joi begins from the opposite premise — a companion that is useful precisely because it remembers context, declares intention, and can be stopped mid-motion.",
          "The character is not decoration. She is the visible edge of a system built from planning, memory, policy, tools, and review.",
        ],
        bodyZh: [
          "大多数助手在设计上就是健忘的：每次请求从零开始，每个回答结束一段关系。Joi 从相反的前提出发——一个伴侣之所以有用，恰恰因为它记得上下文、会宣告意图、并且可以在动作进行到一半时被叫停。",
          "角色不是装饰。她是由规划、记忆、策略、工具与复核共同构成的系统的可见边缘。",
        ],
      },
      {
        heading: "Presence Is a System",
        headingZh: "在场不是一个表情",
        body: [
          "A face makes an assistant recognizable; it does not make it present. Presence comes from continuity — the same project, the same conversation, a visible working state, and a clear boundary around what Joi can currently touch.",
          "So the Live2D body is treated as interface. Expression, attention, speech, and system state have to agree with the work actually happening beside her.",
        ],
        bodyZh: [
          "一张脸能让助手被认出来，但不能让它「在场」。在场来自连续性——同一个项目、同一段对话、可见的工作状态，以及 Joi 此刻能触碰什么的清晰边界。",
          "所以 Live2D 的身体被当作界面来做：表情、注意方向、说话状态，必须与她身旁真实发生的工作一致。",
        ],
      },
      {
        heading: "A Legible Agent",
        headingZh: "让智能体可以被读懂",
        body: [
          "The Python core separates planning, policy gates, memory, events, and tool adapters; the Tauri + Vue shell translates that machinery into conversation, project resources, approvals, character states, and an audit view.",
          "Computer-use actions keep an observe → target → approve → act → verify trail, so automation stays inspectable instead of magical.",
        ],
        bodyZh: [
          "Python 核心把规划、策略网关、记忆、事件与工具适配器分开；Tauri + Vue 外壳再把这套机制翻译成对话、项目资源、审批、角色状态与审计视图。",
          "Computer Use 操作保留「观察 → 定位 → 确认 → 执行 → 验证」的完整记录，让自动化保持可检查，而不是神秘地发生。",
        ],
      },
      {
        heading: "Consent Is a State",
        headingZh: "同意不是一次弹窗",
        body: [
          "Approval is a durable product state, not a last-second interruption. Joi can explain the intended action, wait, continue after consent, and report exactly what happened.",
          "That makes autonomy graduated: reading a selected thread, drafting locally, and sending something outward never inherit the same permission.",
        ],
        bodyZh: [
          "审批是一种持续的产品状态，而不是最后一刻的打断。Joi 可以先解释打算做什么，等待，获得同意后继续，然后精确报告发生了什么。",
          "自主性因此可以分级：读取选中的内容、在本地起草、向外发送，永远不会自动继承同一种权限。",
        ],
      },
      {
        heading: "Memory With Boundaries",
        headingZh: "有边界的记忆",
        body: [
          "Projects make memory concrete: a conversation can bind folders, sites, apps, or games, while the rest of the machine stays outside the relationship by default.",
          "The goal is not to remember everything — it is to keep enough shared context to continue naturally, without letting continuity turn into surveillance.",
        ],
        bodyZh: [
          "「项目」让记忆边界变得具体：一段对话可以绑定文件夹、网站、应用或游戏，而机器上的其余部分默认留在这段关系之外。",
          "目标不是记住一切，而是保留足够的共同上下文让协作自然延续——同时不让连续性滑向监视。",
        ],
      },
      {
        heading: "Where It Goes",
        headingZh: "下一步",
        body: [
          "The next milestone is not maximum autonomy. It is a convincing shared loop: Joi notices a context, proposes a small step, waits for consent, acts, and checks what changed.",
        ],
        bodyZh: [
          "下一个里程碑不是自主性的最大化，而是一个可信的共同循环：Joi 注意到上下文，提出一小步，等待同意，执行，然后检查发生了什么变化。",
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
    date: "JULY 2026 — ONGOING",
    kind: "NATIVE CHARACTER COMPANION FOR IPHONE",
    tagline: "The same relationship, carried with you.",
    role: "PRODUCT / DESIGN / SWIFTUI",
    repo: "https://github.com/Gallo233/Joi-Mobile",
    status: "WORKING NATIVE PROTOTYPE",
    stack: "SWIFTUI / LIVE2D / VRM / MAPKIT / LOCAL MEMORY",
    updated: "2026-08-26",
    summary:
      "Joi Mobile carries the companion to iPhone as two native surfaces that share context: Chat keeps the character, conversation, and confirmed memory together; Map turns a place request into search, route context, and a walk Joi can remember with permission.",
    summaryZh:
      "Joi Mobile 把陪伴关系带到 iPhone，并收束为两个共享上下文的原生界面：Chat 把角色、对话和经确认的记忆放在一起；Map 把地点请求转成搜索、路线语境，以及一段经许可后可以被 Joi 记住的同行。",
    question:
      "How can one companion move between conversation and the physical world without turning character files, memory, and location into somebody else's cloud account?",
    caseFrame: {
      decision:
        "Give Chat and Map one shared journey context, while keeping character ownership local and making durable memory an explicit user decision.",
      outcome:
        "A working SwiftUI prototype with a native character stage, text and transcript flows, confirmed memory, preloaded character switching, Map search, saved walks, and cached route playback.",
    },
    interactiveShowcase: {
      kind: "joi-mobile-native",
      poster: "/work/joi-mobile-home-screen.webp",
      label: "PROCEDURAL DEVICE / NATIVE DEMO LINK",
      caption:
        "A code-built iPhone 17 Pro carries a Home Screen captured directly from the iOS Simulator. Turn the object, then tap its screen to open the uploaded Joi Mobile SwiftUI build in a dedicated native session.",
    },
    loopTitle: "A companion should survive the change of screen.",
    loopTitleZh: "换一块屏幕，关系不该重置。",
    loop: [
      {
        index: "01",
        label: "ARRIVE",
        title: "Open on the character, not a dashboard.",
        body: "The app starts on a native stage where presence, conversation, and the current character are one continuous surface.",
      },
      {
        index: "02",
        label: "TALK",
        title: "Keep conversation close to the body.",
        body: "Text, transcript, memory proposals, session controls, and full- or half-body framing stay reachable without covering the character.",
      },
      {
        index: "03",
        label: "REMEMBER",
        title: "Make durable memory a choice.",
        body: "A proposed memory persists only after the person reviews and confirms it. When nothing is saved, the empty state says so honestly.",
      },
      {
        index: "04",
        label: "GO",
        title: "Carry the conversation into a place.",
        body: "A request can move from Chat into Map search, a saved walk, or a cached route — then return with the journey context intact.",
      },
    ],
    sections: [
      {
        heading: "Companion, Not Mini Desktop",
        headingZh: "不是桌面版的缩小",
        body: [
          "Joi Mobile does not squeeze the Windows shell onto a narrow screen. It starts from the moment that matters on a phone: opening the app and finding the same character already there.",
          "Conversation, presentation, memory, and the library sit close enough to feel like one relationship, not four tabs.",
        ],
        bodyZh: [
          "Joi Mobile 不是把 Windows 外壳塞进窄屏幕，而是从手机上最重要的时刻出发：打开应用，同一个角色已经在那里。",
          "对话、呈现、记忆与角色库彼此靠近，让它们像同一段关系，而不是四个标签页。",
        ],
      },
      {
        heading: "The Character Stays Yours",
        headingZh: "角色仍然属于用户",
        body: [
          "The library is built around local import: Joi character packages, VRM files, and Live2D archives enter from files the person controls.",
          "That is an ownership decision before it is a format decision — a character should not vanish because an account, marketplace, or server changed.",
        ],
        bodyZh: [
          "角色库围绕本地导入设计：Joi 角色包、VRM、Live2D 压缩包，都来自用户自己掌控的文件。",
          "这首先是所有权的选择，其次才是格式的选择——角色不应该因为某个账号、市场或服务器的变动而消失。",
        ],
      },
      {
        heading: "Chat And Map Share One Journey",
        headingZh: "Chat 与 Map 共享同一段旅程",
        body: [
          "Map is no longer a separate Joi Map product. That standalone direction was retired; its useful travel capability was rebuilt inside Joi Mobile as a second native surface beside Chat.",
          "A place request can become search results, a selected destination, a saved walk, or an offline cached route. The handoff keeps a small, explicit journey context rather than creating a second assistant with a second memory.",
        ],
        bodyZh: [
          "Map 不再是独立的 Joi Map 产品。那条单独的产品路线已经停止，其中真正有价值的旅行能力被重新做进 Joi Mobile，成为与 Chat 并列的第二个原生界面。",
          "一个地点请求可以继续变成搜索结果、选中的目的地、收藏的散步路线，或离线缓存的路径。交接保留一份精简而明确的旅程上下文，而不是再创造一个拥有另一套记忆的助手。",
        ],
      },
      {
        heading: "Memory By Consent",
        headingZh: "经确认才成为记忆",
        body: [
          "On a phone, continuity slides into surveillance by convenience. The prototype treats durable memory as a proposal the person can inspect, accept, or leave empty.",
          "The empty state is a real product state, not missing content — the boundary is visible before the system asks to cross it.",
        ],
        bodyZh: [
          "在手机上，连续性很容易以便利之名滑向监视。这个原型把长期记忆当作一项提议：可以检查、可以确认、也可以让它保持为空。",
          "空状态是正式的产品状态，不是内容缺失——在系统请求越过边界之前，边界先被看见。",
        ],
      },
      {
        heading: "Where It Goes",
        headingZh: "下一步",
        body: [
          "The next milestone is a reliable daily loop across character switching, conversation, explicit memory review, Map search, and a clean handoff between desktop and phone.",
        ],
        bodyZh: [
          "下一步是把角色切换、对话、明确的记忆复核、Map 搜索，以及桌面与手机之间的顺畅交接，做成可靠的日常循环。",
        ],
      },
    ],
    nextTitle: "GAME CENTER — 游戏厅",
    nextHref: "/play/night-tide",
  },
];

export function getProject(slug: string) {
  const canonicalSlug = slug === "joi-map" ? "joi-mobile" : slug;
  return projects.find((project) => project.slug === canonicalSlug);
}
