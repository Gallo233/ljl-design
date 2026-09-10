import { LAB_ITEMS } from "../lab/labData";
import { projects as workCases } from "../../components/projectData";
import { projects as reelFrames } from "./reelProjects";
import { ROOM_OBJECTS } from "./roomObjects";

/**
 * What the machine on the desk knows.
 *
 * Modelled on pinchen.me's own terminal (see `docs/pinchen-room-research/
 * room-miniapps-2026-08.md`): `help / about / projects / socials / echo / history /
 * welcome / clear`, `<list> go <n>` to open an entry, Tab completion, arrow-key history.
 *
 * Two departures from the reference, both deliberate:
 *
 * **It is DOM, not a texture on the screen mesh.** The reference paints its terminal onto
 * a `CanvasTexture` and puts it on the laptop. Ours cannot: AGENTS.md records that this
 * site's typography deliberately stays in DOM above the canvas, because everything drawn
 * into the stage goes through `postfx`'s lens distortion and chromatic aberration — which
 * is a look for a picture and a legibility problem for eight-point monospace. It also
 * leaves the film that docks onto the laptop at the end of the reel exactly where it is:
 * the negative is still on that screen, and the terminal opens in front of it.
 *
 * **There is no `education`.** The reference has one; we do not have the data, and this
 * file's whole rule is that every line below is already somewhere else in this repo —
 * `reelProjects.ts`, `projectData.ts`, `labData.ts`, `roomObjects.ts`, the contact panel.
 * Nothing here is written for the terminal, so nothing here can be invented for it.
 */

export type TerminalTone = "normal" | "dim" | "accent" | "error";
export type TerminalLine = { text: string; tone?: TerminalTone };

export type TerminalContext = {
  /** A route, a section of this page, or an external address. The shell decides which. */
  open: (href: string) => void;
  close: () => void;
  clear: () => void;
  history: readonly string[];
  /**
   * The language the shell is showing. `whoami` used to print each line in English and
   * then repeat it dimmed in Chinese; with a switch in the header that is two answers to
   * one question, so the commands pick a side now.
   */
  locale: "zh" | "en";
};

export type TerminalCommand = {
  name: string;
  /** Shown after the name in `help`. */
  usage?: string;
  blurb: string;
  blurbZh: string;
  run: (argv: string[], context: TerminalContext) => TerminalLine[];
};

const line = (text: string, tone?: TerminalTone): TerminalLine => ({ text, tone });
const blank = () => line("");
const dim = (text: string) => line(text, "dim");
const accent = (text: string) => line(text, "accent");
const error = (text: string) => line(text, "error");

/**
 * The name, set rather than drawn.
 *
 * This started as figlet-style ASCII art, the way the reference's terminal opens, and it
 * was tried twice before being given up on. Sloped letterforms need the face's `/`, `\`
 * and `_` to meet exactly and IBM Plex Mono's do not — they came out as four rows of
 * punctuation. Block letters on a `#` grid do not close either: `#` inks about half its
 * advance, so at any size the wordmark reads as a halftone rather than as letters, and
 * the character that would fix it, `█`, is outside the `latin` subset `app/fonts.ts`
 * loads — it would fall back to another face and take its advance width with it.
 *
 * So the machine announces itself in the register the rest of this site uses for exactly
 * this: letterspaced caps over a rule. Legible at 12px, and no font can break it.
 */
const BANNER_NAME = "  G A L L O   L I U";
const BANNER_RULE = "  " + "=".repeat(BANNER_NAME.trim().length);

/** The three lists `go` can open, so completion and `go` share one definition. */
const LISTS = {
  projects: () =>
    reelFrames.map((frame) => ({
      label: `${frame.title} — ${frame.subtitle}`,
      href: frame.href as string,
    })),
  lab: () =>
    LAB_ITEMS.filter((item) => item.enabled).map((item) => ({
      label: `${item.title} — ${item.status} · ${item.year}`,
      href: `/lab#${item.id}`,
    })),
  socials: () => [
    { label: "GitHub — github.com/Gallo233", href: "https://github.com/Gallo233" },
    { label: "Email — 18520455682@163.com", href: "mailto:18520455682@163.com" },
  ],
} as const;

type ListId = keyof typeof LISTS;

/** `projects` / `lab` / `socials` all print and open the same way. */
function listCommand(id: ListId, blurb: string, blurbZh: string): TerminalCommand {
  return {
    name: id,
    usage: "[go <n>]",
    blurb,
    blurbZh,
    run: (argv, context) => {
      const entries = LISTS[id]();
      if (argv[0] === "go") {
        const index = Number(argv[1]);
        const entry = Number.isInteger(index) ? entries[index - 1] : undefined;
        if (!entry) {
          return [error(`  ${id} go: no entry ${argv[1] ?? ""} — try 1..${entries.length}`)];
        }
        context.open(entry.href);
        return [dim(`  opening ${entry.label}`)];
      }
      if (argv.length > 0) {
        return [error(`  ${id}: unknown argument "${argv[0]}" — try "${id} go <n>"`)];
      }
      return [
        blank(),
        ...entries.map((entry, index) => line(`  ${String(index + 1).padStart(2, "0")}  ${entry.label}`)),
        blank(),
        dim(`  ${id} go <n> to open`),
        blank(),
      ];
    },
  };
}

/**
 * The command table.
 *
 * Order is the order `help` prints them in, which is roughly the order a reader would
 * want them: who, what, where, then the machine's own controls.
 */
export const TERMINAL_COMMANDS: TerminalCommand[] = [
  {
    name: "help",
    blurb: "this list", blurbZh: "就是这张表",
    run: (_argv, context) => [
      blank(),
      ...TERMINAL_COMMANDS.map((command) =>
        line(
          `  ${`${command.name} ${command.usage ?? ""}`.trim().padEnd(18)}` +
            (context.locale === "zh" ? command.blurbZh : command.blurb),
        ),
      ),
      blank(),
      dim("  tab completes · ↑ ↓ recalls · ctrl+l clears · esc closes"),
      blank(),
    ],
  },
  {
    name: "about",
    blurb: "who is at this desk", blurbZh: "这张桌子后面是谁",
    run: (_argv, context) => [
      blank(),
      // The name the site uses on the badge, the call sheet and the reel's slate.
      // Nothing here is written for the terminal — a Chinese name is not in this repo,
      // so the terminal does not have one either.
      accent("  GALLO LIU"),
      line("  AI PRODUCT · PRODUCT DESIGN"),
      line("  GUANGZHOU · 23.13°N 113.26°E · GMT+8"),
      blank(),
      ...(context.locale === "zh"
        ? [
            line("  我做的是 AI 怎么进入人的生活这件事。"),
            blank(),
            line("  在找 AI 产品 / 产品设计的机会，"),
            line("  也接有意思的项目。"),
          ]
        : [
            line("  I design how AI enters human life."),
            blank(),
            line("  Looking for AI product / product design work,"),
            line("  and open to projects worth making."),
          ]),
      blank(),
      dim("  projects · lab · socials · room"),
      blank(),
    ],
  },
  listCommand("projects", "the six frames of the reel", "胶片上的六格"),
  listCommand("lab", "research and retired prototypes", "研究与退役的原型"),
  {
    name: "code",
    blurb: "the repositories behind the work", blurbZh: "作品背后的代码仓库",
    run: () => [
      blank(),
      ...workCases.flatMap((project) => [
        line(`  ${project.index}  ${project.title}`),
        dim(`      ${project.repo}`),
      ]),
      blank(),
      dim("  socials go 1 for the rest"),
      blank(),
    ],
  },
  listCommand("socials", "where else to find him", "还能在哪找到他"),
  {
    name: "room",
    blurb: "what is in this room", blurbZh: "这个房间里有什么",
    run: () => [
      blank(),
      // The English label leads because it is the half that pads exactly. `padEnd` counts
      // characters, and CJK takes two monospace columns per character — padding the
      // Chinese half instead is what put this list's second column in five places.
      ...ROOM_OBJECTS.map((object) => line(`  ${object.label.padEnd(24)}${object.labelZh}`)),
      blank(),
      dim("  close this and click any of them"),
      blank(),
    ],
  },
  {
    name: "echo",
    usage: "<text>",
    blurb: "say it back", blurbZh: "原样说回来",
    run: (argv) => [line(`  ${argv.join(" ")}`)],
  },
  {
    name: "history",
    blurb: "what has been typed", blurbZh: "刚才输入过什么",
    run: (_argv, context) =>
      context.history.length === 0
        ? [dim("  nothing yet")]
        : context.history.map((entry, index) => line(`  ${String(index + 1).padStart(3, " ")}  ${entry}`)),
  },
  {
    name: "welcome",
    blurb: "print the banner again", blurbZh: "再打印一次开场",
    run: (_argv, context) => welcomeLines(context.locale),
  },
  {
    name: "clear",
    blurb: "empty the screen", blurbZh: "清空屏幕",
    run: (_argv, context) => {
      context.clear();
      return [];
    },
  },
  {
    name: "exit",
    blurb: "back to the room", blurbZh: "回到房间",
    run: (_argv, context) => {
      context.close();
      return [];
    },
  },
];

export const COMMAND_NAMES = TERMINAL_COMMANDS.map((command) => command.name);

export function welcomeLines(locale: "zh" | "en"): TerminalLine[] {
  return [
    blank(),
    accent(BANNER_NAME),
    dim(BANNER_RULE),
    line(locale === "zh" ? "  JOI9000 / R2 · 桌面终端" : "  JOI9000 / R2 · desk terminal"),
    blank(),
    dim(
      locale === "zh"
        ? "  输入 `help` —— 赶时间就直接 `about`"
        : "  type `help` — or `about` if you are in a hurry",
    ),
    blank(),
  ];
}

/**
 * Run one line of input.
 *
 * Unknown commands answer with the nearest name rather than only refusing, because the
 * command set is small enough that a typo is nearly always one of these nine.
 */
export function runCommand(input: string, context: TerminalContext): TerminalLine[] {
  const [name, ...argv] = input.trim().split(/\s+/);
  if (!name) return [];
  const command = TERMINAL_COMMANDS.find((entry) => entry.name === name.toLowerCase());
  if (command) return command.run(argv, context);
  const near = COMMAND_NAMES.find((entry) => entry.startsWith(name.slice(0, 2).toLowerCase()));
  return [
    error(`  command not found: ${name}`),
    dim(near ? `  did you mean \`${near}\`? — \`help\` lists them all` : "  `help` lists them all"),
  ];
}

/** Tab completion: command names first, then `go` for the three lists. */
export function completeInput(input: string): string | null {
  const trimmed = input.replace(/^\s+/, "");
  if (!trimmed.includes(" ")) {
    const matches = COMMAND_NAMES.filter((name) => name.startsWith(trimmed.toLowerCase()));
    return matches.length === 1 ? matches[0] : null;
  }
  const [name, ...rest] = trimmed.split(/\s+/);
  if (!(name in LISTS) || rest.length !== 1) return null;
  return "go".startsWith(rest[0].toLowerCase()) ? `${name} go ` : null;
}
