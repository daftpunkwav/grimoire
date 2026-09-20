/**
 * @file i18n/catalogs/en/agent-hover
 * @description Hover quick-explain Agent copy (article-card inline + page bubble).
 */
import type { MessageCatalog } from "../types.js";

export const agentHover = {
  thinking: "Thinking\u2026",
  empty: "No explanation yet",
  fail: {
    retry: "Failed to generate explanation. Please hover again to retry.",
    unavailable: "Explanation is temporarily unavailable. Please try again later.",
    timeout: "Explanation timed out. Please hover again to retry.",
    withReason: "Explanation failed: {reason}",
  },
  fastAgent: "Quick Agent (hover)",
  viewUnit: "view",
} as const satisfies MessageCatalog["agentHover"];
