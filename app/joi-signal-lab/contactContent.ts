export const CONTACT_EMAIL = "18520455682@163.com";

/**
 * Contact's links.
 *
 * The words that used to live here — kicker, title, statement, meta — moved into the
 * strings table when the language switch landed, because they are things the interface
 * says and it now says them twice. What stays is the address and the two destinations,
 * which read the same in either language; only the résumé's label is translated, and it
 * carries its own key rather than a second copy of the string.
 */
export const CONTACT_ACTIONS = [
  {
    labelKey: null,
    value: "GITHUB / GALLO233",
    href: "https://github.com/Gallo233",
    external: true,
  },
  {
    labelKey: "contactActionResume",
    value: "RESUME / PDF",
    href: "/resume/gallo-liu-resume-cn.pdf",
    download: true,
  },
] as const;
