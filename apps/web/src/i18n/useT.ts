/**
 * @file useT
 * @description React hooks for the i18n provider.
 *
 * Responsibilities:
 * - Expose the current locale and a setter through `useLocale` / `useSetLocale`
 * - Expose a translator `useT()` that returns `(key, params?) => string`
 * - Sync the active locale to `<html lang>` and the storage adapter
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { resolveMessage, type MessageCatalog } from "./catalogs/types.js";
import type { AppLocale } from "./locale.js";

export type CatalogByLocale = Readonly<Record<AppLocale, MessageCatalog>>;

export type StorageAdapter = {
  write: (locale: AppLocale) => void;
  read: () => AppLocale | null;
};

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  catalog: MessageCatalog;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export type I18nProviderProps = {
  catalogs: CatalogByLocale;
  initialLocale: AppLocale;
  storageAdapter?: StorageAdapter;
  children: ReactNode;
};

/**
 * Live provider for the app root. Holds the active locale in React state,
 * syncs it to `<html lang>` and the storage adapter.
 */
export function I18nProvider({
  catalogs,
  initialLocale,
  storageAdapter,
  children,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  const setLocale = useCallback(
    (next: AppLocale) => {
      setLocaleState(next);
      storageAdapter?.write(next);
      if (typeof document !== "undefined") {
        document.documentElement.lang = next;
      }
    },
    [storageAdapter],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      catalog: catalogs[locale],
      t: (key, params) => resolveMessage(catalogs[locale], key, params),
    }),
    [locale, setLocale, catalogs],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * A plain provider used by tests. It does not sync to the DOM or to
 * storage; the consumer fully controls the locale.
 */
export function StaticI18nProvider({
  catalogs,
  locale,
  children,
}: {
  catalogs: CatalogByLocale;
  locale: AppLocale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: () => {
        /* noop */
      },
      catalog: catalogs[locale],
      t: (key, params) => resolveMessage(catalogs[locale], key, params),
    }),
    [catalogs, locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): AppLocale {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used inside an I18nProvider");
  return ctx.locale;
}

export function useSetLocale(): (next: AppLocale) => void {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useSetLocale must be used inside an I18nProvider");
  return ctx.setLocale;
}

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside an I18nProvider");
  return ctx.t;
}

export function useCatalog(): MessageCatalog {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useCatalog must be used inside an I18nProvider");
  return ctx.catalog;
}
