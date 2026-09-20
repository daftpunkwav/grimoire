/**
 * @file hoverCache
 * @description Server-side L2 cache for hover explanations.
 *
 * Responsibilities:
 * - Default TTL 2h — reuses hot-session results, controls LLM cost.
 * - High-hit entries (`hits >= 8`) extend to 24h — fewer LLM calls for hot topics.
 * - Past the hard retention cap, entries are dropped unconditionally.
 * - Quality-gate every value with `isCompleteHoverAnswer` before write; aborts/partials never enter the cache.
 * - Throttled prune (R-12) every 30 minutes with a 7-day hard retention.
 *
 * Factory injects `PrismaClient`; only the agent-owned `HoverExplainCache` table is touched.
 */
import { createHash } from 'node:crypto';
import { logger } from '@grimoire/foundation';
import { isSafeHoverPublicAnswer } from '@grimoire/contracts';

const HOVER_CACHE_TTL_DEFAULT_MS = 2 * 60 * 60 * 1000;
const HOVER_CACHE_TTL_HOT_MS = 24 * 60 * 60 * 1000;
const HOVER_CACHE_HOT_HITS = 8;

/**
 * Cache key version: bump when semantics or style affect cached content
 * (history: v1 had no style dimension → v7 plugged prompt-leak → v8 strips token-truncated tails like "...because fine-tuning is.").
 * After a bump, old keys expire naturally — no manual purge needed.
 * Note: the backend key (sha256, stored) differs from the front-end L1 key (plain `style::topic`).
 * L1 and L2 are queried independently, so the two keys need not match; L1 is unversioned and falls away with each L2 bump.
 */
const HOVER_CACHE_KEY_VERSION = 'v8';

export function createHoverCache(prisma: import('@prisma/client').PrismaClient) {
  function hoverCacheKey(topic: string, style: string): string {
    const norm = topic.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 400);
    return createHash('sha256').update(`${HOVER_CACHE_KEY_VERSION}::${style}::${norm}`).digest('hex').slice(0, 48);
  }

  async function getHoverCache(topic: string, style: string): Promise<string | null> {
    const key = hoverCacheKey(topic, style);
    const row = await prisma.hoverExplainCache.findUnique({ where: { cacheKey: key } });
    if (!row) {
      logger.info({ event: 'hover_cache_miss', key }, 'hover cache miss');
      return null;
    }
    // Quality gate: historical dirty rows (containing thinking process) are deleted outright to stop repeated poisoning.
    if (!isSafeHoverPublicAnswer(row.answer)) {
      logger.warn({ event: 'hover_cache_dirty', key }, 'hover cache dirty row dropped');
      void prisma.hoverExplainCache
        .delete({ where: { cacheKey: key } })
        .catch((e) => logger.warn({ err: String(e), key }, 'hover cache: drop dirty row failed'));
      return null;
    }
    const age = Date.now() - row.updatedAt.getTime();
    const ttl = row.hits >= HOVER_CACHE_HOT_HITS ? HOVER_CACHE_TTL_HOT_MS : HOVER_CACHE_TTL_DEFAULT_MS;
    if (age > ttl) {
      logger.info({ event: 'hover_cache_expired', key }, 'hover cache expired');
      return null;
    }
    logger.info({ event: 'hover_cache_hit', key, hits: row.hits }, 'hover cache hit');
    void prisma.hoverExplainCache
      .update({ where: { cacheKey: key }, data: { hits: { increment: 1 } } })
      .catch((e) => logger.warn({ err: String(e), key }, 'hover cache: hits increment failed'));
    return row.answer;
  }

  async function setHoverCache(topic: string, style: string, answer: string) {
    if (!isSafeHoverPublicAnswer(answer)) return;
    const key = hoverCacheKey(topic, style);
    try {
      await prisma.hoverExplainCache.upsert({
        where: { cacheKey: key },
        create: { cacheKey: key, topic: topic.slice(0, 200), answer: answer.slice(0, 1200) },
        update: { answer: answer.slice(0, 1200), topic: topic.slice(0, 200) },
      });
    } catch (e) {
      // Cache write failures must not affect the main path, but they must leave a trail so repeated failures are visible.
      logger.warn({ err: String(e), key }, 'hover cache: write failed');
    }
  }

  /**
   * R-06: cache read isolation — read failures count as a miss (return null) and the caller falls back to the LLM.
   * The cache is an optimization layer; it must never become a single point of failure on the critical path.
   */
  async function getHoverCacheSafe(topic: string, style: string): Promise<string | null> {
    maybePruneHoverCache();
    try {
      return await getHoverCache(topic, style);
    } catch (e) {
      logger.warn({ err: String(e) }, 'hover cache: read failed, degrade to LLM path');
      return null;
    }
  }

  /**
   * R-12: throttled prune of expired hover cache entries (at most once per 30 minutes, non-blocking on the main path).
   * Reuses the B-07 throttle pattern from `agentConversation.ts`; 7-day hard retention so keys that are never re-queried do not linger forever.
   */
  let lastPruneAt = 0;
  const PRUNE_INTERVAL_MS = 30 * 60 * 1000;
  const HARD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7-day hard retention.

  function maybePruneHoverCache(): void {
    const now = Date.now();
    if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
    lastPruneAt = now;
    void prisma.hoverExplainCache
      .deleteMany({ where: { updatedAt: { lt: new Date(now - HARD_RETENTION_MS) } } })
      .then((r) => r.count && logger.info({ event: 'hover_cache_prune', count: r.count }, 'hover cache pruned'))
      .catch((e) => logger.warn({ err: String(e) }, 'hover cache prune failed'));
  }

  return { hoverCacheKey, getHoverCache, getHoverCacheSafe, setHoverCache };
}

export type HoverCache = ReturnType<typeof createHoverCache>;
