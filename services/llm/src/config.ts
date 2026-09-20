/**
 * @file config
 * @description Timeout and retry constants for the LLM gateway.
 *
 * Responsibilities:
 * - Re-export `LLM_TOKEN_LIMITS` from `@core/contracts` so existing imports keep working.
 * - Define `LLM_CALL_TIMEOUT_MS` (A-02) for synchronous LLM calls.
 * - Define `LLM_RETRY_BACKOFF_MS` (B-05) for the single retry on 5xx / network errors.
 *
 * Tool-loop and hover retry timeouts belong to the agent service (`services/agent/src/lib/agentConstants.ts`).
 */
import { LLM_TOKEN_LIMITS } from '@core/contracts';

export { LLM_TOKEN_LIMITS };

/** Synchronous LLM call timeout (A-02): a hung upstream must not pin a connection forever. */
export const LLM_CALL_TIMEOUT_MS = 30_000;

/** Backoff for the single retry on 5xx / network errors during synchronous calls (B-05). */
export const LLM_RETRY_BACKOFF_MS = 500;
