"use client";

/**
 * The live Joi session inside the case study.
 *
 * The shell is the real Joi desktop UI built for the browser, so it ships as a
 * static directory under /joi-shell/ and is framed rather than imported: it
 * assumes it owns the viewport (`html, body { overflow: hidden }`), which is
 * true inside a frame and false inside an article.
 *
 * Everything about the geometry -- docking here, lifting out to the corner when
 * this section scrolls away, dragging, wheel-scaling -- lives in the shell's own
 * joi-embed.js so it cannot drift from the shell's postMessage contract. This
 * component's whole job is to give it a container, hand it the broker, and say
 * something honest when the broker is not there.
 */

import { useEffect, useRef, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const shellBase = `${basePath}/joi-shell`;
const brokerBase = process.env.NEXT_PUBLIC_JOI_BROKER_BASE ?? "";

type MountResult = { destroy: (options?: { endSession?: boolean }) => Promise<void> };
type EmbedModule = { mountJoi: (options: Record<string, unknown>) => Promise<MountResult> };

type Phase = "connecting" | "live" | "unavailable";

export function JoiWebEmbed() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // React 19 Strict Mode mounts, unmounts and remounts in one tick. Asking the
  // broker twice would bill one visitor for two Cores, so the session is held
  // across that remount -- and the teardown is *deferred by a tick* rather than
  // skipped, because a skipped teardown is how the pet ended up outliving the
  // page and following the visitor around the rest of the site.
  const startedRef = useRef(false);
  const instanceRef = useRef<MountResult | null>(null);
  const teardownRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>(brokerBase ? "connecting" : "unavailable");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!brokerBase) {
      setReason("这台站点还没有连上 Joi 体验服。");
      return;
    }

    /** Real unmounts run this; a Strict Mode remount cancels it first. */
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

    // The stylesheet ships with the shell build, so the two never disagree
    // about what `.joi-embed-frame` means.
    const styleId = "joi-embed-style";
    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = `${shellBase}/joi-embed.css`;
      document.head.appendChild(link);
    }

    (async () => {
      try {
        const module: EmbedModule = await import(
          /* webpackIgnore: true */ `${shellBase}/joi-embed.js`
        );
        if (!startedRef.current || !containerRef.current) return;
        const instance = await module.mountJoi({
          brokerBase,
          shellBase,
          container: containerRef.current,
        });
        // `startedRef` going false means a teardown already fired while this
        // was still starting: the page is gone and so must the session be.
        if (!startedRef.current) {
          await instance.destroy({ endSession: true });
          return;
        }
        instanceRef.current = instance;
        setPhase("live");
      } catch (error) {
        if (!startedRef.current) return;
        setPhase("unavailable");
        setReason(error instanceof Error ? error.message : "Joi 体验暂时不可用。");
      }
    })();

    return scheduleTeardown;
  }, []);

  return (
    <section className="joi-live-session" aria-labelledby="joi-live-session-title">
      <header>
        <p className="project-detail-kicker">LIVE / WEB SESSION</p>
        <div>
          <h2 id="joi-live-session-title">Talk to her right here.</h2>
          <p lang="zh-CN">
            这是真正的 Joi，跑在为你单独启动的一份运行时里。向下滚动继续读，她会缩成右下角的桌宠跟着你——
            可以拖动，选中后滚轮缩放。
          </p>
        </div>
      </header>

      <div className="joi-experience" aria-live="polite">
        {phase !== "live" && (
          <div className="joi-experience-fallback">
            <strong>{phase === "connecting" ? "正在为你启动一份 Joi…" : "Joi 现在不在线"}</strong>
            {phase === "unavailable" && <p>{reason}</p>}
            {phase === "unavailable" && (
              <p lang="en">
                The browser session runs on its own Core process; when that host is offline the
                case study below still describes what it does.
              </p>
            )}
          </div>
        )}
        {/*
          The mount point is deliberately childless in JSX and stays that way.
          joi-embed.js calls replaceChildren() on it, and React only tolerates
          that on a node whose children it never reconciles -- sharing one
          container with the fallback above threw NotFoundError the moment the
          session came up and React went looking for a node the embed had
          already removed.
        */}
        <div className="joi-experience-mount" ref={containerRef} />
      </div>

      <footer className="joi-experience-note">
        <p>
          浏览器里的 Joi 只做对话、角色与记忆。看屏幕、操作电脑、写代码、玩 Minecraft
          这些需要她住在你自己的机器上——那部分在上面的演示视频里。
        </p>
      </footer>
    </section>
  );
}
