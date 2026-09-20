/**
 * @file i18n/catalogs/en/knowledge
 * @description Knowledge overview, LLM overview, domain detail pages.
 */
import type { MessageCatalog } from "../types.js";

export const knowledge = {
  overview: {
    title: "Agent knowledge",
    description: "All domains and their articles and animations.",
    llmTitle: "LLM basics",
    llmDescription: "From tokenization to prompting: the practical walkthrough of LLMs.",
  },
  domain: {
    notFound: "Domain not found",
    backToKnowledge: "\u2190 Back to knowledge map",
    back: "\u2190 Back",
    searchPlaceholder: "Search articles in this domain\u2026",
  },
} as const satisfies MessageCatalog["knowledge"];
