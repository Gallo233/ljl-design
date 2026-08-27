import { redirect } from "next/navigation";

/**
 * The lab is the site now. Kept so old links still land somewhere sensible.
 *
 * Trailing slash on purpose: `next.config.mjs` sets `trailingSlash: true`, so
 * `/selected-work` is itself a 308 to `/selected-work/`. Redirecting to the un-slashed
 * form makes every old link pay two hops instead of one.
 */
export default function JoiSignalLabPage() {
  redirect("/selected-work/");
}
