/**
 * @file services/annotationAcl
 * @description ACL helpers for annotation listing, review permission, and reviewer attribution.
 *
 * Responsibilities:
 * - `annotationListWhere`: build the `where` clause for the annotation list endpoint based on viewer role (anonymous / logged-in / article author / admin).
 * - `canReviewAnnotation`: grant review to the article's author or to an admin with `moderation.review`/`admin.full`.
 * - `resolveReviewBy`: stamp the persisted `reviewBy` value (`author` vs `admin`) on approve/reject.
 *
 * Invariants:
 * - Ordinary authors may only review annotations on their own articles; an elite author's
 *   `moderation.review` does NOT extend across articles.
 * - `resolveReviewBy` assumes the ACL has already admitted the caller; the `author` fallback is
 *   a safety net for callers that bypass the ACL.
 */
import { can } from '@grimoire/contracts';
import type { AuthUser } from '@grimoire/foundation';

/** List visibility: anonymous = approved only; logged-in = approved + their own; article author / admin = every row. */
export function annotationListWhere(opts: {
  viewerId?: string;
  isArticleAuthor: boolean;
  isAdmin: boolean;
}): Record<string, unknown> {
  if (opts.isArticleAuthor || opts.isAdmin) return {};
  if (opts.viewerId) {
    return { OR: [{ status: 'approved' }, { userId: opts.viewerId }] };
  }
  return { status: 'approved' };
}

/**
 * Review ACL: the article's author, or an admin holding `moderation.review` / `admin.full`.
 * Ordinary authors may only review annotations on their own articles; an elite author's
 * `moderation.review` does NOT extend across articles.
 */
export function canReviewAnnotation(opts: {
  user: AuthUser;
  articleAuthorId: string;
}): boolean {
  if (opts.user.id === opts.articleAuthorId) return true;
  if (opts.user.role !== 'admin') return false;
  const principal = {
    role: opts.user.role,
    authorTier: opts.user.authorTier,
    adminLevel: opts.user.adminLevel,
  };
  return can(principal, 'moderation.review') || can(principal, 'admin.full');
}

/** Stamp `reviewBy` when persisting a review: article author wins, otherwise admin. */
export function resolveReviewBy(opts: {
  reviewerId: string;
  articleAuthorId: string;
  reviewerRole: string;
}): 'author' | 'admin' {
  if (opts.reviewerId === opts.articleAuthorId) return 'author';
  if (opts.reviewerRole === 'admin') return 'admin';
  // In theory only the author or an admin can review; fall back to `author` defensively.
  return 'author';
}
