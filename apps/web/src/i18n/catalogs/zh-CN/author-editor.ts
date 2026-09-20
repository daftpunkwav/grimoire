/**
 * @file i18n/catalogs/zh-CN/author-editor
 * @description Author dashboard, article editor, animation editor.
 */
export const authorEditor = {
  needAuthor: {
    title: "\u9700\u8981\u4f5c\u8005\u6743\u9650",
    description: "\u4ec5\u4f5c\u8005\u53ef\u4ee5\u53d1\u5e03\u6587\u7ae0\u4e0e\u52a8\u753b\u3002",
    goApply: "\u7533\u8bf7\u6210\u4e3a\u4f5c\u8005",
  },
  article: {
    notFound: "\u6587\u7ae0\u4e0d\u5b58\u5728",
    newArticle: "\u65b0\u5efa\u6587\u7ae0",
    editArticle: "\u7f16\u8f91\u6587\u7ae0",
    new: "+ \u65b0\u5efa\u6587\u7ae0",
    status: "\u72b6\u6001\uff1a{status}",
    fields: {
      title: "\u6807\u9898",
      slug: "Slug\uff08\u53ef\u9009\uff09",
      slugAuto: "\u81ea\u52a8\u751f\u6210",
      category: "\u5206\u7c7b",
      difficulty: "\u96be\u5ea6",
      engineering: "\u5de5\u7a0b\u5b9e\u8df5",
    },
    difficulty: {
      intro: "\u5165\u95e8",
      intermediate: "\u4e2d\u7ea7",
      advanced: "\u9ad8\u7ea7",
    },
    actions: {
      saveDraft: "\u4fdd\u5b58\u8349\u7a3f",
      publish: "\u53d1\u5e03",
      loadFailed: "\u52a0\u8f7d\u5931\u8d25",
      saveFailed: "\u4fdd\u5b58\u5931\u8d25",
      submitFailed: "\u63d0\u4ea4\u5931\u8d25",
    },
  },
  animation: {
    untitled: "\u672a\u547d\u540d\u52a8\u753b",
    needOneStep: "\u81f3\u5c11\u9700\u8981\u4e00\u6b65",
    loadFailed: "\u52a0\u8f7d\u5931\u8d25",
  },
} as const;
