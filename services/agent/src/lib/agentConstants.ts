/**
 * @file agentConstants
 * @description Process-level timing and retry budgets for the agent service (tool loop, hover fallback).
 *
 * Responsibilities:
 * - Define the hover-retry short timeout (secondary path, must not match the main request's budget).
 * - Define the ReAct tool-loop max iteration count and per-tool timeout.
 * - Define the ReAct tool-loop overall deadline (R-08), kept below the front-end 90s tools-mode timeout.
 * - Re-export `LLM_TOKEN_LIMITS` is intentionally NOT here — that contract lives in `@grimoire/contracts`.
 *
 * No runtime logic; constants only.
 */

/** Hover fallback retry uses a short timeout: it is a secondary path and must not be as patient as the main request. */
export const HOVER_RETRY_TIMEOUT_MS = 12_000;

/** ReAct tool-loop max iterations (overridable via `TOOL_LOOP_MAX_ITERS`). */
export const TOOL_LOOP_MAX_ITERS = Math.max(
  1,
  Math.min(20, parseInt(process.env.TOOL_LOOP_MAX_ITERS || '5', 10) || 5),
);

/** Per-tool execution timeout in milliseconds. */
export const TOOL_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.TOOL_TIMEOUT_MS || '8000', 10) || 8000,
);

/** ReAct tool-loop overall deadline (R-08). Must stay under the front-end tools-mode 90s timeout, leaving room for the final answer. */
export const TOOL_LOOP_OVERALL_MS = Math.max(
  5000,
  parseInt(process.env.TOOL_LOOP_OVERALL_MS || '75000', 10) || 75000,
);
