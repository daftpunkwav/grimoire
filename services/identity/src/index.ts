/**
 * @file identity
 * @description Public exports for the @grimoire/identity package.
 *
 * Responsibilities:
 * - `createIdentityRouters`: build the auth, applications, and settings routers.
 * - `createIdentityRouter`: collapse the routers above into one standalone `express.Router`.
 * - `IdentityDeps` / `IdentityRouters`: dependency and shape contracts for the composition root.
 * - Re-export `getUserSummaries`, `getUserPreferences`, `createIdentityRepository`, plus `LlmGatewayPort` and `UserQueryPort` from contracts.
 *
 * Composition contract: the host injects `PrismaClient` and `LlmGatewayPort`; when the service
 * later runs as its own process, swap the in-memory factories for HTTP-backed port clients.
 */
import { Router } from 'express';
import { createAuthRouter } from './routes/auth.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createSettingsRouter } from './routes/settings.js';
import type { LlmGatewayPort } from '@core/contracts';

export interface IdentityDeps {
  prisma: import('@prisma/client').PrismaClient;
  llm: LlmGatewayPort;
  /** Callback fired after preference/BYOK changes (host injects it to invalidate agent context caches). */
  onPrefsChanged?: (info: { userId: string }) => void;
}

export interface IdentityRouters {
  auth: Router;
  applications: Router;
  settings: Router;
}

export function createIdentityRouters(deps: IdentityDeps): IdentityRouters {
  return {
    auth: createAuthRouter(deps.prisma),
    applications: createApplicationsRouter(deps.prisma),
    settings: createSettingsRouter(deps),
  };
}

/** Standalone assembly: collapses every sub-router into one `express.Router`. */
export function createIdentityRouter(deps: IdentityDeps): Router {
  const { auth, applications, settings } = createIdentityRouters(deps);
  return Router().use(auth, applications, settings);
}

export { getUserSummaries, getUserPreferences, createIdentityRepository } from './repositories.js';
export type { LlmGatewayPort, UserQueryPort } from '@core/contracts';
