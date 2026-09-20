/**
 * @file searchArticles
 * @description Tool factory that searches published articles by keyword and returns a compact summary list.
 *
 * Responsibilities:
 * - Define the search_articles Zod schema (keyword + optional take).
 * - Inject the ArticleQueryPort; the host composition root supplies the content backend.
 * - Project each hit down to title/slug/summary/category/level so the model never sees full Markdown.
 *
 * No file system or network I/O lives here; all access goes through the port.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import type { ArticleQueryPort } from '../../ports.js';

export const searchArticlesSchema = z.object({
  q: z.string().min(1).max(200),
  take: z.number().int().min(1).max(20).optional(),
});

/** Factory: inject the article-query port (the host composition root supplies the content backend). */
export function createSearchArticlesTool(articles: ArticleQueryPort): ToolDefinition {
  return {
    name: 'search_articles',
    description: '按关键词检索已发布文章（标题/摘要）',
    schema: searchArticlesSchema,
    async execute(args) {
      const { q, take: takeOpt } = args as z.infer<typeof searchArticlesSchema>;
      const take = takeOpt ?? 8;
      const query = q.trim();
      const items = await articles.searchArticles(query, take);
      if (!items.length) {
        return JSON.stringify({ count: 0, items: [], hint: '无匹配已发布文章' });
      }
      return JSON.stringify({
        count: items.length,
        items: items.map((a) => ({
          title: a.title,
          slug: a.slug,
          summary: (a.summary || '').slice(0, 240),
          category: a.category,
          level: a.level,
        })),
      });
    },
  };
}
