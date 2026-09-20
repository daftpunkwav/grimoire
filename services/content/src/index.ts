/**
 * @file content
 * @description Public exports for the @grimoire/content package.
 *
 * Responsibilities:
 * - `createContentRouters`: build the articles, animations, domains, and annotations routers.
 * - `createContentRouter`: collapse the routers above into one standalone `express.Router`.
 * - `ContentDeps` / `ContentRouters`: dependency and shape contracts for the composition root.
 * - Re-export `createContentRepository` and the `ArticleQueryPort` type so the host can wire the content port into other services.
 *
 * Composition contract: the host injects `PrismaClient` plus a `UserSummaryPort` for author lookups
 * (we never `join user` directly). When the service later runs as its own process, swap the
 * in-memory factories for HTTP-backed port clients.
 */
import { Router } from 'express';
import { createArticlesRouter } from './routes/articles.js';
import { createAnimationsRouter } from './routes/animations.js';
import { createDomainsRouter } from './routes/domains.js';
import { createAnnotationsRouter } from './routes/annotations.js';
import type { UserSummaryPort } from '@core/contracts';

/** Content only consumes the user-summary subset (narrowed from contracts' `UserQueryPort`). */
export type UserQueryPort = UserSummaryPort;

export interface ContentDeps {
  prisma: import('@prisma/client').PrismaClient;
  users: UserQueryPort;
}

export interface ContentRouters {
  articles: Router;
  animations: Router;
  domains: Router;
  annotations: Router;
}

export function createContentRouters(deps: ContentDeps): ContentRouters {
  return {
    articles: createArticlesRouter(deps.prisma, deps.users),
    animations: createAnimationsRouter(deps.prisma),
    domains: createDomainsRouter(deps.prisma, deps.users),
    annotations: createAnnotationsRouter(deps.prisma, deps.users),
  };
}

/** Standalone assembly: collapses every sub-router into one `express.Router`. */
export function createContentRouter(deps: ContentDeps): Router {
  const { articles, animations, domains, annotations } = createContentRouters(deps);
  return Router().use(articles, animations, domains, annotations);
}

export { createContentRepository } from './repositories.js';
export type { ArticleQueryPort } from './repositories.js';
