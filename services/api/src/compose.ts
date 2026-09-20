/**
 * @file compose
 * @description Host composition root — the only layer in the repo permitted to import every service's source.
 *
 * Responsibilities:
 * - Create shared infrastructure and instantiate each service's repository, then implement cross-service ports.
 * - Inject services following the dependency graph and return the `prefix → Router` mount table for the host app.
 * - Serve as the single migration point for future microservice extraction (swap same-process port delegates for HTTP clients; each service then listens on its own port).
 *
 * Port contract types converge on `@core/contracts`, so `usersPort` (provided by identity) naturally satisfies the `UserSummaryPort` subset consumed by content / community without forced casts.
 */
import type { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { LlmGateway } from '@core/llm';
import type { UserQueryPort } from '@core/contracts';
import { createIdentityRouters } from '@core/identity';
import { createIdentityRepository } from '@core/identity';
import { createContentRouters, createContentRepository } from '@core/content';
import { createCommunityRouters } from '@core/community';
import { createAgentRuntime, createAgentRouter } from '@core/agent';

export interface ComposeResult {
  /** Routers assembled in dependency order, mounted by the host app. */
  mounts: { prefix: string; router: Router }[];
  prisma: PrismaClient;
}

export function compose(
  prisma: PrismaClient,
  llm: LlmGateway,
  hooks: {
    /** Preference / BYOK changes → invalidate the agent user-context cache. */
    onPrefsChanged?: (info: { userId: string }) => void;
  } = {},
): ComposeResult {
  // ---- Per-service repositories / port implementations ----
  const contentRepo = createContentRepository(prisma);
  // Identity ships its own UserQueryPort adapter, so the host no longer hand-rolls one.
  const usersPort = createIdentityRepository(prisma);

  // ---- Service assembly (acyclic dependency graph: identity / content / community / llm are independent; agent depends on ports) ----
  // Preference / BYOK changes → invalidate the agent user-context cache.
  // The callback is declared up-front in its own binding to remove the "closure captures a later variable" fragility:
  // regardless of which service is wired first, `invalidateAgentCtx` is always defined by the time it is invoked.
  let invalidateAgentCtx: (info: { userId: string }) => void = () => {};
  const agentRuntime = createAgentRuntime({ prisma, users: usersPort, articles: contentRepo, llm });
  invalidateAgentCtx = ({ userId }) => agentRuntime.memory.invalidateUserContext(userId);
  const agent = createAgentRouter(agentRuntime);

  const identity = createIdentityRouters({
    prisma,
    llm,
    onPrefsChanged: hooks.onPrefsChanged ?? invalidateAgentCtx,
  });
  const content = createContentRouters({ prisma, users: usersPort });
  const community = createCommunityRouters({
    prisma,
    users: usersPort,
    articles: contentRepo,
  });

  return {
    mounts: [
      { prefix: '/api/v1/auth', router: identity.auth },
      { prefix: '/api/v1/settings', router: identity.settings },
      { prefix: '/api/v1/author-applications', router: identity.applications },
      { prefix: '/api/v1/articles', router: content.articles },
      { prefix: '/api/v1/animations', router: content.animations },
      { prefix: '/api/v1/domains', router: content.domains },
      { prefix: '/api/v1/annotations', router: content.annotations },
      { prefix: '/api/v1/topics', router: community.topics },
      { prefix: '/api/v1/agent', router: agent },
    ],
    prisma,
  };
}
