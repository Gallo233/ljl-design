"use client";

/**
 * One Joi session, two intentional presentations.
 *
 * In a regular article the embed may float automatically. In the Work
 * Experience it is controlled: docked and pointer-transparent while the page
 * owns input, then released as the real compact desktop pet while the visitor
 * is in INTERACT mode. The iframe is never reparented, so its socket, model and
 * conversation survive the morph.
 */

import { useEffect, useRef, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const shellBase = `${basePath}/joi-shell`;
const brokerBase = process.env.NEXT_PUBLIC_JOI_BROKER_BASE ?? "";

type MountResult = {
  setInteractionEnabled: (enabled: boolean) => void;
  setPresentation: (presentation: "docked" | "pet") => void;
  destroy: (options?: { endSession?: boolean }) => Promise<void>;
};
type EmbedModule = { mountJoi: (options: Record<string, unknown>) => Promise<MountResult> };
type Phase = "idle" | "connecting" | "live" | "unavailable";

type Props = {
  active?: boolean;
  stage?: boolean;
  start?: boolean;
  onPhaseChange?: (phase: Phase) => void;
  onExitRequested?: () => void;
};

export function JoiWebEmbed({
  active = true,
  stage = false,
  start = true,
  onPhaseChange,
  onExitRequested,
}: Props = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const instanceRef = useRef<MountResult | null>(null);
  const teardownRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  const [phase, setPhaseState] = useState<Phase>(
    !start ? "idle" : brokerBase ? "connecting" : "unavailable",
  );
  const [reason, setReason] = useState("");

  const setPhase = (next: Phase) => {
    setPhaseState(next);
    onPhaseChange?.(next);
  };

  useEffect(() => {
    activeRef.current = active;
    const instance = instanceRef.current;
    instance?.setInteractionEnabled(active);
    if (stage) instance?.setPresentation(active ? "pet" : "docked");
  }, [active, stage]);

  useEffect(() => {
    if (!start) {
      setPhase("idle");
      return;
    }

    // The offline and connecting states use the same stage geometry as the
    // live iframe, so its stylesheet is required even when no broker exists.
    const styleId = "joi-embed-style";
    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = `${shellBase}/joi-embed.css`;
      document.head.appendChild(link);
    }

    if (!brokerBase) {
      setPhase("unavailable");
      setReason("这台站点还没有连上 Joi 体验服。");
      return;
    }

    function scheduleTeardown() {
      if (teardownRef.current !== null) return;
      teardownRef.current = window.setTimeout(() => {
        teardownRef.current = null;
        startedRef.current = false;
        const instance = instanceRef.current;
        instanceRef.current = null;
        void instance?.destroy({ endSession: true });
      }, 0);
    }

    if (teardownRef.current !== null) {
      window.clearTimeout(teardownRef.current);
      teardownRef.current = null;
    }
    if (startedRef.current) return scheduleTeardown;
    startedRef.current = true;
    setPhase("connecting");

    (async () => {
      try {
        const module: EmbedModule = await import(
          /* webpackIgnore: true */ `${shellBase}/joi-embed.js`
        );
        if (!startedRef.current || !containerRef.current) return;
        const interactionEnabled = activeRef.current;
        const instance = await module.mountJoi({
          brokerBase,
          shellBase,
          container: containerRef.current,
          floatingEnabled: true,
          autoFloat: !stage,
          interactionEnabled,
          onEscape: onExitRequested,
        });
        if (!startedRef.current) {
          await instance.destroy({ endSession: true });
          return;
        }
        instanceRef.current = instance;
        instance.setInteractionEnabled(interactionEnabled);
        if (stage) instance.setPresentation(interactionEnabled ? "pet" : "docked");
        setPhase("live");
      } catch (error) {
        if (!startedRef.current) return;
        setPhase("unavailable");
        setReason(error instanceof Error ? error.message : "Joi 体验暂时不可用。");
      }
    })();

    return scheduleTeardown;
    // `start` is a one-way latch in the Work Experience. `stage` is stable for
    // the component lifetime; input and presentation update in the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  if (stage) {
    return (
      <div className="joi-experience joi-experience--stage" aria-live="polite">
        {phase !== "live" && (
          <div className="joi-experience-fallback joi-experience-fallback--stage">
            <strong>
              {phase === "idle" && "进入后启动 Joi"}
              {phase === "connecting" && "正在为你启动一份 Joi…"}
              {phase === "unavailable" && "Joi 现在不在线"}
            </strong>
            {phase === "unavailable" && <p>{reason}</p>}
          </div>
        )}
        <div className="joi-experience-mount" ref={containerRef} />
      </div>
    );
  }

  return (
    <section className="joi-live-session" aria-labelledby="joi-live-session-title">
      <header>
        <p className="project-detail-kicker">LIVE / WEB SESSION</p>
        <div>
          <h2 id="joi-live-session-title">Talk to her right here.</h2>
          <p lang="zh-CN">这是真正的 Joi，跑在为你单独启动的一份运行时里。</p>
        </div>
      </header>
      <div className="joi-experience" aria-live="polite">
        {phase !== "live" && (
          <div className="joi-experience-fallback">
            <strong>{phase === "connecting" ? "正在为你启动一份 Joi…" : "Joi 现在不在线"}</strong>
            {phase === "unavailable" && <p>{reason}</p>}
          </div>
        )}
        <div className="joi-experience-mount" ref={containerRef} />
      </div>
    </section>
  );
}
