/**
 * @file i18n/catalogs/en/animation
 * @description Animation runtime, templates, controls.
 */
import type { MessageCatalog } from "../types.js";

export const animation = {
  empty: "No animation frames",
  controls: {
    reset: "Reset",
    prev: "Previous",
    play: "Play",
    pause: "Pause",
    next: "Next",
  },
  visualKind: {
    ring: "Ring loop: ReAct / Loop",
    chain: "Chain",
    tree: "Tree",
    graph: "Graph",
  },
  steps: {
    userQuestion: "User question",
    thought: "Thought \u00b7 Analyze the problem",
    action: "Action \u00b7 Search tools",
    observation: "Observation \u00b7 Search results",
    final: "Final \u00b7 Conclusion",
  },
} as const satisfies MessageCatalog["animation"];
