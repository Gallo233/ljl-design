import { ImageResponse } from "next/og";

/**
 * Source for `app/opengraph-image.png`. **Not a route** — it lives here on purpose.
 *
 * A share card is the one frame of this site that cannot move, so it shows the
 * thing the CRT is built around rather than a screenshot of it: the hero line,
 * inside the machine's bezel. Colours are the experience's own — `#05070b`
 * ground, `#0a1221` screen, coral `#ec6549`, cream `#f2eee8`.
 *
 * ### Why the PNG is committed instead of generated as a route
 *
 * `next.config.mjs` sets `trailingSlash: true`. As `app/opengraph-image.tsx` the
 * card is served at `/opengraph-image`, which then 308s to `/opengraph-image/` —
 * so every `og:image` in the site points at a redirect. Most crawlers follow it;
 * the ones that matter most here (WeChat in particular) are unreliable about it.
 * A committed `opengraph-image.png` is served at a URL that carries an extension,
 * which `trailingSlash` leaves alone, and it applies to every route automatically.
 *
 * ### Regenerating
 *
 * Copy this file to `app/opengraph-image.tsx`, run `npm run build && npm start`,
 * fetch `http://127.0.0.1:3000/opengraph-image/` into `app/opengraph-image.png`,
 * then remove the copy from `app/` again. Keep `app/opengraph-image.alt.txt` in
 * step with `alt` below.
 *
 * Rendered by satori, which supports flexbox only — no grid, no custom fonts
 * here beyond the bundled default.
 */

export const alt = "Gallo — I design how AI enters human life.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 28,
          background: "#05070b",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 64px",
            borderRadius: 24,
            border: "4px solid #050607",
            background:
              "radial-gradient(ellipse at 50% 62%, #16233a 0%, #0a1221 46%, #06070a 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                letterSpacing: 2,
                color: "#f2eee8",
                opacity: 0.9,
              }}
            >
              GALLO
            </div>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: "#6592bd" }}>
              JOI9000
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                letterSpacing: 4,
                color: "#ec6549",
                marginBottom: 26,
              }}
            >
              PERSONAL AI SYSTEM · GUANGZHOU / 2026
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 78,
                lineHeight: 1.08,
                letterSpacing: -1,
                color: "#f2eee8",
              }}
            >
              <div style={{ display: "flex" }}>I DESIGN HOW AI</div>
              <div style={{ display: "flex" }}>ENTERS HUMAN LIFE.</div>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, letterSpacing: 2, color: "#8a94a8" }}>
            ljl.design
          </div>
        </div>
      </div>
    ),
    size,
  );
}
