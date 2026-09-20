/**
 * @file env
 * @description `loadSettings` — startup-time environment validator that fails fast on missing critical dependencies and warns on optional degradation.
 *
 * Responsibilities:
 * - Fail-fast on critical dependencies (`JWT_SECRET` length, prod-only `DATABASE_URL` and stronger `JWT_SECRET` rules).
 * - Warn (do not block) when no server-side LLM providers are configured — the agent domain degrades to "BYOK only" while other domains stay healthy.
 * - Detect LLM availability through the injected `hasServerProviders` port semantic so `env.ts` does not import `llm` internals.
 */
import { logger } from '@core/foundation';

export function validateEnv(opts: { hasServerProviders?: () => boolean } = {}): void {
  const problems: string[] = [];

  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 16) {
    problems.push('JWT_SECRET 未配置或过短（至少 16 字符）');
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (jwtSecret.length < 32) {
      problems.push('生产环境 JWT_SECRET 至少 32 字符');
    }
    if (jwtSecret.includes('change-me')) {
      problems.push('生产环境禁止使用 .env.example 中的示例 JWT_SECRET');
    }
    if (!process.env.DATABASE_URL) {
      problems.push('生产环境必须显式配置 DATABASE_URL');
    }
  }

  if (problems.length) {
    for (const p of problems) logger.error({ problem: p }, 'env validation failed');
    // Critical dependency missing: refuse to start. This is more honest and easier to debug than "start successfully, then 500 on every request".
    process.exit(1);
  }

  // Optional dependency: warn-only downgrade, do not block (detected via port semantic; no direct coupling to llm internal module state).
  if (opts.hasServerProviders?.() === false) {
    logger.warn(
      { event: 'llm_degraded' },
      '未配置任何服务端 LLM Provider：Agent 域降级（仅 BYOK 用户可用），其余功能正常',
    );
  }
}
