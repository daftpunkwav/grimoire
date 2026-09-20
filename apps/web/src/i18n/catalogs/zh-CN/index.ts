/**
 * @file i18n/catalogs/zh-CN/index
 * @description Barrel that merges every zh-CN namespace into a single object.
 *
 * Notes:
 * - `zh-CN` is the source of truth for keys; new keys land here first.
 * - This file is intentionally untyped so a new namespace file can be added
 *   without forcing every other locale to match. The type check at
 *   `pnpm typecheck` happens in the `en` barrel, where the merged export
 *   is annotated as `MessageCatalog`.
 */

import { adminApplications } from "./admin-applications.js";
import { adminDomains } from "./admin-domains.js";
import { agentCache } from "./agent-cache.js";
import { agentHover } from "./agent-hover.js";
import { agentPanel } from "./agent-panel.js";
import { animation } from "./animation.js";
import { apiErrors } from "./api-errors.js";
import { article } from "./article.js";
import { auth } from "./auth.js";
import { authorEditor } from "./author-editor.js";
import { brand } from "./brand.js";
import { common } from "./common.js";
import { home } from "./home.js";
import { knowledge } from "./knowledge.js";
import { news } from "./news.js";
import { profile } from "./profile.js";
import { search } from "./search.js";
import { settings } from "./settings.js";
import { shell } from "./shell.js";
import { topic } from "./topic.js";

export const zhCN = {
  adminApplications,
  adminDomains,
  agentCache,
  agentHover,
  agentPanel,
  animation,
  apiErrors,
  article,
  auth,
  authorEditor,
  brand,
  common,
  home,
  knowledge,
  news,
  profile,
  search,
  settings,
  shell,
  topic,
};
