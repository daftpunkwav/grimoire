/**
 * @file i18n/catalogs/en/agent-cache
 * @description Hover cache / session / stream buffer user-visible copy.
 */
import type { MessageCatalog } from "../types.js";

export const agentCache = {
  empty: "No explanation yet",
  failReason: "Explanation failed: {reason}",
  failGeneric: "Failed to generate explanation. Please try again.",
} as const satisfies MessageCatalog["agentCache"];
