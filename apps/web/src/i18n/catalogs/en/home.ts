/**
 * @file i18n/catalogs/en/home
 * @description Home page and home-feed components.
 */
import type { MessageCatalog } from "../types.js";

export const home = {
  hero: {
    title: "Master Agent development,",
    titleHighlight: "one core concept at a time",
    subtitle: "Step-driven animations and a dual in-product Agent. Reader and author on the same platform.",
  },
  feed: {
    empty: "No articles yet",
    loading: "Loading\u2026",
  },
  domains: {
    reasoning: "Reasoning modes",
    frameworks: "Frameworks",
    protocols: "Protocols & engineering",
    llm: "LLM basics",
    eval: "Evaluation & safety",
    memory: "Memory systems",
  },
} as const satisfies MessageCatalog["home"];
