/**
 * @file i18n/catalogs/zh-CN/api-errors
 * @description Front-end API client error messages.
 */
export const apiErrors = {
  timeout: "\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  notFound: "\u4e0d\u5b58\u5728",
  network: "\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u68c0\u67e5\u8fde\u63a5\u540e\u91cd\u8bd5",
  unknown: "\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  codes: {
    TIMEOUT: "TIMEOUT",
    NOT_FOUND: "NOT_FOUND",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    INTERNAL: "INTERNAL",
  },
} as const;
