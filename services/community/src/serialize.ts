/**
 * @file serialize
 * @description DTO mappers from Prisma `Topic` rows to the `TopicSummary` contract.
 *
 * Responsibilities:
 * - `toTopicSummary`: project a `Topic` plus its joined author and article summary into `TopicSummary`, honoring an optional `bodyMax` truncation.
 * - `attachTopicRefs`: batched fan-out to user and article ports to enrich a list of `Topic` rows with author names and linked article metadata.
 *
 * Invariant: the projection is locked to the `TopicSummary` contract fields; deviations from the
 * contract must be caught here, not silently dropped downstream.
 */
import type { Topic } from '@prisma/client';
import type { TopicSummary } from '@core/contracts';
import type { UserSummary } from '@core/contracts';

/** Topic serializer (independent of Prisma joins; bound to the `TopicSummary` contract to prevent silent drift). */
export function toTopicSummary(
  t: {
    id: string;
    title: string;
    body: string;
    kind: string;
    status: string;
    articleId: string | null;
    createdAt: Date;
    author: UserSummary;
    article: { id: string; slug: string; title: string } | null;
    replyCount?: number;
  },
  opts?: { bodyMax?: number },
): TopicSummary {
  const body = opts?.bodyMax ? t.body.slice(0, opts.bodyMax) : t.body;
  return {
    id: t.id,
    title: t.title,
    body,
    kind: t.kind as TopicSummary['kind'],
    status: t.status,
    articleId: t.articleId,
    article: t.article ?? null,
    author: t.author,
    replyCount: t.replyCount ?? 0,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Batched author + linked-article attach (cross-service boundary: no `join user/article`, go through the injected ports). */
export async function attachTopicRefs(
  rows: Topic[],
  deps: { users: Pick<import('@core/contracts').UserSummaryPort, 'getUserSummaries'>; articles: Pick<import('@core/contracts').ArticleQueryPort, 'getArticlesByIds'> },
): Promise<TopicSummary[]> {
  const [authors, articles] = await Promise.all([
    deps.users.getUserSummaries(rows.map((r) => r.authorId)),
    deps.articles.getArticlesByIds(rows.map((r) => r.articleId).filter(Boolean) as string[]),
  ]);
  const authorName = new Map(authors.map((a) => [a.id, a.name]));
  const articleMeta = new Map(articles.map((a) => [a.id, a]));
  return rows.map((r) =>
    toTopicSummary({
      id: r.id,
      title: r.title,
      body: r.body,
      kind: r.kind,
      status: r.status,
      articleId: r.articleId,
      createdAt: r.createdAt,
      author: { id: r.authorId, name: authorName.get(r.authorId) || '未知' },
      article: r.articleId && articleMeta.has(r.articleId) ? articleMeta.get(r.articleId)! : null,
    }),
  );
}
