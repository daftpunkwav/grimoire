/**
 * @file repositories
 * @description Cross-service user lookups that satisfy the composition root's `UserQueryPort`.
 *
 * Responsibilities:
 * - `getUserSummaries`: batched `{ id, name }` fetch for downstream serializers (content/community authors).
 * - `getUserPreferences`: single-user preference read with the BYOK ciphertext still encrypted (the LLM gateway decrypts).
 * - `createIdentityRepository`: adapter implementing `UserQueryPort` so the host never hand-rolls the shape.
 *
 * Boundary: only identity-owned tables are touched (`User`, `RefreshToken`, `AuthorApplication`).
 * When the service becomes its own process, replace these functions with HTTP clients; the
 * internal call sites do not change.
 */
import type { PrismaClient } from '@prisma/client';
import { parsePrefs } from '@grimoire/foundation';
import type { ByokConfig, UserQueryPort } from '@grimoire/contracts';

/** Batched user summaries used by content/community serializers when attaching authors. */
export async function getUserSummaries(
  prisma: PrismaClient,
  ids: string[],
): Promise<{ id: string; name: string }[]> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, name: true },
  });
  return rows;
}

/**
 * Composition-root adapter for `UserQueryPort` (mirrors `createContentRepository`).
 * The identity service owns identity lookups, so the host stops hand-rolling object literals;
 * when the service becomes its own process, swap this adapter for an HTTP-backed client.
 */
export function createIdentityRepository(prisma: PrismaClient): UserQueryPort {
  return {
    getUserSummaries: (ids: string[]) => getUserSummaries(prisma, ids),
    getUserPreferences: (userId: string) => getUserPreferences(prisma, userId),
  };
}

/** Single-user preferences (BYOK ciphertext included; the LLM gateway decrypts). Returns `null` when the user is missing. */
export async function getUserPreferences(
  prisma: PrismaClient,
  userId: string,
): Promise<{
  agentStyle?: string;
  autoplayAnim?: boolean;
  animSpeed?: number;
  byok?: ByokConfig | null;
} | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const prefs = parsePrefs(user.preferences);
  return {
    agentStyle: typeof prefs.agentStyle === 'string' ? prefs.agentStyle : undefined,
    autoplayAnim: typeof prefs.autoplayAnim === 'boolean' ? prefs.autoplayAnim : undefined,
    animSpeed: typeof prefs.animSpeed === 'number' ? prefs.animSpeed : undefined,
    byok: (prefs.byok as ByokConfig | undefined) ?? null,
  };
}
