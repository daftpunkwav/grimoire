/**
 * @file registry
 * @description Allow-listed tool registry: only registered names are callable and every argument is Zod-validated.
 *
 * Responsibilities:
 * - Hold the canonical list of agent tools (`search_articles`, `get_article`).
 * - Validate raw tool arguments against each tool's Zod schema.
 * - Run tools under a per-call timeout and report errors as observation strings (never throw to the caller).
 * - Inject the ArticleQueryPort; tools only know the port, never a concrete service.
 *
 * Tool registry is the only place that knows which tools the panel Agent can call.
 */
import { logger } from '@core/foundation';
import { createGetArticleTool } from './getArticle.js';
import { createSearchArticlesTool } from './searchArticles.js';
import type { ArticleQueryPort } from '../../ports.js';
import type { ToolContext, ToolDefinition } from './types.js';

export function createToolRegistry(articles: ArticleQueryPort) {
  const TOOLS: ToolDefinition[] = [
    createSearchArticlesTool(articles),
    createGetArticleTool(articles),
  ];

  const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

  function listToolNames(): string[] {
    return TOOLS.map((t) => t.name);
  }

  function getTool(name: string): ToolDefinition | undefined {
    return BY_NAME.get(name);
  }

  function isAllowlistedTool(name: string): boolean {
    return BY_NAME.has(name);
  }

  /**
   * Execute an allow-listed tool: unknown names or Zod failures return an error observation
   * string instead of throwing. Callers must pass an AbortSignal that carries the timeout.
   */
  async function executeTool(
    name: string,
    rawArgs: unknown,
    ctx: ToolContext = {},
  ): Promise<ExecuteToolResult> {
    const started = Date.now();
    const tool = BY_NAME.get(name);
    if (!tool) {
      const ms = Date.now() - started;
      logger.info({ event: 'tool_call', name, ok: false, ms, reason: 'not_allowlisted' }, 'tool denied');
      return {
        ok: false,
        observation: `Error: unknown or disallowed tool "${name}". Allowed: ${listToolNames().join(', ')}`,
        ms,
      };
    }

    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      const ms = Date.now() - started;
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'args'}: ${i.message}`)
        .join('; ');
      logger.info({ event: 'tool_call', name, ok: false, ms, reason: 'invalid_args' }, 'tool args invalid');
      return {
        ok: false,
        observation: `Error: invalid args for ${name}: ${detail}`,
        ms,
      };
    }

    try {
      const observation = await tool.execute(parsed.data as never, ctx);
      const ms = Date.now() - started;
      logger.info({ event: 'tool_call', name, ok: true, ms }, 'tool ok');
      return { ok: true, observation, ms };
    } catch (err) {
      const ms = Date.now() - started;
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError' || /aborted|timeout/i.test(err.message));
      logger.info(
        { event: 'tool_call', name, ok: false, ms, reason: timedOut ? 'timeout' : 'error' },
        'tool failed',
      );
      return {
        ok: false,
        observation: timedOut
          ? `Error: tool ${name} timed out`
          : `Error: tool ${name} failed: ${err instanceof Error ? err.message : String(err)}`,
        ms,
      };
    }
  }

  return { listToolNames, getTool, isAllowlistedTool, executeTool };
}

export type ExecuteToolResult = {
  ok: boolean;
  observation: string;
  ms: number;
};

export type ToolRegistry = ReturnType<typeof createToolRegistry>;
