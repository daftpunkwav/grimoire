/**
 * @file learningProgress
 * @description Monotonic upsert for the per-user learning progress table with unique-constraint backoff.
 *
 * Responsibilities:
 * - Create or update a `LearningProgress` row, preserving monotonic semantics on both `progress` and `mastery`.
 * - Retry up to twice on `P2002` unique-conflict errors (race when two requests upsert in parallel).
 * - Treat any other error as fatal after retries are exhausted.
 *
 * Article existence is checked by the caller via `ArticleQueryPort`; this module never touches the article table.
 */
import type { PrismaClient } from '@prisma/client';

function isUniqueConflict(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002');
}

export async function upsertLearningProgress(
  prisma: PrismaClient,
  input: { userId: string; articleId: string; progress?: number; mastery?: string },
) {
  const { userId, articleId, progress, mastery } = input;
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await prisma.learningProgress.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });
    const nextProgress =
      progress == null ? (existing?.progress ?? 0.3) : Math.max(existing?.progress ?? 0, progress);
    let nextMastery = mastery || existing?.mastery || 'learning';
    if (existing?.mastery === 'mastered' && nextMastery !== 'mastered') {
      nextMastery = 'mastered';
    }
    try {
      return await prisma.learningProgress.upsert({
        where: { userId_articleId: { userId, articleId } },
        create: { userId, articleId, progress: nextProgress, mastery: nextMastery },
        update: { progress: nextProgress, mastery: nextMastery },
      });
    } catch (e) {
      if (isUniqueConflict(e) && attempt < 2) continue;
      throw e;
    }
  }
  throw new Error('learning progress upsert retries exhausted');
}
