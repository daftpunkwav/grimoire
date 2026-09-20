/**
 * @file getArticle
 * @description Tool factory that fetches a single article by slug and truncates its Markdown to keep tool observations bounded.
 *
 * Responsibilities:
 * - Define the get_article Zod schema (slug only).
 * - Cap observation size so tool output cannot blow up the chat context.
 * - Inject the ArticleQueryPort; the host composition root supplies the content backend.
 *
 * No file system or network I/O lives here; all access goes through the port.
 */
import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import type { ArticleQueryPort } from '../../ports.js';

/** Upper bound on the article body returned in an observation; keeps tool output from overflowing the prompt. */
export const GET_ARTICLE_MAX_CHARS = 4000;

export const getArticleSchema = z.object({
  slug: z.string().min(1).max(120),
});

/** Factory: inject the article-query port (the host composition root supplies the content backend). */
export function createGetArticleTool(articles: ArticleQueryPort): ToolDefinition {
  return {
    name: 'get_article',
    description: '按 slug 获取已发布文章 Markdown（截断）',
    schema: getArticleSchema,
    async execute(args) {
      const { slug } = args as z.infer<typeof getArticleSchema>;
      const article = await articles.getArticleBySlug(slug.trim());
      if (!article) {
        return JSON.stringify({ error: '文章不存在或未发布', slug });
      }
      const md = article.markdown || '';
      const truncated = md.length > GET_ARTICLE_MAX_CHARS;
      return JSON.stringify({
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        category: article.category,
        level: article.level,
        markdown: truncated ? md.slice(0, GET_ARTICLE_MAX_CHARS) : md,
        truncated,
        totalChars: md.length,
      });
    },
  };
}
