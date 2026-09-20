/**
 * @file i18n/catalogs/en/news
 * @description Frontier news page copy.
 */
import type { MessageCatalog } from "../types.js";

export const news = {
  title: "Frontier news",
  subtitle: "Static curated \u00b7 demo data",
  tags: {
    protocol: "Protocol",
    framework: "Framework",
    safety: "Safety",
  },
  items: {
    mcp: "The MCP ecosystem keeps expanding: native integration in IDEs and Agent runtimes",
  },
} as const satisfies MessageCatalog["news"];
