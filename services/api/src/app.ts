/**
 * @file app
 * @description Builds the Express application factory, wiring middleware, rate limiters, health probes, and service routers.
 *
 * Responsibilities:
 * - Apply security middleware (helmet, CORS, JSON parser, trust-proxy policy) and request-id / access logging.
 * - Mount general + auth rate limiters, with `/health` (liveness) and `/ready` (readiness) probes placed before the limiter.
 * - Delegate per-domain router assembly to `compose.ts`, then mount each prefix; reserve `/api/v1/mcp/status` for the future MCP server.
 * - Apply the shared `errorHandler` so uncaught errors propagate through the structured error envelope.
 */
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { logger, errorHandler } from '@grimoire/foundation';
import { compose } from './compose.js';
import type { PrismaClient } from '@prisma/client';
import type { LlmGateway } from '@grimoire/llm';

export interface CreateAppOptions {
  prisma: PrismaClient;
  llm: LlmGateway;
  /** Preference / BYOK changes → invalidate the agent user-context cache. */
  onPrefsChanged?: (info: { userId: string }) => void;
}

export function createApp(opts: CreateAppOptions): Express {
  const app = express();

  // Trust the reverse proxy only when TRUST_PROXY=1 is explicitly set; keep it off on direct exposure so forged XFF headers cannot bypass the rate limiter.
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || 'http://localhost:8180,http://127.0.0.1:8180')
        .split(',')
        .map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // requestId + access logging: flows through error handling (errorHandler reads res.locals.requestId).
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID().slice(0, 8);
    next();
  });
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ms: Date.now() - start,
          requestId: res.locals.requestId,
        },
        'request',
      );
    });
    next();
  });

  const generalLimiter = rateLimit({
    windowMs: 60_000,
    max: process.env.NODE_ENV === 'development' ? 600 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' } },
  });
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    message: { error: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' } },
  });

  // R-03: liveness probe — must run before the limiter so high-frequency LB probes do not consume rate-limit budget.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'api', ts: new Date().toISOString() });
  });

  // R-03: readiness probe — return 503 when the DB is unreachable so LB / orchestrators drain rather than hammer.
  app.get('/ready', async (_req, res) => {
    try {
      await opts.prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  app.use(generalLimiter);

  // Composition-root assembly: per-domain routers are injected by `compose` (depends on ports only, no cross-service source coupling).
  const { mounts } = compose(opts.prisma, opts.llm, { onPrefsChanged: opts.onPrefsChanged });
  for (const m of mounts) {
    // Auth routes use a dedicated limiter bucket so sign-up / sign-in traffic cannot exhaust the general quota.
    app.use(m.prefix, ...(m.prefix === '/api/v1/auth' ? [authLimiter] : []), m.router);
  }

  // MCP protocol entry reserved for future `services/mcp` wiring.
  app.get('/api/v1/mcp/status', (_req, res) => {
    res.json({
      ok: true,
      protocol: 'mcp',
      status: 'reserved',
      message: 'MCP Server 骨架已预留，详见 services/mcp',
    });
  });

  app.use(errorHandler);
  return app;
}
