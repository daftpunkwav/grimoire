/**
 * @file agentConversation
 * @description Conversation lifecycle and message persistence for the agent domain.
 *
 * Responsibilities:
 * - Ensure a conversation exists with the correct ACL (logged-in user, or guest with matching `guestKey`).
 * - Throttle (B-07) the purge of expired guest conversations so high-concurrency traffic does not trigger full-table scans every request.
 * - Persist a turn and roll up the oldest messages into `conversation.summary` once the per-conversation message count exceeds the cap.
 * - Generate a 24-byte `guestKey` for new guest conversations (clients must persist and resend it).
 *
 * Guest conversations require `guestKey` matching to prevent IDOR via bare `conversationId`.
 * Factory injects `PrismaClient`; only agent-owned tables (`AgentConversation`, `AgentMessage`) are touched.
 */
import { randomBytes } from 'node:crypto';
import { logger } from '@core/foundation';

const GUEST_CONV_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createAgentConversation(prisma: import('@prisma/client').PrismaClient) {
  /** Purge expired guest conversations (cascades to their messages). */
  async function purgeExpiredGuestConversations() {
    await prisma.agentConversation.deleteMany({
      where: {
        userId: null,
        expiresAt: { lt: new Date() },
      },
    });
  }

  let lastPurgeAt = 0;
  const PURGE_INTERVAL_MS = 10 * 60 * 1000;

  /** Throttled purge of expired guest conversations (B-07): at most once per 10 minutes so high concurrency does not trigger full-table scans on every request. */
  async function maybePurgeGuestConversations() {
    const now = Date.now();
    if (now - lastPurgeAt < PURGE_INTERVAL_MS) return;
    lastPurgeAt = now;
    try {
      await purgeExpiredGuestConversations();
    } catch (e) {
      logger.warn({ err: String(e) }, 'guest conversation purge failed');
    }
  }

  /** Generate a 24-byte `guestKey` for a new guest conversation (the client must persist and resend it). */
  function createGuestKey(): string {
    return randomBytes(24).toString('base64url');
  }

  /**
   * Ensure a conversation exists and passes the ACL check.
   * - Logged-in user: must own the conversation.
   * - Guest: must present a matching `guestKey`; legacy conversations without one cannot be resumed (IDOR guard).
   */
  async function ensureConversation(
    userId: string | undefined,
    opts?: EnsureConversationOpts | string,
  ) {
    // Backward-compatible with the legacy signature `ensureConversation(userId, conversationId?)`.
    const options: EnsureConversationOpts =
      typeof opts === 'string' ? { conversationId: opts } : opts || {};
    const { conversationId, guestKey } = options;

    void maybePurgeGuestConversations();

    if (conversationId) {
      const existing = await prisma.agentConversation.findUnique({ where: { id: conversationId } });
      if (existing) {
        if (userId) {
          if (existing.userId === userId) return existing;
          // Another user's conversation → create a new one.
        } else if (!existing.userId) {
          // Guest: expired → create a new one.
          if (existing.expiresAt && existing.expiresAt.getTime() < Date.now()) {
            // fall through
          } else if (existing.guestKey && guestKey && existing.guestKey === guestKey) {
            return existing;
          } else if (!existing.guestKey) {
            // Legacy guest conversation without a `guestKey`: cannot be resumed (close the IDOR surface).
            // fall through to create
          }
          // `guestKey` mismatch → create a new one.
        }
      }
    }

    const data: {
      userId: string | null;
      title: string;
      expiresAt: Date | null;
      guestKey?: string | null;
    } = {
      userId: userId || null,
      title: '对话',
      expiresAt: userId ? null : new Date(Date.now() + GUEST_CONV_TTL_MS),
    };
    if (!userId) {
      data.guestKey = guestKey?.trim() || createGuestKey();
    }
    return prisma.agentConversation.create({ data });
  }

  async function loadRecentMessages(conversationId: string, take = 12) {
    return prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async function persistTurn(
    conversationId: string,
    userMsg: string,
    assistant: { content: string; thinking?: string },
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.agentMessage.createMany({
        data: [
          { conversationId, role: 'user', content: userMsg.slice(0, 4000) },
          {
            conversationId,
            role: 'assistant',
            content: assistant.content.slice(0, 8000),
            thinking: (assistant.thinking || '').slice(0, 4000),
          },
        ],
      });
      const count = await tx.agentMessage.count({ where: { conversationId } });
      if (count > 24) {
        const old = await tx.agentMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
          take: 8,
        });
        const snippet = old
          .map((m) => `${m.role}: ${m.content.slice(0, 80)}`)
          .join(' | ')
          .slice(0, 500);
        const conv = await tx.agentConversation.findUnique({
          where: { id: conversationId },
          select: { summary: true },
        });
        const merged = [conv?.summary, snippet].filter(Boolean).join(' | ');
        const summary = merged.length <= 500 ? merged : merged.slice(merged.length - 500);
        await tx.agentConversation.update({
          where: { id: conversationId },
          data: { summary, updatedAt: new Date() },
        });
        if (old.length) {
          await tx.agentMessage.deleteMany({
            where: { id: { in: old.map((m) => m.id) } },
          });
        }
      } else {
        await tx.agentConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      }
    });
  }

  return { createGuestKey, ensureConversation, loadRecentMessages, persistTurn };
}

export type AgentConversation = ReturnType<typeof createAgentConversation>;

export type EnsureConversationOpts = {
  conversationId?: string;
  /** Required for guests (new or resumed); ignored for logged-in users. */
  guestKey?: string;
};
