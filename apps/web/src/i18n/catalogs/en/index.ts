/**
 * @file i18n/catalogs/en/index
 * @description Barrel that merges every en namespace into a single object.
 *
 * Notes:
 * - The merged export is annotated as `MessageCatalog`, which forces
 *   `pnpm typecheck` to fail when an `en` key is missing or extra compared
 *   to the inferred shape from `zh-CN`. The CI gate `pnpm --filter @grimoire/web check:i18n`
 *   enforces structural parity at runtime; typecheck enforces it at compile time.
 */

import type { MessageCatalog } from "../types.js";

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

export const en = {
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
} as const satisfies MessageCatalog;
