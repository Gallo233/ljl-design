"use client";

import { useState } from "react";
import { JoiMusicPlayer } from "../../joi-signal-lab/JoiMusicPlayer";

/**
 * A bench for the deck console, which is DOM rather than WebGL and so cannot be checked
 * from `room-preview`. It exists for the layout question the room bench cannot answer:
 * the console is pinned to the edges precisely so the turntable stays visible between
 * its controls, and the only way to see whether it does is to render it over something
 * turntable-shaped.
 */
export function DeckPreview() {
  const [rpm, setRpm] = useState(33 + 1 / 3);
  const [progress, setProgress] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg,#e9e6e0,#dcd8d1)", overflow: "hidden" }}>
      {/* Stands in for the deck, at roughly the size player mode frames it at. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: "50%", top: "42%", translate: "-50% -50%",
          width: "min(620px, 62vw)", aspectRatio: "4 / 3", borderRadius: 10,
          background: "linear-gradient(150deg,#3a3f45,#15181c)",
          display: "grid", placeItems: "center",
        }}
      >
        <div style={{
          width: "58%", aspectRatio: "1", borderRadius: "50%",
          background: "repeating-radial-gradient(circle,#0c0e11 0 2px,#16191d 2px 4px)",
        }} />
      </div>
      <div style={{ position: "absolute", left: 16, top: 14, font: "10px monospace", color: "#6d6157" }}>
        deck bench · rpm {rpm.toFixed(2)} · progress {progress === null ? "—" : progress.toFixed(2)}
      </div>
      <JoiMusicPlayer
        open={open}
        onClose={() => setOpen(false)}
        onPlayingChange={() => {}}
        onProgressChange={setProgress}
        rpm={rpm}
        onRpmChange={setRpm}
        onResetView={() => {}}
      />
    </div>
  );
}
