/**
 * @file services/applicationReview
 * @description Apply an approve/reject decision to a pending `AuthorApplication` atomically.
 *
 * Responsibilities:
 * - `applyApplicationDecision`: claim the application row via `status: 'pending'` filter inside a transaction, then promote the user to the matching role/tier when the decision is `approved`.
 * - Distinguish "already reviewed" from "missing" so callers get the precise error code.
 *
 * Invariant: the `updateMany` guard is the only thing preventing two reviewers from approving
 * the same row at the same time; do not weaken it without restoring the alternative lock.
 */
import type { PrismaClient } from '@prisma/client';
import { badRequest, notFound } from '@core/foundation';

export async function applyApplicationDecision(
  prisma: PrismaClient,
  input: { id: string; status: 'approved' | 'rejected' },
) {
  const { id, status } = input;
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.authorApplication.updateMany({
      where: { id, status: 'pending' },
      data: { status, reviewedAt: new Date(), pendingGuard: null },
    });
    if (claimed.count === 0) {
      const existing = await tx.authorApplication.findUnique({ where: { id } });
      if (!existing) throw notFound('申请不存在');
      throw badRequest('该申请已处理');
    }
    const app = await tx.authorApplication.findUnique({ where: { id } });
    if (!app) throw notFound('申请不存在');
    if (status === 'approved') {
      if (app.kind === 'elite') {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: 'author', authorTier: 'elite' },
        });
      } else {
        await tx.user.update({
          where: { id: app.userId },
          data: { role: 'author', authorTier: 'standard' },
        });
      }
    }
    return app;
  });
}
