/**
 * @file i18n/catalogs/zh-CN/auth
 * @description Login, register, author application copy.
 */
export const auth = {
  loginTitle: "\u767b\u5f55 {name}",
  loginSubtitle: "\u767b\u5f55\u540e\u53ef\u8ddf\u8e2a\u5b66\u4e60\u8fdb\u5ea6\u5e76\u7533\u8bf7\u6210\u4e3a\u4f5c\u8005",
  registerTitle: "\u6ce8\u518c {name}",
  registerSubtitle: "\u6ce8\u518c\u540e\u53ef\u8ddf\u8e2a\u5b66\u4e60\u8fdb\u5ea6\u5e76\u7533\u8bf7\u6210\u4e3a\u4f5c\u8005",
  emailLabel: "\u90ae\u7bb1",
  emailPlaceholder: "you@example.com",
  emailInvalid: "\u90ae\u7bb1\u683c\u5f0f\u65e0\u6548",
  passwordLabel: "\u5bc6\u7801",
  passwordPlaceholder: "\u81f3\u5c11 8 \u4f4d",
  passwordTooShort: "\u5bc6\u7801\u81f3\u5c11 8 \u4f4d",
  nicknameLabel: "\u6635\u79f0",
  nicknamePlaceholder: "\u8bf7\u586b\u5199\u6635\u79f0",
  nicknameRequired: "\u8bf7\u586b\u5199\u6635\u79f0",
  submitLogin: "\u767b\u5f55",
  submitRegister: "\u6ce8\u518c",
  switchToRegister: "\u8fd8\u6ca1\u6709\u8d26\u53f7\uff1f\u6ce8\u518c",
  switchToLogin: "\u5df2\u6709\u8d26\u53f7\uff1f\u767b\u5f55",
  applyAuthor: {
    title: "\u7533\u8bf7\u6210\u4e3a\u4f5c\u8005",
    description: "\u4f5c\u8005\u53ef\u4ee5\u53d1\u5e03\u6587\u7ae0\u3001\u52a8\u753b\u4e0e\u5fae\u8bfe\uff0c\u9700\u7ba1\u7406\u5458\u5ba1\u6279\u3002",
    needLogin: "\u8bf7\u5148\u767b\u5f55\u518d\u7533\u8bf7",
    submitted: "\u4f18\u79c0\u4f5c\u8005\u7533\u8bf7\u5df2\u63d0\u4ea4\uff0c\u7ba1\u7406\u5458\u5ba1\u6838\u4e2d\u3002",
    submitFailed: "\u7533\u8bf7\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
    reasonPlaceholder: "\u7b80\u8981\u4ecb\u7ecd\u4f60\u7684\u80cc\u666f\u4e0e\u4f5c\u8005\u8ba1\u5212",
    reasonRequired: "\u8bf7\u586b\u5199\u7533\u8bf7\u7406\u7531",
    submit: "\u63d0\u4ea4\u7533\u8bf7",
  },
} as const;
