/**
 * @file i18n/catalogs/zh-CN/animation
 * @description Animation runtime, templates, controls.
 */
export const animation = {
  empty: "\u6682\u65e0\u52a8\u753b\u5e27",
  controls: {
    reset: "\u91cd\u7f6e",
    prev: "\u4e0a\u4e00\u6b65",
    play: "\u64ad\u653e",
    pause: "\u6682\u505c",
    next: "\u4e0b\u4e00\u6b65",
  },
  visualKind: {
    ring: "\u73af\u72b6\u5faa\u73af\uff1aReAct / Loop",
    chain: "\u94fe\u5f0f",
    tree: "\u6811",
    graph: "\u5173\u7cfb\u56fe",
  },
  steps: {
    userQuestion: "\u7528\u6237\u63d0\u95ee",
    thought: "Thought \u00b7 \u5206\u6790\u95ee\u9898",
    action: "Action \u00b7 \u641c\u7d22\u5de5\u5177",
    observation: "Observation \u00b7 \u641c\u7d22\u7ed3\u679c",
    final: "Final \u00b7 \u7ed3\u8bba",
  },
} as const;
