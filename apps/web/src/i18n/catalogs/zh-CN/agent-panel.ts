/**
 * @file i18n/catalogs/zh-CN/agent-panel
 * @description Panel Agent copy (full chat surface, tool-loop status).
 */
export const agentPanel = {
  title: "Agent \u52a9\u624b",
  fastAgent: "\u5feb\u901f Agent\uff08\u60ac\u505c\uff09",
  modeInfo: "\u6a21\u5f0f\u8bf4\u660e",
  close: "\u5173\u95ed",
  status: {
    searching: "_\u6b63\u5728\u68c0\u7d22\u6587\u7ae0\u2026_",
    reading: "_\u6b63\u5728\u8bfb\u53d6\u6587\u7ae0\u2026_",
    callingTool: "_\u6b63\u5728\u8c03\u7528\u5de5\u5177 {name}\u2026_",
  },
  stream: {
    error: "\u6d41\u5f0f\u8bfb\u53d6\u5931\u8d25",
    unsupported: "\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u6d41\u5f0f\u8bfb\u53d6",
  },
} as const;
