/**
 * @file i18n/catalogs/en/article
 * @description Article page, layout, body, table of contents.
 */
import type { MessageCatalog } from "../types.js";

export const article = {
  notFound: {
    title: "Article not found",
    description: "Please enter from the knowledge overview.",
    back: "Back to knowledge overview",
  },
  layout: {
    toc: "Table of contents",
    discussion: "Discussion",
    discussionLink: "Post about this article \u2192",
    topicsLink: "Go to topics \u2192",
  },
  body: {
    animationFallback: "{template} demo",
    loadingAnimation: "Loading\u2026",
  },
} as const satisfies MessageCatalog["article"];
