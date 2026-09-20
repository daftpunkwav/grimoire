/**
 * @file catalogs/types
 * @description Shared types for the i18n catalog layer.
 *
 * Responsibilities:
 * - Define `MessageCatalog` as the structural contract that the `en` catalog
 *   is type-pinned against, while `zh-CN` is the source of truth
 * - Define the `t()` function shape: dot-key lookup, `{param}` interpolation,
 *   explicit fallback chain
 */

export type MessageValue = string;

export type MessageCatalog = {
  readonly [namespace: string]: {
    readonly [key: string]: MessageValue | ((params: Record<string, string | number>) => string);
  };
};

/**
 * Lookup a key in a catalog. Returns `⟦key⟧` on miss in dev, the raw key in
 * production. Never returns an empty string silently.
 */
export function resolveMessage(
  catalog: MessageCatalog,
  key: string,
  params?: Record<string, string | number>,
): string {
  const segments = key.split(".");
  let cur: unknown = catalog;
  for (const seg of segments) {
    if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return devFallback(key);
    }
  }
  if (typeof cur === "function") {
    return (cur as (p: Record<string, string | number>) => string)(params ?? {});
  }
  if (typeof cur === "string") {
    return interpolate(cur, params ?? {});
  }
  return devFallback(key);
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, name) => {
    if (name in params) return String(params[name]);
    return `{${name}}`;
  });
}

function devFallback(key: string): string {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${key}`);
    return `\u27e6${key}\u27e7`;
  }
  return key;
}
