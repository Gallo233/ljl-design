"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STRINGS, type StringKey } from "./strings";

/**
 * One site, two languages, no second set of routes.
 *
 * The obvious alternative — `/zh/...` and `/en/...` — was rejected on purpose. The four
 * main addresses are one continuous scroll: `sections.ts` maps each to a position, the
 * driver rewrites the address with `replaceState` as the reader passes each section, and
 * deep links land by scrolling rather than by mounting a different tree. Doubling that
 * into a locale segment would put a remount in the middle of a scroll and give every
 * section two canonical URLs for no reader-visible gain.
 *
 * So the language is client state: chosen in the header, remembered in localStorage,
 * and written onto `<html lang>` so assistive technology follows it.
 */

export type Locale = "zh" | "en";

/** Chinese is the site's own language; English is the visitor's option. */
export const DEFAULT_LOCALE: Locale = "zh";

const STORAGE_KEY = "gallo:locale";

const HTML_LANG: Record<Locale, string> = { zh: "zh-CN", en: "en" };

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** The strings table already resolved for the active language. */
  t: Record<StringKey, string>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const readStored = (): Locale | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "zh" || raw === "en" ? raw : null;
  } catch {
    // Private mode and blocked storage both land here. A visitor who cannot be
    // remembered still gets a working switch for this visit.
    return null;
  }
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  /*
   * Server and first client render agree on Chinese, which is what `<html lang>` says
   * and what the markup already contains. Only a visitor who has previously chosen
   * English is switched, and that happens in a layout effect — before paint, so there is
   * no frame of the wrong language.
   */
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useLayoutEffect(() => {
    const stored = readStored();
    if (stored && stored !== locale) setLocaleState(stored);
    // Deliberately once: this restores a choice, it does not track it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice must not break making it.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const t = {} as Record<StringKey, string>;
    for (const key of Object.keys(STRINGS) as StringKey[]) t[key] = STRINGS[key][locale];
    return { locale, setLocale, t };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value) return value;
  /*
   * A component rendered outside the provider still has to say something. Falling back
   * to the default language keeps a stray mount readable instead of throwing, which
   * matters because several of these trees are portalled or rendered inside canvases.
   */
  const t = {} as Record<StringKey, string>;
  for (const key of Object.keys(STRINGS) as StringKey[]) t[key] = STRINGS[key][DEFAULT_LOCALE];
  return { locale: DEFAULT_LOCALE, setLocale: () => {}, t };
}

/**
 * For data that already carries both languages in sibling fields — the lab entries, the
 * cartridges, the library's titles and quotes, the room's object labels. Those tables
 * stay the single source of truth for their own content; this only chooses a column.
 */
export const pick = (locale: Locale, en: string, zh: string) => (locale === "zh" ? zh : en);
