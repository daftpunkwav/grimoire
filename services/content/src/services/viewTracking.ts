/**
 * @file services/viewTracking
 * @description In-process view-count dedup for article reads.
 *
 * Responsibilities:
 * - `createInMemoryViewDedup`: factory for a TTL-based dedup store keyed by a caller-supplied `viewerKey`.
 * - `getDefaultViewDedup`: lazily-initialized singleton shared by every route in the same process.
 * - `setDefaultViewDedup`: test seam to inject or reset the shared store.
 *
 * Invariants:
 * - A given `viewerKey` is counted at most once per `ttlMs` window.
 * - When the cache exceeds `maxEntries`, expired entries are evicted opportunistically on the next call.
 *
 * For multi-instance deployments swap the implementation with a Redis-backed store — the
 * interface stays the same.
 */
export interface ViewDedupStore {
  shouldCount(key: string): boolean;
}

export function createInMemoryViewDedup(opts?: {
  ttlMs?: number;
  maxEntries?: number;
}): ViewDedupStore {
  const ttlMs = opts?.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = opts?.maxEntries ?? 10_000;
  const viewedCache = new Map<string, number>();

  return {
    shouldCount(key: string): boolean {
      const now = Date.now();
      const last = viewedCache.get(key);
      if (last && now - last < ttlMs) return false;
      viewedCache.set(key, now);
      if (viewedCache.size > maxEntries) {
        for (const [k, v] of viewedCache) {
          if (now - v > ttlMs) viewedCache.delete(k);
        }
      }
      return true;
    },
  };
}

/** Default singleton: routes in the same process share dedup state. */
let defaultStore: ViewDedupStore | null = null;

export function getDefaultViewDedup(): ViewDedupStore {
  if (!defaultStore) defaultStore = createInMemoryViewDedup();
  return defaultStore;
}

/** Test-only seam: inject or reset the shared store. */
export function setDefaultViewDedup(store: ViewDedupStore | null): void {
  defaultStore = store;
}
