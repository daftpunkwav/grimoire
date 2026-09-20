/**
 * @file repositories
 * @description Cross-service article lookups that satisfy the composition root's `ArticleQueryPort`.
 *
 * Responsibilities:
 * - `getArticleBySlug`: published-only lookup used by the agent runtime to ground citations.
 * - `getArticleMetaBySlug`: lightweight lookup that ignores publish status (admin/editor paths).
 * - `getArticlesByIds`: batched `{ id, title, slug }` fetch for cross-domain serializers (community topics, etc.).
 * - `getArticleIdBySlug`: slug → id resolution used when a route accepts a slug but needs to write an FK.
 * - `searchArticles`: case-insensitive contains search over title/summary/slug with a publication-date sort.
 *
 * Boundary: only content-owned tables are touched (`Article`, `Domain`, `AnimationDef`,
 * `ArticleAnimation`, `Annotation`). Contract types live in `@core/contracts` and are
 * re-implemented here directly so we don't redeclare the interface.
 */
import type { PrismaClient } from '@prisma/client';
import type { ArticleQueryPort } from '@core/contracts';

export type { ArticleQueryPort };

export function createContentRepository(prisma: PrismaClient): ArticleQueryPort {
  return {
    async getArticleBySlug(slug) {
      const a = await prisma.article.findFirst({
        where: { slug, status: 'published' },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          markdown: true,
          category: true,
          level: true,
        },
      });
      return a ?? null;
    },

    async getArticleMetaBySlug(slug) {
      const a = await prisma.article.findFirst({
        where: { slug },
        select: { id: true, slug: true, title: true },
      });
      return a ?? null;
    },

    async getArticlesByIds(ids) {
      const uniq = [...new Set(ids.filter(Boolean))];
      if (!uniq.length) return [];
      const rows = await prisma.article.findMany({
        where: { id: { in: uniq } },
        select: { id: true, title: true, slug: true },
      });
      return rows;
    },

    async getArticleIdBySlug(slug) {
      const a = await prisma.article.findFirst({ where: { slug }, select: { id: true } });
      return a?.id ?? null;
    },

    async searchArticles(q, take) {
      const items = await prisma.article.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
            { slug: { contains: q } },
          ],
        },
        select: { title: true, slug: true, summary: true, category: true, level: true },
        orderBy: { publishedAt: 'desc' },
        take,
      });
      return items;
    },
  };
}
