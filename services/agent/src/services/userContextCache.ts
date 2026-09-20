/**
 * @file userContextCache
 * @description In-process TTL cache used by the agent for short-TTL user context (60s default).
 *
 * Responsibilities:
 * - Provide a small generic `TtlCache<V>` keyed by string with TTL eviction and LRU-ish oldest-key eviction at the cap.
 * - Hold a single module-level default cache instance injectable via `setDefaultUserContextCache` for tests and future multi-instance evolution.
 *
 * No persistence, no cross-process sharing — pure process-local state.
 */
export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V, at?: number): void;
  deleteByPrefix(prefix: string): void;
  clear(): void;
}

export function createTtlCache<V>(opts: { ttlMs: number; maxEntries: number }): TtlCache<V> {
  const store = new Map<string, { at: number; value: V }>();
  const { ttlMs, maxEntries } = opts;

  return {
    get(key: string): V | undefined {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at >= ttlMs) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: V, at = Date.now()) {
      store.set(key, { at, value });
      if (store.size > maxEntries) {
        const oldest = store.keys().next();
        if (!oldest.done) store.delete(oldest.value);
      }
    },
    deleteByPrefix(prefix: string) {
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
      }
    },
    clear() {
      store.clear();
    },
  };
}

let defaultUserContextCache: TtlCache<unknown> | null = null;

export function getDefaultUserContextCache<V>(): TtlCache<V> {
  if (!defaultUserContextCache) {
    defaultUserContextCache = createTtlCache<V>({ ttlMs: 60_000, maxEntries: 5000 });
  }
  return defaultUserContextCache as TtlCache<V>;
}

export function setDefaultUserContextCache<V>(cache: TtlCache<V> | null): void {
  defaultUserContextCache = cache;
}
