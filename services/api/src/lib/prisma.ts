/**
 * @file prisma
 * @description Shared `PrismaClient` singleton reused across the API process, with hot-reload-safe global caching outside production.
 *
 * Responsibilities:
 * - Lazily instantiate a single `PrismaClient` per Node process and stash it on `globalThis` in non-production so dev-mode reloads reuse the client.
 * - Configure Prisma's log level to `error` only in production, and `error` + `warn` in development for early visibility.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
