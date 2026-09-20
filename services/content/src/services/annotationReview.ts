/**
 * @file services/annotationReview
 * @description Apply an approve/reject decision to a pending annotation atomically.
 *
 * Responsibilities:
 * - `applyAnnotationDecision`: claim the annotation row via the `status: 'pending'` filter, then stamp the reviewer identity and optional agent note in a single update.
 * - Distinguish "already reviewed" from "missing" so callers get the precise error code.
 *
 * Invariant: the `status: 'pending'` filter on the `updateMany` is the only thing preventing two
 * reviewers from approving the same row at the same time; do not weaken it without restoring the
 * alternative lock.
 */
import type { PrismaClient } from '@prisma/client';
import { badRequest, notFound } from '@grimoire/foundation';

export async function applyAnnotationDecision(
  prisma: PrismaClient,
  input: {
    id: string;
    status: 'approved' | 'rejected';
    reviewBy: string;
    reviewerId: string;
    agentNote?: string;
  },
) {
  const claimed = await prisma.annotation.updateMany({
    where: { id: input.id, status: 'pending' },
    data: {
      status: input.status,
      reviewBy: input.reviewBy,
      reviewedAt: new Date(),
      reviewerId: input.reviewerId,
      ...(input.agentNote != null ? { agentNote: input.agentNote } : {}),
    },
  });
  if (claimed.count === 0) {
    const existing = await prisma.annotation.findUnique({ where: { id: input.id } });
    if (!existing) throw notFound('批注不存在');
    throw badRequest('该批注已审核');
  }
  return prisma.annotation.findUniqueOrThrow({ where: { id: input.id } });
}
