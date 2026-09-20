/**
 * @file i18n/catalogs/zh-CN/shell
 * @description AppShell, navigation, error boundary, router 404.
 */
export const shell = {
  nav: {
    home: "\u9996\u9875",
    knowledge: "Agent \u77e5\u8bc6",
    llm: "LLM \u57fa\u7840",
    topics: "\u8bdd\u9898",
    news: "\u524d\u6cbf\u8d44\u8baf",
    agent: "Agent \u52a9\u624b",
    profile: "\u4e2a\u4eba\u4e3b\u9875",
    settings: "\u8bbe\u7f6e",
    authorDashboard: "\u4f5c\u8005\u5de5\u4f5c\u53f0",
    adminDomains: "\u9886\u57df\u7ba1\u7406",
    adminApplications: "\u4f5c\u8005\u7533\u8bf7\u5ba1\u6279",
    login: "\u767b\u5f55",
    register: "\u6ce8\u518c",
    logout: "\u9000\u51fa",
  },
  notFound: {
    title: "\u9875\u9762\u4e0d\u5b58\u5728",
    description: "\u4f60\u8bbf\u95ee\u7684\u5730\u5740\u6ca1\u6709\u5339\u914d\u7684\u9875\u9762",
    goHome: "\u8fd4\u56de\u9996\u9875",
  },
  errorBoundary: {
    title: "\u9875\u9762\u51fa\u9519",
    description: "\u9875\u9762\u52a0\u8f7d\u51fa\u9519\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5\u3002",
  },
} as const;
