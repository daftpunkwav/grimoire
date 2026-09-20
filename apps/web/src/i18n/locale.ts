/**
 * @file locale
 * @description Locale constants and normalization for the Grimoire web app.
 *
 * Responsibilities:
 * - Declare the supported locales (`zh-CN`, `en`) and their aliases
 * - Normalize any incoming locale string to a supported one
 * - Pick a default locale for first-time visitors
 *
 * Notes:
 * - `zh-CN` is the source-of-truth for keys. `en` is type-pinned to it.
 */

export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh-CN";

const ALIASES: Record<string, AppLocale> = {
  zh: "zh-CN",
  "zh-Hans": "zh-CN",
  "zh_CN": "zh-CN",
  "en-US": "en",
  "en-GB": "en",
};

const ENDONYMS: Record<AppLocale, string> = {
  "zh-CN": "\u4e2d\u6587",
  en: "English",
};

/**
 * Normalize an incoming locale string (e.g. from a cookie, header, or storage)
 * to a supported `AppLocale`. Falls back to `DEFAULT_LOCALE` if the input is
 * unrecognizable.
 */
export function normalizeLocale(input: string | null | undefined): AppLocale {
  if (!input) return DEFAULT_LOCALE;
  const trimmed = input.trim();
  if ((SUPPORTED_LOCALES as readonly string[]).includes(trimmed)) {
    return trimmed as AppLocale;
  }
  const aliased = ALIASES[trimmed];
  if (aliased) return aliased;
  const dashIndex = trimmed.indexOf("-");
  if (dashIndex > 0) {
    const base = trimmed.slice(0, dashIndex);
    const baseAliased = ALIASES[base];
    if (baseAliased) return baseAliased;
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
      return base as AppLocale;
    }
  }
  return DEFAULT_LOCALE;
}

/** Human-readable endonym for a locale (used by the locale switcher). */
export function endonym(locale: AppLocale): string {
  return ENDONYMS[locale];
}
