import type { Metadata } from "next";
import { fontVariables } from "../../fonts";
import { SHARE_CARD, canonicalPath } from "../../site";
import { GameCenterExperience } from "./GameCenterExperience";

/**
 * The route stays `/play/night-tide` because it is linked from the reel and from outside,
 * and a portfolio's URLs are worth more stable than tidy. The *page* is now a game centre:
 * Night Tide is one cartridge on the shelf rather than the whole shelf.
 */

const title = "游戏厅";
const description =
  "浏览器里的一台掌机：《零刻：夜潮》和《星脉》，加上贪吃蛇、俄罗斯方块和吃豆人。";

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
    <div className={fontVariables}>
      <GameCenterExperience />
    </div>
  );
}
