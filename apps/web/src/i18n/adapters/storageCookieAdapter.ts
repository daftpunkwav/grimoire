/**
 * @file i18n/adapters/storageCookieAdapter
 * @description Persistence adapter for the active locale.
 *
 * Responsibilities:
 * - Read the active locale from a cookie (and optional localStorage mirror)
 * - Write the active locale to the cookie (and the localStorage mirror)
 * - Default to `DEFAULT_LOCALE` when no value is stored
 *
 * Notes:
 * - The cookie is the source of truth for SSR (so the server can render
 *   the matching locale); localStorage is a client-only convenience for
 *   offline boot.
 */

import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from "../locale.js";

const COOKIE_NAME = "grimoire-locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year
const STORAGE_KEY = "grimoire:locale";

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const idx = c.indexOf("=");
    if (idx <= 0) continue;
    if (c.slice(0, idx) === COOKIE_NAME) {
      return decodeURIComponent(c.slice(idx + 1));
    }
  }
  return null;
}

function writeCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function makeStorageAdapter() {
  return {
    read(): AppLocale | null {
      const fromCookie = readCookie();
      if (fromCookie) return normalizeLocale(fromCookie);
      if (typeof window === "undefined") return null;
      const fromStorage = window.localStorage?.getItem(STORAGE_KEY);
      return fromStorage ? normalizeLocale(fromStorage) : null;
    },
    write(locale: AppLocale): void {
      writeCookie(locale);
      if (typeof window !== "undefined") {
        try {
          window.localStorage?.setItem(STORAGE_KEY, locale);
        } catch {
          /* localStorage may be unavailable (private mode, quota); ignore */
        }
      }
    },
  };
}

export function resolveInitialLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const fromCookie = readCookie();
    if (fromCookie) return normalizeLocale(fromCookie);
  }
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage?.getItem(STORAGE_KEY);
    if (fromStorage) return normalizeLocale(fromStorage);
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return normalizeLocale(navigator.language);
  }
  return DEFAULT_LOCALE;
}
