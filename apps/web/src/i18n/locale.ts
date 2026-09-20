/**
 * @file locale
 * @description Locale constants and normalization for the Grimoire web app.
 *
 * Responsibilities:
 * - Declare the supported locales (`zh-CN`, `en`) and their aliases
 * - Normalize any incoming locale string (case- and underscore-insensitive) to a supported one
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
  "zh-CN": "zh-CN",
  "zh_CN": "zh-CN",
  "en": "en",
  "en-US": "en",
  "en-GB": "en",
  "en_US": "en",
};

const ENDONYMS: Record<AppLocale, string> = {
  "zh-CN": "\u4e2d\u6587",
  en: "English",
};

/**
 * Normalize an incoming locale string (e.g. from a cookie, header, or storage)
 * to a supported `AppLocale`. Falls back to `DEFAULT_LOCALE` if the input is
 * unrecognizable.
 *
 * Normalization rules:
 * - Lowercases the input
 * - Converts underscores to hyphens
 * - Looks up the normalized string in `ALIASES`, then falls back to the
 *   language-part (before any `-` / `_`)
 */
export function normalizeLocale(input: string | null | undefined): AppLocale {
  if (!input) return DEFAULT_LOCALE;
  const normalized = input.trim().toLowerCase().replace(/_/g, "-");
  if (normalized in ALIASES) return ALIASES[normalized];
  const base = normalized.split(/[-_]/, 1)[0];
  if (base in ALIASES) return ALIASES[base];
  if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as AppLocale;
  }
  if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
    return base as AppLocale;
  }
  return DEFAULT_LOCALE;
}

/** Human-readable endonym for a locale (used by the locale switcher). */
export function endonym(locale: AppLocale): string {
  return ENDONYMS[locale];
}
