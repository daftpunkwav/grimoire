/**
 * @file i18n/catalogs/en/brand
 * @description Brand copy (single source-of-truth for the product tagline).
 */
import type { MessageCatalog } from "../types.js";

export const brand = {
  tagline: "Interactive Agent / LLM learning platform",
  title: "Grimoire",
} as const satisfies MessageCatalog["brand"];
