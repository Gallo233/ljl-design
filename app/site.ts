/**
 * One place for the site's own address.
 *
 * `metadataBase`, the sitemap, robots and every canonical URL have to agree, and
 * they were previously spread across files — which is how `metadataBase` ended up
 * pointing at `gallo.design` while the site served from `ljl.design`.
 *
 * `SITE_URL` never carries a trailing slash; `canonicalPath` always ends with one,
 * because `next.config.mjs` sets `trailingSlash: true` and a canonical that
 * disagrees with the URL the server actually serves is worse than none.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ljl.design";

/** `/work/joi` -> `/work/joi/`, `/` -> `/`. */
export function canonicalPath(path: string) {
  if (!path.startsWith("/")) return canonicalPath(`/${path}`);
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * The share card, as a value.
 *
 * `app/opengraph-image.png` is picked up by file convention on routes that do not
 * declare `openGraph` themselves — but a page that declares one *replaces* the
 * layout's object rather than merging into it, and loses the file-convention image
 * with it. Any route that sets its own `openGraph` has to name the card, so it is
 * spelled out once here instead of per route.
 */
/** Shown in the fixed HUD; bump the revision when the shell meaningfully changes. */
export const BUILD_TAG = "JOI9000 / R2";

export const SHARE_CARD = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Gallo — I design how AI enters human life.",
} as const;
