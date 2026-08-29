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
    nextTitle: "GAME CENTER — 游戏厅",
    nextHref: "/play/night-tide",
  },
];

export function getProject(slug: string) {
  const canonicalSlug = slug === "joi-map" ? "joi-mobile" : slug;
  return projects.find((project) => project.slug === canonicalSlug);
}
