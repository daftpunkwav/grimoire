/**
 * @file articleLink
 * @description Resolve a topic's linked-article input (`articleId` or `articleSlug`) through the `ArticleQueryPort`.
 *
 * Responsibilities:
 * - `resolveLinkedArticleId`: accept either an id or a slug, validate against the injected article port, and return the canonical article id (or `null` when neither is supplied).
 *
 * Invariant: bare `articleId` writes are forbidden — every id must round-trip through the article port
 * so the community service never trusts an FK without verifying it exists in the content domain.
 */
import { badRequest } from '@grimoire/foundation';
import type { ArticleQueryPort } from '@grimoire/contracts';

export async function resolveLinkedArticleId(
  articles: Pick<ArticleQueryPort, 'getArticleIdBySlug' | 'getArticlesByIds'>,
  input: { articleId?: string | null; articleSlug?: string },
): Promise<string | null> {
  if (input.articleId) {
    const found = await articles.getArticlesByIds([input.articleId]);
    if (!found.length) throw badRequest('关联文章不存在');
    return found[0].id;
  }
  if (input.articleSlug) {
    const id = await articles.getArticleIdBySlug(input.articleSlug);
    if (!id) throw badRequest('关联文章不存在');
    return id;
  }
  return null;
}
