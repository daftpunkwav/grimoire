/**
 * @file community
 * @description Public exports for the @grimoire/community package.
 *
 * Responsibilities:
 * - `createCommunityRouters`: build the topics router.
 * - `createCommunityRouter`: collapse the router into one standalone `express.Router`.
 * - `CommunityDeps`: dependency contract for the composition root (PrismaClient + user/article ports).
 * - Re-export the `ArticleQueryPort` type for callers that need to type the injection.
 *
 * Composition contract: the host injects `PrismaClient` plus `UserSummaryPort` and `ArticleQueryPort`
 * so the service never queries user/article tables in another domain directly.
 */
import { Router } from 'express';
import { createTopicsRouter } from './routes/topics.js';
import type { ArticleQueryPort, UserSummaryPort } from '@grimoire/contracts';

/** Community only consumes the user-summary subset. */
export type UserQueryPort = UserSummaryPort;

export interface CommunityDeps {
  prisma: import('@prisma/client').PrismaClient;
  users: UserQueryPort;
  articles: ArticleQueryPort;
}

export function createCommunityRouters(deps: CommunityDeps): { topics: Router } {
  return { topics: createTopicsRouter(deps.prisma, { users: deps.users, articles: deps.articles }) };
}

/** Standalone assembly: collapses every sub-router into one `express.Router`. */
export function createCommunityRouter(deps: CommunityDeps): Router {
  const { topics } = createCommunityRouters(deps);
  return Router().use(topics);
}

export type { ArticleQueryPort } from '@grimoire/contracts';
