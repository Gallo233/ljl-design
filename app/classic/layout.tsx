import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * `/classic` is the previous site, kept intact and unlinked.
 *
 * The page itself is a client component, so it cannot export metadata of its own —
 * which left it inheriting the root layout's `openGraph` and nothing else. No
 * canonical, no `robots`, and a sitemap that deliberately omits it: the one shape
 * that says "index me" to a crawler while saying "this does not exist" to a reader.
 * Duplicate homepage copy on a second address is exactly what that costs.
 *
 * A layout can carry metadata where the page cannot. `noindex` states the intent the
 * sitemap already implies, and `nofollow` keeps the old internal links from being
 * walked back into the live routes under a second set of addresses.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ClassicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
