export const CONTACT_EMAIL = "18520455682@163.com";

/**
 * Contact's links.
 *
 * The words that used to live here — kicker, title, statement, meta — moved into the
 * strings table when the language switch landed, because they are things the interface
 * says and it now says them twice. What stays is the address and GitHub, which read the
 * same in either language, so nothing here needs a translation key.
 */
export const CONTACT_ACTIONS = [
  {
    labelKey: null,
    value: "GITHUB / GALLO233",
    href: "https://github.com/Gallo233",
    external: true,
  },
] as const;
