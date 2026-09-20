/**
 * @file i18n/catalogs/en/search
 * @description Search & filter page copy.
 */
import type { MessageCatalog } from "../types.js";

export const search = {
  title: "Search and filter",
  description: "Cross-domain retrieval of published articles",
  keywordPlaceholder: "Keyword",
  domainLabel: "Domain",
  allDomains: "All domains",
  empty: "Enter a keyword",
  placeholder: "ReAct / MCP / fine-tuning\u2026",
} as const satisfies MessageCatalog["search"];
