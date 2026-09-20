/**
 * @file i18n/catalogs/zh-CN/article
 * @description Article page, layout, body, table of contents.
 */
export const article = {
  notFound: {
    title: "\u6587\u7ae0\u672a\u627e\u5230",
    description: "\u8bf7\u4ece\u77e5\u8bc6\u603b\u89c8\u8fdb\u5165\u3002",
    back: "\u8fd4\u56de\u77e5\u8bc6\u603b\u89c8",
  },
  layout: {
    toc: "\u76ee\u5f55",
    discussion: "\u8ba8\u8bba",
    discussionLink: "\u5c31\u672c\u6587\u53d1\u5e16 \u2192",
    topicsLink: "\u53bb\u8bdd\u9898\u533a \u2192",
  },
  body: {
    animationFallback: "{template} \u6f14\u793a",
    loadingAnimation: "\u52a0\u8f7d\u4e2d\u2026",
  },
} as const;
