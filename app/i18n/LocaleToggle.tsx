"use client";

import { useLocale } from "./locale";
import styles from "./locale-toggle.module.css";

/**
 * The language switch, as one button rather than two.
 *
 * Both languages are always on screen with the active one lit, so the control states
 * where you are and what the click will do at the same time. A single button that showed
 * only the *other* language would be smaller, but it reads as a label until you work out
 * that it is a switch.
 *
 * The accessible name is bilingual on purpose: a visitor who cannot read the current
 * language is exactly the visitor who needs this control.
 */
export function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const next = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      className={`${styles.toggle} ${className}`}
      lang={locale === "zh" ? "zh-CN" : "en"}
      aria-label={t.localeSwitchLabel}
      onClick={() => setLocale(next)}
    >
      <span className={styles.side} data-active={locale === "zh"} lang="zh-CN">
        {t.localeToChinese}
      </span>
      <i className={styles.slash} aria-hidden="true">/</i>
      <span className={styles.side} data-active={locale === "en"} lang="en">
        {t.localeToEnglish}
      </span>
    </button>
  );
}
