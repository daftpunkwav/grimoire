/**
 * @file i18n/catalogs/en/agent-panel
 * @description Panel Agent copy (full chat surface, tool-loop status).
 */
import type { MessageCatalog } from "../types.js";

export const agentPanel = {
  title: "Agent assistant",
  fastAgent: "Quick Agent (hover)",
  modeInfo: "About this mode",
  close: "Close",
  status: {
    searching: "_Searching articles\u2026_",
    reading: "_Reading article\u2026_",
    callingTool: "_Calling tool {name}\u2026_",
  },
  stream: {
    error: "Failed to read stream",
    unsupported: "Browser does not support streaming reads",
  },
} as const satisfies MessageCatalog["agentPanel"];
