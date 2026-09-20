/**
 * @file agentMemory
 * @description User-context loading and topic/preference memory for the agent domain.
 *
 * Responsibilities:
 * - Load user context (style, memory block, BYOK) with a 60s in-process TTL cache (R-11).
 * - Invalidate the per-user context cache on settings changes.
 * - Track recently seen topics (`seen:` keys) and surface them in the memory block.
 * - Save important preferences when the user explicitly asks ("remember…"), with stable hash keys (B-08) and a per-user cap.
 *
 * Boundary: the factory injects `PrismaClient`, `UserQueryPort` (preferences), and `ArticleQueryPort` (progress titles).
 * This module never touches the `user` or `article` tables directly — preferences go through the users port and titles through the articles port.
 */
import { createHash } from 'node:crypto';
import { logger } from '@grimoire/foundation';
import type { ByokConfig } from '@grimoire/contracts';
import { formatMemoryBlock } from '../lib/agentPrompt.js';
import type { UserQueryPort, ArticleQueryPort } from '../ports.js';
import { getDefaultUserContextCache } from './userContextCache.js';

const MAX_PREF_MEMORIES = 20;

/** Return type of `loadUserContext`; used to constrain the in-process short-cache generic. */
export type UserCtx = {
  style: string;
  memoryBlock: string;
  byok: ByokConfig | null;
};

export function createAgentMemory(
  prisma: import('@prisma/client').PrismaClient,
  users: UserQueryPort,
  articles: ArticleQueryPort,
) {
  /**
   * R-11: short in-process TTL cache (60s) for the hot hover path.
   * Each `loadUserContext` runs several queries plus BYOK decryption, while memory and progress almost never change within 60s.
   * Settings changes must call `invalidateUserContext` proactively; for multi-replica deployments the TTL is the worst-case divergence window (documented).
   */
  const ctxCache = getDefaultUserContextCache<UserCtx>();

  function invalidateUserContext(userId: string): void {
    ctxCache.deleteByPrefix(`${userId}::`);
  }

  /** Short-cache wrapper: anonymous users and cache misses fall through to the real loader. */
  async function loadUserContext(userId?: string, route?: string): Promise<UserCtx> {
    if (!userId) return loadUserContextInner(userId, route);
    const key = `${userId}::${route || ''}`;
    const hit = ctxCache.get(key);
    if (hit) return hit;
    const value = await loadUserContextInner(userId, route);
    ctxCache.set(key, value);
    return value;
  }

  /** Enforce the `pref:` prefix memory cap; trim the oldest entries by `updatedAt` when over the cap (B-08). */
  async function trimPrefMemories(userId: string) {
    try {
      const count = await prisma.agentMemory.count({
        where: { userId, key: { startsWith: 'pref:' } },
      });
      if (count <= MAX_PREF_MEMORIES) return;
      const overflow = await prisma.agentMemory.findMany({
        where: { userId, key: { startsWith: 'pref:' } },
        orderBy: { updatedAt: 'asc' },
        take: count - MAX_PREF_MEMORIES,
        select: { id: true },
      });
      if (overflow.length) {
        await prisma.agentMemory.deleteMany({
          where: { id: { in: overflow.map((m) => m.id) } },
        });
      }
    } catch (e) {
      logger.warn({ err: String(e), userId }, 'trim pref memories failed');
    }
  }

  async function maybeSaveImportantMemory(
    userId: string | undefined,
    userMsg: string,
    answer: string,
  ) {
    if (!userId) return;
    // User explicitly asked to remember something / stated a preference.
    if (/请记住|记住：|我的偏好|以后.*用/.test(userMsg)) {
      // B-08: stable hash key — repeated writes of the same message overwrite instead of growing the table.
      const key = `pref:${createHash('sha256').update(userMsg).digest('hex').slice(0, 16)}`;
      try {
        await prisma.agentMemory.upsert({
          where: { userId_key: { userId, key } },
          create: {
            userId,
            key,
            value: `${userMsg.slice(0, 120)} → ${answer.slice(0, 200)}`,
            kind: 'preference',
          },
          update: { value: `${userMsg.slice(0, 120)} → ${answer.slice(0, 200)}` },
        });
        await trimPrefMemories(userId);
      } catch (e) {
        logger.warn({ err: String(e), userId }, 'save important memory failed');
      }
    }
  }

  async function loadUserContextInner(userId?: string, route?: string) {
    if (!userId) {
      return {
        style: 'professional',
        memoryBlock: formatMemoryBlock({
          mastered: [],
          learning: [],
          notes: [],
          route,
        }),
        byok: null as ByokConfig | null,
      };
    }
    const prefs = await users.getUserPreferences(userId);
    const style = (typeof prefs?.agentStyle === 'string' && prefs.agentStyle) || 'professional';
    // A-03: stored as ciphertext; the plaintext key is only decrypted inside the llm gateway's `byokToProvider` — agent never holds the key.
    const byok = prefs?.byok ?? null;

    const [memories, progress] = await Promise.all([
      prisma.agentMemory.findMany({ where: { userId }, take: 40, orderBy: { updatedAt: 'desc' } }),
      prisma.learningProgress.findMany({
        where: { userId },
        take: 50,
      }),
    ]);

    // Cross-service title lookup: progress stores only `articleId`; titles come through the content port.
    const articleIds = progress.map((p) => p.articleId);
    const articleMeta = await articles.getArticlesByIds(articleIds);
    const titleById = new Map(articleMeta.map((a) => [a.id, a.title]));

    const mastered = progress
      .filter((p) => p.mastery === 'mastered' || p.progress >= 0.85)
      .map((p) => titleById.get(p.articleId) || '')
      .filter(Boolean);
    const learning = progress
      .filter((p) => p.mastery !== 'mastered' && p.progress < 0.85)
      .map((p) => titleById.get(p.articleId) || '')
      .filter(Boolean);
    const notes = memories
      .filter((m) => m.kind !== 'fact' || !m.key.startsWith('seen:'))
      .map((m) => `${m.key}: ${m.value.slice(0, 120)}`);
    const recentTopics = memories
      .filter((m) => m.key.startsWith('seen:'))
      .map((m) => m.value.replace(/^用户.*?：/, '').slice(0, 40))
      .slice(0, 8);

    return {
      style,
      byok,
      memoryBlock: formatMemoryBlock({
        style,
        mastered,
        learning,
        notes,
        recentTopics,
        route,
      }),
    };
  }

  async function rememberTopic(userId: string | undefined, topic: string, mode: string) {
    if (!userId || !topic.trim()) return;
    const key = `seen:${topic.slice(0, 80)}`;
    try {
      await prisma.agentMemory.upsert({
        where: { userId_key: { userId, key } },
        create: {
          userId,
          key,
          value: `用户在 ${mode} 模式询问过：${topic.slice(0, 200)}`,
          kind: 'fact',
        },
        update: {
          value: `用户再次询问（${mode}）：${topic.slice(0, 200)}`,
          kind: 'fact',
        },
      });
    } catch (e) {
      // Fire-and-forget write: never break the main path, but leave a trail for repeated failures.
      logger.warn({ err: String(e), userId }, 'remember topic failed');
    }
  }

  return {
    invalidateUserContext,
    loadUserContext,
    maybeSaveImportantMemory,
    rememberTopic,
  };
}

export type AgentMemory = ReturnType<typeof createAgentMemory>;
