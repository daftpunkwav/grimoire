/**
 * @file catalogs/index
 * @description Catalog registry for the Grimoire web app.
 *
 * Responsibilities:
 * - Aggregate every namespace file under `zh-CN/` and `en/` into a single
 *   `zhCN` and `en` object
 * - Re-export the merged catalogs as `CATALOGS` for the `I18nProvider`
 *
 * Notes:
 * - `zh-CN` is the source of truth; new keys land there first. The `en`
 *   barrel annotates its merged export as `MessageCatalog` so missing /
 *   extra keys fail `pnpm typecheck`.
 */

import type { MessageCatalog } from "./types.js";
import { zhCN } from "./zh-CN/index.js";
import { en } from "./en/index.js";

export const CATALOGS = {
  "zh-CN": zhCN,
  en,
} as const;

export type CatalogByLocale = typeof CATALOGS;

export { zhCN, en };
export type { MessageCatalog };
