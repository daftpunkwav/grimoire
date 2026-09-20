/**
 * @file index
 * @description Grimoire API entrypoint — orchestrates the boot sequence `loadSettings → prisma → compose → startServer → signal handlers` for `services/api`.
 *
 * Responsibilities:
 * - Load `.env`, validate required settings via `loadSettings`, and construct the shared `PrismaClient` singleton plus the LLM gateway.
 * - Hand `prisma` + `llm` to `createApp` (which delegates per-domain wiring to `compose.ts`) and start the HTTP listener on the configured port.
 * - Register SIGTERM / SIGINT handlers that stop accepting connections, drain in-flight requests on a grace timer, and disconnect Prisma with a forced-exit safety net.
 */
import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { validateEnv } from './lib/env.js';
import { logger } from '@grimoire/foundation';
import { createLlmGateway } from '@grimoire/llm';

const port = Number(process.env.PORT || 8181);

const llm = createLlmGateway();

// R-07: startup-time env validation — fail-fast on missing critical dependencies; warn (do not block) on optional degradation (LLM).
// LLM availability is detected through the port semantic (listPublicProviders) so env.ts does not import llm internals.
validateEnv({ hasServerProviders: () => llm.listPublicProviders().length > 0 });

const app = createApp({ prisma, llm });
const server = app.listen(port, () => {
  logger.info({ port }, 'api listening');
});

/**
 * R-03: graceful shutdown — stop accepting new connections, let in-flight requests finish on the grace timer, then disconnect Prisma.
 * K8s / compose rolling deploys default to SIGTERM; a forced-exit safety net prevents dangling connections from stalling the process.
 */
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutdown: stop accepting new connections');

  // Safety net: force-exit if shutdown does not complete within 10s (do not wait for LLM upstream's natural 30s timeout).
  const forceTimer = setTimeout(() => {
    logger.error({ signal }, 'shutdown: forced exit after grace period');
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('shutdown: prisma disconnected, bye');
      process.exit(0);
    } catch (e) {
      logger.error({ err: String(e) }, 'shutdown: prisma disconnect failed');
      process.exit(1);
    }
  });

  // Node ≥18.2: close idle keep-alive connections immediately; SSE and other in-flight connections are handled by the grace period + forced-exit timer.
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
