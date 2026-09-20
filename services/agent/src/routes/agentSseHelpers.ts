/**
 * @file agentSseHelpers
 * @description Small helpers shared by the agent's explain and chat SSE routes.
 *
 * Responsibilities:
 * - Build the hover-cache-hit JSON body (`hoverCacheJson`).
 * - Emit the hover-cache-hit SSE frames (`sseWriteHoverCache`).
 * - Write a sanitized LLM error frame at the end of an SSE stream (`writeAgentSseError`).
 *
 * No request handling or stream consumption — only payload shaping.
 */
import type { Response } from 'express';
import type { SseSession } from '@grimoire/foundation';
import { sseWrite } from '@grimoire/foundation';
import type { LlmGatewayPort } from '@grimoire/contracts';
import { AGENT_MODE_META } from '../lib/agentPrompt.js';

/** Hover cache hit JSON response body. */
export function hoverCacheJson(
  body: { mode: 'hover' | 'click' },
  style: string,
  cached: string,
) {
  return {
    explanation: cached,
    mode: body.mode,
    model: 'cache',
    format: 'cache',
    style,
    providerId: 'hover-cache',
    cached: true,
    meta: AGENT_MODE_META.fast,
  };
}

export function sseWriteHoverCache(
  res: Response,
  body: { mode: 'hover' | 'click' },
  style: string,
  cached: string,
) {
  sseWrite(res, {
    type: 'meta',
    model: 'cache',
    format: 'cache',
    providerId: 'hover-cache',
    mode: body.mode,
    style,
    cached: true,
    meta: AGENT_MODE_META.fast,
  });
  sseWrite(res, { type: 'final', answer: cached, thinking: '' });
  sseWrite(res, { type: 'done' });
}

/** Write a sanitized LLM error frame at the end of an SSE stream (only safe text reaches the client). */
export function writeAgentSseError(
  sse: SseSession,
  res: Response,
  llm: LlmGatewayPort,
  e: unknown,
  fallbackMessage: string,
): void {
  if (e instanceof Error && e.name === 'AbortError') return;
  if (sse.gone()) return;
  const message = llm.isLlmCallError(e) ? e.messageForClient : fallbackMessage;
  sseWrite(res, { type: 'error', message });
}
