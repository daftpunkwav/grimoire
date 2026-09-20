/**
 * @file ports
 * @description External dependency ports (inversion-of-control interfaces) consumed by the agent service.
 *
 * Responsibilities:
 * - Define *what the agent needs*, not *where it comes from*.
 * - Re-export port types from `@core/contracts` (single source of truth, no duplicate shapes across services).
 * - Aggregate the assembly-time dependency bag (`AgentDeps`) the host composition root must satisfy.
 *
 * Implementations are injected by the composition root (in-process delegates today, HTTP clients in a future microservice split).
 */
import type { ArticleQueryPort, LlmGatewayPort, UserQueryPort } from '@core/contracts';

export type { ArticleQueryPort, LlmGatewayPort, UserQueryPort };

/** Assembly-time dependencies for the agent service (the host composition root supplies every implementation). */
export interface AgentDeps {
  prisma: import('@prisma/client').PrismaClient;
  articles: ArticleQueryPort;
  users: UserQueryPort;
  llm: LlmGatewayPort;
}
