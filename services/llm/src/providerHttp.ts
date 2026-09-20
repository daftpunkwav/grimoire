/**
 * @file providerHttp
 * @description Shared HTTP helpers and the `LlmCallError` type used by the LLM gateway.
 *
 * Responsibilities:
 * - Define `LlmCallError` (A-01): `messageForClient` is safe for clients; `diagnostic` is for logs only.
 * - Classify errors as retriable (`isRetriable`) and as abort/timeout (`isAbortError`) — 4xx and client cancels never retry (B-05).
 * - Wrap synchronous requests in a unified timeout signal (`withTimeout`).
 * - Provide defensive token-budget defaults (`tokenDefaults`) and a `stripSlash` URL helper.
 *
 * No adapters live here — those live under `adapters/`.
 */
import type { LlmRequest } from './types.js';
import { LLM_CALL_TIMEOUT_MS, LLM_TOKEN_LIMITS } from './config.js';

/** Upstream LLM call error (A-01): `messageForClient` faces the client; diagnostic fields only ever reach the log. */
export class LlmCallError extends Error {
  constructor(
    public readonly status: number,
    public readonly messageForClient: string,
    public readonly diagnostic: { url: string; raw: string },
    /** Business tag that distinguishes same-status errors (e.g. 503: upstream circuit-open vs local capacity-full). */
    public readonly code?: string,
  ) {
    super(messageForClient);
    this.name = 'LlmCallError';
  }
}

/** Only 5xx / network-layer failures are retriable; 4xx (bad params/auth), timeouts, and client cancels are not (B-05). */
export function isRetriable(e: unknown): boolean {
  if (e instanceof LlmCallError) return e.status === 502 || e.status === 503 || e.status === 504;
  // fetch network-layer failures (no HTTP status) surface as `TypeError`.
  return e instanceof TypeError;
}

export function isAbortError(e: unknown): boolean {
  // AbortSignal.timeout rejects with a `TimeoutError` DOMException; a manual AbortController rejects with `AbortError`. Both count as a cancellation.
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Synchronously attach a unified timeout (A-02): the request aborts when either the caller signal or the timeout signal fires.
 * `timedOut()` lets the caller distinguish a timeout from an intentional cancel.
 */
export function withTimeout(req: LlmRequest): { req: LlmRequest; timedOut: () => boolean } {
  const timeoutSignal = AbortSignal.timeout(LLM_CALL_TIMEOUT_MS);
  const signal = req.signal ? AbortSignal.any([req.signal, timeoutSignal]) : timeoutSignal;
  return { req: { ...req, signal }, timedOut: () => timeoutSignal.aborted };
}

/** Defensive fallback: when the caller omits a param, fall back to the single-source default (C-03). */
export function tokenDefaults(req: LlmRequest): { maxTokens: number; temperature: number } {
  const d = LLM_TOKEN_LIMITS[req.mode === 'fast' ? 'hover' : 'clickDeep'];
  return { maxTokens: req.maxTokens ?? d.maxTokens, temperature: req.temperature ?? d.temperature };
}

export function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
