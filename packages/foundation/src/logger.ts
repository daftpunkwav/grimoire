/**
 * @file logger
 * @description Structured logger configured per environment (JSON in production, pino-pretty in dev).
 *
 * Responsibilities:
 * - Singleton pino logger instance with `service: 'api'` base field
 * - LOG_LEVEL env var controls level (default `info`; set to `debug` for troubleshooting)
 *
 * No external dependencies beyond pino (+ pino-pretty in dev).
 */
import { pino } from 'pino';

/**
 * Structured logger: emits JSON in production (for log pipelines), pino-pretty in dev.
 * Level is controlled by LOG_LEVEL (default info; set to debug when troubleshooting).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'api' },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
