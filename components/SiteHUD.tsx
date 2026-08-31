"use client";

import { useEffect, useState } from "react";
import { BUILD_TAG } from "../app/site";
import styles from "./site-hud.module.css";

/**
 * The fixed metadata strip along the bottom edge — haoqi.design's grammar: local
 * time, coordinates, build tag. One component serves both visual worlds because it
 * paints in `mix-blend-mode: difference`; the same white type reads dark on cream
 * and light on the CRT's near-black.
 *
 * The clock renders empty on the server and fills on mount — time is the one thing
 * SSR must not pretend to know.
 */
export function SiteHUD() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
    const tick = () => setTime(format.format(new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={styles.hud} data-site-hud aria-hidden="true">
      <span suppressHydrationWarning>GMT+8 CN {time || "--:--:--"}</span>
      <span className={styles.mid}>GUANGZHOU 23.13°N 113.26°E</span>
      <span>{BUILD_TAG}</span>
    </div>
  );
}
