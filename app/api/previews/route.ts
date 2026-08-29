import { WISHLIST, type Preview, type PreviewResponse, type Wish } from "../../joi-signal-lab/deckLibrary";

/**
 * The deck's preview lookup, done here instead of in the browser.
 *
 * The room's turntable can play a thirty-second preview of a real track rather than only
 * the synthesised sides. Resolving which track that is takes a search per slot, and doing
 * those from the page is what made the study this came from slow to start: six parallel
 * requests to `itunes.apple.com` standing between opening the deck and playing anything,
 * on a host that is not reliably quick from mainland China.
 *
 * So they happen here. One request from the browser to its own origin, six from a server
 * with a good connection to Apple, and a day of cache in front of the whole thing — the
 * answer does not change, and a portfolio does not need it to.
 *
 * The audio itself is still fetched by the browser, straight from Apple's CDN. Proxying
 * a 30-second `m4a` per play through this route would put real bandwidth on the site to
 * save a hop that is already fast; if that ever stops being true, this is the file to add
 * it to. `deckLibrary.ts` carries the note on why a domestic music API is not the answer.
 */

const SEARCH = "https://itunes.apple.com/search";
/** Long enough for a slow answer, short enough that the deck is not held open by one. */
const TIMEOUT_MS = 6000;
/** The answer is stable, so ask Apple about it once a day at most. */
export const revalidate = 86400;

type ItunesTrack = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
};

/**
 * Pick the best match for one wish.
 *
 * Search returns karaoke versions, tribute covers and re-recordings above the original
 * often enough that taking the first result is wrong most of the time. Scoring is by
 * artist first — an exact title from the wrong artist is the wrong track — then by how
 * closely the title lands, with live and remixed cuts pushed down.
 */
function bestMatch(results: ItunesTrack[], wish: Wish): ItunesTrack | null {
  const wantTitle = (wish.queryTitle ?? wish.title).toLowerCase();
  const wantArtist = (wish.queryArtist ?? wish.artist).toLowerCase();
  const wantCollection = wish.collection?.toLowerCase();
  const banned = /karaoke|tribute|cover|instrumental|as made famous|originally performed|made popular/i;

  const usable = results.filter(
    (result) =>
      result.previewUrl &&
      !banned.test(`${result.trackName ?? ""} ${result.artistName ?? ""} ${result.collectionName ?? ""}`),
  );

  const score = (result: ItunesTrack) => {
    const artist = (result.artistName ?? "").toLowerCase();
    const title = (result.trackName ?? "").toLowerCase();
    const collection = (result.collectionName ?? "").toLowerCase();
    let points = 0;
    if (artist.includes(wantArtist) || wantArtist.includes(artist)) points += 5;
    if (title === wantTitle) points += 5;
    else if (title.startsWith(wantTitle)) points += 3;
    else if (title.includes(wantTitle)) points += 1;
    if (wantCollection && collection.includes(wantCollection)) points += 4;
    if (/\b(live|remix|re-recorded|edit|version|remaster)/i.test(title)) points -= 2;
    return points;
  };

  const match = usable.sort((a, b) => score(b) - score(a))[0] ?? null;
  // A playable result is not necessarily the requested song. Requiring a title or
  // artist match keeps an unlucky search response from putting a cover in the sleeve.
  return match && score(match) >= 5 ? match : null;
}

async function resolve(wish: Wish, slot: number): Promise<Preview | null> {
  const query = `${wish.queryArtist ?? wish.artist} ${wish.queryTitle ?? wish.title}`;
  const url = `${SEARCH}?term=${encodeURIComponent(query)}&entity=song&limit=10&country=US`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { results?: ItunesTrack[] };
    const match = bestMatch(data.results ?? [], wish);
    if (!match?.previewUrl) return null;
    return {
      slot,
      id: `itunes-${match.trackId ?? slot}`,
      title: match.trackName ?? wish.title,
      artist: match.artistName ?? wish.artist,
      // Previews are thirty seconds, but the field is what the scrubber trusts.
      duration: match.trackTimeMillis ? Math.min(30, match.trackTimeMillis / 1000) : 30,
      src: match.previewUrl,
      artwork: match.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
    };
  } catch {
    // A slot that will not resolve is not an error: the deck has a side for it.
    return null;
  }
}

export async function GET() {
  const settled = await Promise.all(WISHLIST.map((wish, slot) => resolve(wish, slot)));
  const tracks = settled.filter((track): track is Preview => track !== null);
  const body: PreviewResponse = { source: tracks.length > 0 ? "itunes" : "offline", tracks };

  return Response.json(body, {
    headers: {
      // The browser gets a day too, and a stale answer for a week beyond it — a deck
      // opening with last week's previews beats a deck opening with none.
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
