/**
 * @file i18n/catalogs/zh-CN/common
 * @description Common user-visible strings (loading states, empty states, generic errors).
 */
export const common = {
  loading: "加载中\u2026",
  empty: {
    articles: "\u6682\u65e0\u6587\u7ae0",
    intro: "\u6682\u65e0\u7b80\u4ecb",
    explain: "\u6682\u65e0\u8bb2\u89e3",
    frames: "\u6682\u65e0\u52a8\u753b\u5e27",
    toc: "\u6b64\u6587\u7ae0\u65e0\u76ee\u5f55",
  },
  error: {
    loadFailed: "\u52a0\u8f7d\u5931\u8d25",
    saveFailed: "\u4fdd\u5b58\u5931\u8d25",
    submitFailed: "\u63d0\u4ea4\u5931\u8d25",
    unknown: "\u53d1\u751f\u672a\u77e5\u9519\u8bef",
  },
  success: {
    saved: "\u5df2\u4fdd\u5b58",
    profileSaved: "\u8d44\u6599\u5df2\u4fdd\u5b58",
    apiKeySaved: "\u5df2\u4fdd\u5b58\uff08API Key \u4ec5\u5b58\u4e8e\u4f60\u7684\u8d26\u53f7\uff0c\u4e0d\u4f1a\u4e0a\u4f20\u670d\u52a1\u5668\uff09",
    cacheCleared: "\u5df2\u6e05\u9664\uff1a\u6d4f\u89c8\u5668\u7f13\u5b58 {l1} \u6761 \u00b7 \u670d\u52a1\u7aef\u7f13\u5b58 {cleared} \u6761",
  },
  view: "\u9605",
} as const;
