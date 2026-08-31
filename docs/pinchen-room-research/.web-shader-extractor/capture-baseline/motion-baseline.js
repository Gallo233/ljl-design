// Interaction-only baseline for jesperlandberg.com, captured 2026-08-29.
// SOURCE: constants and state equations below come from the public Nuxt chunks.
// GUESS: Canvas drawing is an intentionally plain visual proxy; no original art,
// WebGL shaders, text rasterizer, route transitions, or media are reproduced.

const SOURCE = Object.freeze({
  wheelScale: 1.25,
  discreteMultiplier: 2,
  discreteDeltaMin: 40,
  burstGapMs: 30,
  discreteResetMs: 500,
  inertiaBlend: 0.22,
  touchScale: 3.25,
  touchRelease: 35,
  arrowStep: 100,
  pageStep: 0.9,
  follow: 0.1,
  followFrameRatioCap: 2,
  inertiaFrameRatioCap: 4,
  desktopVelocityNorm: 550,
  desktopLagLimitVw: 1,
  dragThreshold: 10,
  dragScale: 1.5,
  dragRelease: 12,
  dragReleaseWindowMs: 100,
  dprCap: 2,
});

const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const track = document.querySelector("#track");
const cards = [...document.querySelectorAll(".card")];
const metrics = {
  target: document.querySelector("#target"),
  current: document.querySelector("#current"),
  lag: document.querySelector("#lag"),
  velocity: document.querySelector("#velocity"),
};

const scroll = {
  target: 0,
  current: 0,
  pending: 0,
  inertia: 0,
  lastWheelEvent: null,
  lastWheelTime: 0,
  burstTime: -SOURCE.discreteResetMs,
  previousFrame: 0,
  loopWidth: 1,
  measured: [],
};

const drag = {
  armed: false,
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastDelta: 0,
  lastMoveTime: 0,
};

const wrap = (min, max, value) => {
  const range = max - min;
  return ((value - min) % range + range) % range + min;
};

const roundedRect = (context, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const resizeCanvas = () => {
  const dpr = Math.min(SOURCE.dprCap, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const measure = () => {
  for (const card of cards) card.style.transform = "";

  const viewportWidth = document.documentElement.clientWidth;
  scroll.measured = cards.map((card) => {
    const rect = card.getBoundingClientRect();
    return {
      card,
      start: rect.left - viewportWidth,
      end: rect.right,
      base: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  });

  const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
  const first = scroll.measured[0];
  const last = scroll.measured.at(-1);
  scroll.loopWidth = Math.max(1, last.end + gap - (first.start + viewportWidth));
  layoutCards(true);
};

const layoutCards = (force = false) => {
  const margin = window.innerWidth * 0.5;

  for (const item of scroll.measured) {
    const shift = wrap(
      -(scroll.loopWidth - item.end),
      item.end,
      scroll.current,
    );
    const left = item.base.left - shift;
    const visible = left + item.base.width > -margin && left < window.innerWidth + margin;
    item.card.dataset.parked = visible || force ? "false" : "true";
    item.card.style.transform = `translate3d(${-shift}px, 0px, 0px)`;
  }
};

const push = (delta) => {
  scroll.target += delta;
  const limit = window.innerWidth * SOURCE.desktopLagLimitVw;
  const lag = scroll.target - scroll.current;
  scroll.target = scroll.current + Math.tanh(lag / limit) * limit;
};

const onWheel = (event) => {
  if (event.ctrlKey) return;

  const modeScale = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? window.innerHeight
      : 1;
  const delta = (event.deltaY + event.deltaX) * modeScale;
  const gap = event.timeStamp - scroll.lastWheelTime;

  if (gap < SOURCE.burstGapMs) scroll.burstTime = event.timeStamp;

  const discrete = Math.abs(delta) >= SOURCE.discreteDeltaMin
    && gap >= SOURCE.burstGapMs
    && event.timeStamp - scroll.burstTime >= SOURCE.discreteResetMs;

  scroll.lastWheelTime = event.timeStamp;
  scroll.lastWheelEvent = event;

  if (discrete) {
    scroll.inertia += delta * SOURCE.wheelScale * SOURCE.discreteMultiplier;
  } else {
    scroll.pending += delta * SOURCE.wheelScale;
  }
};

const onKeyDown = (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (/^(input|textarea|select|button|a|summary|audio|video)$/i.test(event.target.tagName)) return;

  const page = window.innerHeight * SOURCE.pageStep;
  const deltaByKey = {
    ArrowRight: SOURCE.arrowStep,
    ArrowDown: SOURCE.arrowStep,
    ArrowLeft: -SOURCE.arrowStep,
    ArrowUp: -SOURCE.arrowStep,
    PageDown: page,
    PageUp: -page,
    " ": event.shiftKey ? -page : page,
  };

  if (!(event.key in deltaByKey)) return;
  event.preventDefault();
  push(deltaByKey[event.key]);
};

const cancelDrag = (event, commitRelease) => {
  const wasActive = drag.active;
  drag.armed = false;
  drag.active = false;
  document.documentElement.classList.remove("is-dragging");

  if (
    wasActive
    && commitRelease
    && drag.lastDelta
    && event.timeStamp - drag.lastMoveTime < SOURCE.dragReleaseWindowMs
  ) {
    push(drag.lastDelta * SOURCE.dragRelease);
  }

  drag.lastDelta = 0;
};

const onPointerMove = (event) => {
  if (!drag.armed) return;

  if (!drag.active) {
    const dx = Math.abs(event.clientX - drag.startX);
    const dy = Math.abs(event.clientY - drag.startY);
    if (dx <= SOURCE.dragThreshold || dx <= dy) return;
    drag.active = true;
    drag.lastX = event.clientX;
    document.documentElement.classList.add("is-dragging");
  }

  event.preventDefault();
  const delta = (drag.lastX - event.clientX) * SOURCE.dragScale;
  drag.lastX = event.clientX;
  drag.lastDelta = delta;
  drag.lastMoveTime = event.timeStamp;
  if (delta) push(delta);
};

const onPointerDown = (event) => {
  if (event.button !== 0 || event.pointerType !== "mouse") return;
  drag.armed = true;
  drag.active = false;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.lastDelta = 0;
};

const draw = (normalizedVelocity) => {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  for (const item of scroll.measured) {
    if (item.card.dataset.parked === "true") continue;
    const rect = item.card.getBoundingClientRect();
    const tone = item.card.dataset.tone;
    const gradient = ctx.createLinearGradient(rect.left, rect.top, rect.right, rect.bottom);
    gradient.addColorStop(0, tone);
    gradient.addColorStop(1, "#151515");

    ctx.save();
    const offset = Math.min(14, Math.abs(normalizedVelocity) * 14);
    ctx.translate(0, Math.sign(normalizedVelocity) * offset);
    roundedRect(ctx, rect.left, rect.top, rect.width, rect.height, 20);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = tone === "#efefef" ? "#000" : "#fff";
    ctx.font = "16px Arial, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.fillText(item.card.dataset.title, rect.left + 20, rect.bottom - 18);
    ctx.restore();
  }
};

const tick = (time) => {
  const ratio = scroll.previousFrame
    ? (time - scroll.previousFrame) / (1000 / 60)
    : 0;
  scroll.previousFrame = time;

  if (scroll.inertia) {
    const cappedRatio = Math.min(ratio || 0, SOURCE.inertiaFrameRatioCap);
    const step = scroll.inertia * (1 - Math.pow(1 - SOURCE.inertiaBlend, cappedRatio));
    scroll.pending += step;
    scroll.inertia -= step;
    if (Math.abs(scroll.inertia) < 0.05) {
      scroll.pending += scroll.inertia;
      scroll.inertia = 0;
    }
  }

  if (scroll.pending) {
    push(scroll.pending);
    scroll.pending = 0;
  }

  const follow = SOURCE.follow * Math.min(ratio || 0, SOURCE.followFrameRatioCap);
  scroll.current += (scroll.target - scroll.current) * follow;
  scroll.current = Math.round(scroll.current * 100) / 100;

  const lag = scroll.target - scroll.current;
  const velocity = Math.tanh(lag / SOURCE.desktopVelocityNorm);
  const shapedVelocity = velocity * Math.abs(velocity);

  layoutCards();
  draw(shapedVelocity);

  metrics.target.value = scroll.target.toFixed(2);
  metrics.current.value = scroll.current.toFixed(2);
  metrics.lag.value = lag.toFixed(2);
  metrics.velocity.value = shapedVelocity.toFixed(3);

  requestAnimationFrame(tick);
};

window.addEventListener("wheel", onWheel, { passive: true });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove, { passive: false });
window.addEventListener("pointerup", (event) => cancelDrag(event, true));
window.addEventListener("pointercancel", (event) => cancelDrag(event, false));
window.addEventListener("resize", () => {
  resizeCanvas();
  measure();
});

document.querySelector("#reset").addEventListener("click", () => {
  scroll.target = 0;
  scroll.current = 0;
  scroll.pending = 0;
  scroll.inertia = 0;
});

resizeCanvas();
measure();
requestAnimationFrame(tick);
