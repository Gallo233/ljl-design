import type { Metadata } from "next";
import { GameHandheld } from "./GameHandheld";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Zero Hour: Night Tide / 零刻：夜潮",
  description: "Play the Zero Hour: Night Tide Godot demo in your browser.",
};

export default function NightTidePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.back} href="/selected-work">← BACK TO REEL</a>
        <div className={styles.heading}>
          <p className={styles.kicker}>03 / PLAYABLE BUILD</p>
          <h1>ZERO HOUR: NIGHT TIDE</h1>
          <p className={styles.subtitle}>零刻：夜潮 · a Godot action prototype, now playable in the browser.</p>
        </div>
        <span className={styles.build}>GODOT 4.7 / WEB</span>
      </header>

      <section className={styles.gameSection} aria-labelledby="night-tide-game-title">
        <h2 id="night-tide-game-title" className={styles.srOnly}>Play Zero Hour: Night Tide</h2>
        <GameHandheld />
      </section>
    </main>
  );
}
