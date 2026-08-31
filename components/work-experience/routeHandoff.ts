const HANDOFF_ID = "work-route-handoff";
const ARRIVAL_KEY = "work:arrive";

type HandoffPalette = {
  ink: string;
  accent: string;
  page: string;
  text: string;
  signal: string;
};

type StartHandoffOptions = {
  kind: "next" | "reel";
  source: DOMRect;
  title: string;
  label: string;
  destination: string;
  palette: HandoffPalette;
};

type StoredArrival = {
  destination: string;
  title: string;
};

const wait = (duration: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, duration);
});

const rectFrame = (rect: Pick<DOMRect, "left" | "top" | "width" | "height">) => ({
  left: `${rect.left}px`,
  top: `${rect.top}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
});

function removeExistingHandoff() {
  document.getElementById(HANDOFF_ID)?.remove();
}

function makeOverlay(options: StartHandoffOptions) {
  removeExistingHandoff();

  const overlay = document.createElement("div");
  overlay.id = HANDOFF_ID;
  overlay.dataset.kind = options.kind;
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483646",
    overflow: "hidden",
    pointerEvents: "all",
  });

  const backdrop = document.createElement("div");
  backdrop.dataset.handoffBackdrop = "true";
  Object.assign(backdrop.style, {
    position: "absolute",
    inset: "0",
    background: options.kind === "reel" ? "#fff6e8" : options.palette.page,
    opacity: "0",
  });

  const card = document.createElement("div");
  card.dataset.handoffCard = "true";
  Object.assign(card.style, {
    position: "absolute",
    ...rectFrame(options.source),
    display: "grid",
    gridTemplateRows: "auto 1fr",
    alignContent: "center",
    gap: "20px",
    overflow: "hidden",
    padding: "clamp(28px, 4vw, 58px)",
    borderRadius: "30px",
    background: `linear-gradient(145deg, color-mix(in srgb, ${options.palette.ink} 84%, white), ${options.palette.ink} 58%, color-mix(in srgb, ${options.palette.ink} 92%, ${options.palette.accent}))`,
    boxShadow: "inset 0 1px rgba(255,255,255,.2), 0 34px 110px rgba(22, 32, 31, .2)",
    color: options.palette.text,
    transformOrigin: "center",
  });

  const signal = document.createElement("div");
  signal.dataset.handoffSignal = "true";
  Object.assign(signal.style, {
    position: "absolute",
    inset: "0",
    opacity: ".34",
    background: `radial-gradient(ellipse at 76% 28%, ${options.palette.accent}66, transparent 30%), linear-gradient(116deg, transparent 18%, rgba(255,255,255,.2) 48%, transparent 72%)`,
  });

  const label = document.createElement("span");
  label.textContent = options.label;
  Object.assign(label.style, {
    position: "relative",
    zIndex: "1",
    alignSelf: "start",
    color: options.palette.signal,
    font: "500 10px/1.35 var(--font-signal-mono), ui-monospace, monospace",
    letterSpacing: ".16em",
    textTransform: "uppercase",
  });

  const title = document.createElement("strong");
  title.textContent = options.title;
  Object.assign(title.style, {
    position: "relative",
    zIndex: "1",
    alignSelf: "end",
    maxWidth: "10ch",
    font: "400 clamp(50px, 8vw, 126px)/.82 var(--font-signal-display), Georgia, serif",
    letterSpacing: "-.06em",
  });

  card.append(signal, label, title);

  if (options.kind === "reel") {
    const perforation = document.createElement("div");
    perforation.dataset.handoffPerforation = "true";
    Object.assign(perforation.style, {
      position: "absolute",
      inset: "8px 0",
      zIndex: "2",
      borderTop: "9px dotted rgba(255,246,232,.72)",
      borderBottom: "9px dotted rgba(255,246,232,.72)",
      pointerEvents: "none",
    });
    card.append(perforation);
  }

  overlay.append(backdrop, card);
  document.body.appendChild(overlay);
  return { overlay, backdrop, card, label, title };
}

/**
 * Starts the outgoing half of a route transition. The overlay is intentionally
 * appended to body rather than rendered inside the route: it survives the App
 * Router replacing the old WorkExperienceShell, so the next shell can finish
 * the exact same visual object instead of cross-fading two unrelated curtains.
 */
export async function startWorkRouteHandoff(options: StartHandoffOptions) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { overlay, backdrop, card, label, title } = makeOverlay(options);

  if (options.kind === "next") {
    const destinationIsWork = /^\/work\/(joi|joi-mobile)\/?$/.test(options.destination);
    if (destinationIsWork) {
      try {
        const arrival: StoredArrival = {
          destination: options.destination.replace(/\/$/, ""),
          title: options.title,
        };
        sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival));
      } catch {}
    }

    const duration = reduced ? 1 : 500;
    const full = {
      left: "8px",
      top: "8px",
      width: "calc(100vw - 16px)",
      height: "calc(100svh - 16px)",
      borderRadius: "26px",
    };
    card.animate(
      [
        { ...rectFrame(options.source), borderRadius: "30px" },
        full,
      ],
      { duration, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
    );
    backdrop.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration, easing: "ease-out", fill: "forwards" },
    );
    label.animate(
      [{ opacity: 1, transform: "translateY(0)" }, { opacity: .72, transform: "translateY(4px)" }],
      { duration, easing: "ease-out", fill: "forwards" },
    );
    title.animate(
      [{ transform: "scale(1)", filter: "blur(0)" }, { transform: "scale(1.045)", filter: "blur(0)" }],
      { duration, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
    );

    // Non-work destinations do not mount a matching receiver. A guarded tail
    // removes the overlay after the new route has painted; a Work shell claims
    // it first by setting data-received.
    window.setTimeout(() => {
      if (!overlay.isConnected || overlay.dataset.received === "true") return;
      overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: reduced ? 1 : 360,
        easing: "ease",
        fill: "forwards",
      }).finished.finally(() => overlay.remove());
    }, destinationIsWork ? 2400 : 820);
    await wait(duration);
    return;
  }

  const maxWidth = Math.min(window.innerWidth * 0.74, 820);
  const maxHeight = Math.min(window.innerHeight * 0.68, maxWidth * 0.75);
  const frameWidth = Math.min(maxWidth, maxHeight * 4 / 3);
  const frameHeight = frameWidth * 0.75;
  const filmRect = {
    left: (window.innerWidth - frameWidth) / 2,
    top: (window.innerHeight - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
  const foldDuration = reduced ? 1 : 360;
  card.animate(
    [
      { ...rectFrame(options.source), borderRadius: "30px" },
      { ...rectFrame(filmRect as DOMRect), borderRadius: "12px" },
    ],
    { duration: foldDuration, easing: "cubic-bezier(.3,.72,.2,1)", fill: "forwards" },
  );
  title.animate(
    [{ opacity: 1, transform: "scale(1)" }, { opacity: .78, transform: "scale(.72)" }],
    { duration: foldDuration, easing: "ease-out", fill: "forwards" },
  );
  backdrop.animate(
    [{ opacity: 0 }, { opacity: .22, offset: .7 }, { opacity: 1 }],
    { duration: reduced ? 1 : 540, easing: "ease-out", fill: "forwards" },
  );
  await wait(foldDuration);
  card.animate(
    [{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(4px)" }],
    { duration: reduced ? 1 : 180, easing: "ease-in", fill: "forwards" },
  );
  window.setTimeout(() => {
    if (!overlay.isConnected) return;
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reduced ? 1 : 340,
      easing: "ease",
      fill: "forwards",
    }).finished.finally(() => overlay.remove());
  }, 1100);
  await wait(reduced ? 1 : 180);
}

/** Finish a Work→Work handoff by shrinking the surviving full-screen card into
 * the new route's real identity card. Direct loads have neither marker nor
 * overlay and therefore take this path without any arrival machinery. */
export function finishIncomingWorkHandoff(
  target: DOMRect,
  destination: string,
) {
  const overlay = document.getElementById(HANDOFF_ID);
  if (!overlay || overlay.dataset.kind !== "next") return false;

  let arrival: StoredArrival | null = null;
  try {
    const raw = sessionStorage.getItem(ARRIVAL_KEY);
    arrival = raw ? JSON.parse(raw) as StoredArrival : null;
  } catch {}
  const normalizedDestination = destination.replace(/\/$/, "");
  if (!arrival || arrival.destination !== normalizedDestination) return false;

  try { sessionStorage.removeItem(ARRIVAL_KEY); } catch {}
  overlay.dataset.received = "true";
  const card = overlay.querySelector<HTMLElement>("[data-handoff-card]");
  const backdrop = overlay.querySelector<HTMLElement>("[data-handoff-backdrop]");
  if (!card || !backdrop) {
    overlay.remove();
    return false;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 1 : 560;
  backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduced ? 1 : 420,
    easing: "ease-in",
    fill: "forwards",
  });
  const cardAnimation = card.animate(
    [
      {
        left: "8px",
        top: "8px",
        width: "calc(100vw - 16px)",
        height: "calc(100svh - 16px)",
        borderRadius: "26px",
        opacity: 1,
      },
      {
        ...rectFrame(target),
        borderRadius: "30px",
        opacity: 1,
        offset: .82,
      },
      {
        ...rectFrame(target),
        borderRadius: "30px",
        opacity: 0,
      },
    ],
    { duration, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
  );
  cardAnimation.finished.finally(() => overlay.remove());
  return true;
}
