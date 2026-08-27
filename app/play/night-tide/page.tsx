import type { Metadata } from "next";
import Link from "next/link";
import { SHARE_CARD, canonicalPath } from "../../site";
import { ArrivalFade } from "../../../components/ArrivalFade";
import { GameHandheld } from "./GameHandheld";
import styles from "./page.module.css";

/**
 * The route stays `/play/night-tide` because it is linked from the reel and from outside,
 * and a portfolio's URLs are worth more stable than tidy. The *page* is now a game centre:
 * Night Tide is one of four cartridges rather than the whole shelf.
 */

const title = "Game Center / 游戏厅";
const description =
  "A handheld in the browser: Zero Hour: Night Tide, plus Snake, Tetris and Pac-Man.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalPath("/play/night-tide") },
  // Declaring these replaces the layout's, which would otherwise share this page
  // under the site's own title — hence the card is named again here.
  openGraph: {
    type: "article",
    siteName: "Gallo",
    title,
    description,
    url: canonicalPath("/play/night-tide"),
    images: [SHARE_CARD],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [SHARE_CARD.url],
  },
};

export default function GameCenterPage() {
  return (
    <main className={styles.page}>
      <ArrivalFade />
      <header className={styles.header}>
        <Link className={styles.back} href="/selected-work">← BACK TO REEL</Link>
        <span className={styles.build}>4 CARTRIDGES / WEB</span>
        <div className={styles.heading}>
          <p className={styles.kicker}>03 / GAME CENTER</p>
          <h1 lang="zh-CN">游戏厅</h1>
          <p className={styles.subtitle} lang="zh-CN">
            一台跑在浏览器里的掌机。零刻：夜潮是 Godot 动作原型，另外三张卡带是贪吃蛇、俄罗斯方块和吃豆人。
            键盘、触屏都能玩；手机横过来会占满整屏。
          </p>
        </div>
      </header>

      <section className={styles.gameSection} aria-labelledby="game-center-title">
        <h2 id="game-center-title" className={styles.srOnly}>选择并试玩一张卡带</h2>
        <GameHandheld />
      </section>
    </main>
  );
}
