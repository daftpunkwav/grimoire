/**
 * @file providers
 * @description Provider resolution, failover, and the public sync/stream call entry points for the LLM gateway.
 *
 * Responsibilities:
 * - Resolve a single provider (`resolveProvider`, `getDefaultProvider`) or a failover chain (`resolveProviderChain`).
 * - Convert user BYOK into a sealed `ProviderConfig` (`byokToProvider`); the gateway is the only place BYOK plaintext exists.
 * - Run a synchronous call with a single retriable-error retry (`callLlm`) and a multi-provider failover (`callLlmWithFallback`).
 * - Run a stream with one pre-first-chunk failover (`resolveStreamWithFallback`) — once chunks start arriving, the provider is locked.
 * - List public-safe provider metadata (`listPublicProviders`) and mask API keys (`maskApiKey`).
 *
 * Re-exports adapter helpers (URL resolvers, `extractAnthropicParts`) for tests and downstream use.
 */
import type {
  ApiFormat,
  ByokConfig,
  LlmRequest,
  LlmResponse,
  ProviderConfig,
  StreamChunk,
} from './types.js';
import { LLM_RETRY_BACKOFF_MS } from './config.js';
import { logger } from '@core/foundation';
import { assertSafeByokBaseUrl, decryptByokConfig } from '@core/foundation';
import {
  LlmCallError,
  isAbortError,
  isRetriable,
  sleep,
  stripSlash,
  withTimeout,
} from './providerHttp.js';
import { callAnthropicMessages, streamAnthropicMessages } from './adapters/anthropicMessages.js';
import { callOpenAiChat, streamOpenAiChat } from './adapters/openaiChat.js';
import { callOpenAiResponses } from './adapters/openaiResponses.js';
import {
  acquireLlmSlot,
  assertCircuitClosed,
  recordProviderFailure,
  recordProviderSuccess,
  releaseCircuitProbe,
} from './resilience.js';
import { sealProvider } from './providerSecret.js';

export { providerApiKey, sealProvider } from './providerSecret.js';

export { LlmCallError } from './providerHttp.js';
export { extractAnthropicParts, resolveAnthropicMessagesUrl } from './adapters/anthropicMessages.js';
export { resolveOpenAiChatUrl } from './adapters/openaiChat.js';
export { resolveOpenAiResponsesUrl } from './adapters/openaiResponses.js';

import {
  getCachedProviders,
  getPreferredProviderId,
  isByokFallbackToServerEnabled,
  resetProviderCache,
} from './providerEnv.js';

export function loadProviders(): ProviderConfig[] {
  return getCachedProviders();
}

export { resetProviderCache } from './providerEnv.js';

export function getDefaultProvider(): ProviderConfig | null {
  const preferred = getPreferredProviderId();
  const all = loadProviders();
  return all.find((p) => p.id === preferred) || all[0] || null;
}

export function byokToProvider(byok?: ByokConfig | null): ProviderConfig | null {
  // Key boundary: ciphertext and plaintext are both decrypted here; callers (agent/identity) only pass the stored form.
  const plain = decryptByokConfig(byok);
  if (!plain?.enabled) return null;
  if (!plain.baseUrl?.trim() || !plain.apiKey?.trim() || !plain.model?.trim()) return null;
  // SSRF: only validate user BYOK; server-side env providers do not take this path.
  const baseUrl = assertSafeByokBaseUrl(plain.baseUrl);
  return sealProvider({
    id: 'byok',
    name: plain.name?.trim() || 'BYOK',
    baseUrl,
    apiKey: plain.apiKey.trim(),
    model: plain.model.trim(),
    format: plain.format || 'anthropic_messages',
    vision: plain.vision !== false,
  });
}

/** Prefer the user's BYOK; fall back to the server-side default. */
export function resolveProvider(byok?: ByokConfig | null): ProviderConfig | null {
  return byokToProvider(byok) || getDefaultProvider();
}

/**
 * R-04: provider failover chain — BYOK (if enabled and allowed) → preferred server provider → other server providers.
 * BYOK failures do not fall back to server providers by default (quota isolation); set `LLM_BYOK_FALLBACK_TO_SERVER=1` to opt in.
 */
export function resolveProviderChain(byok?: ByokConfig | null): ProviderConfig[] {
  const chain: ProviderConfig[] = [];
  const byokP = byokToProvider(byok);
  if (byokP) chain.push(byokP);
  const all = loadProviders();
  if (!byokP || isByokFallbackToServerEnabled()) {
    const preferred = getPreferredProviderId();
    const sorted = [...all].sort((a, b) =>
      a.id === preferred ? -1 : b.id === preferred ? 1 : 0,
    );
    chain.push(...sorted);
  }
  return chain;
}

export type LlmChainResult = { result: LlmResponse; provider: ProviderConfig };

/** R-04: whether this error should trigger a failover (upstream faults: network / 5xx / timeout / 429 / breaker 503); 4xx config errors throw immediately. */
function isFailoverError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (!(e instanceof LlmCallError)) return false;
  // `code='LLM_CAPACITY'` is local-concurrency-full (provider-agnostic); retrying along the chain would just wait — terminate.
  if (e.code === 'LLM_CAPACITY') return false;
  return [408, 429, 500, 502, 503, 504].includes(e.status);
}

/**
 * R-04: failover along the chain. Only "upstream fault" errors (5xx / network / timeout / 429 / breaker 503) trigger a move;
 * 4xx config errors throw without failover. The response carries the actual serving `provider`.
 */
export async function callLlmWithFallback(
  req: LlmRequest,
  chain: ProviderConfig[],
): Promise<LlmChainResult> {
  let lastErr: unknown = new Error('LLM not configured: please fill in BYOK (Base URL / API Key / model / format) in settings.');
  for (const p of chain) {
    try {
      const result = await callLlm(req, p);
      return { result, provider: p };
    } catch (e) {
      lastErr = e;
      const failover = isFailoverError(e);
      logger.warn(
        {
          event: 'llm_failover',
          providerId: p.id,
          status: e instanceof LlmCallError ? e.status : undefined,
          failover,
        },
        'llm provider failed',
      );
      if (!failover) throw e;
    }
  }
  throw lastErr;
}

/**
 * R-04: stream failover — only attempts failures that happen before the first chunk (breaker / 5xx / network / timeout / 429).
 * Once chunks start arriving, the provider is locked (avoiding duplicated content).
 * Returns the actual serving `provider` plus an async generator starting from the first buffered chunk.
 */
export async function resolveStreamWithFallback(
  req: LlmRequest,
  chain: ProviderConfig[],
): Promise<{ provider: ProviderConfig; stream: AsyncGenerator<StreamChunk, void, unknown> }> {
  let lastErr: unknown = new Error('LLM not configured: please fill in BYOK (Base URL / API Key / model / format) in settings.');
  for (const p of chain) {
    const gen = streamLlm(req, p);
    try {
      const first = await gen.next();
      if (first.done) {
        // An empty stream still counts as success (provider is healthy but produced nothing) — return it without trying alternates.
        const empty = (async function* () {})();
        return { provider: p, stream: empty };
      }
      const buffered = first.value;
      return {
        provider: p,
        stream: (async function* () {
          yield buffered;
          yield* gen;
        })(),
      };
    } catch (e) {
      lastErr = e;
      const failover = isFailoverError(e);
      logger.warn(
        {
          event: 'llm_stream_failover',
          providerId: p.id,
          status: e instanceof LlmCallError ? e.status : undefined,
          failover,
        },
        'llm stream provider failed',
      );
      if (!failover) throw e;
    }
  }
  throw lastErr;
}

export function listPublicProviders() {
  return loadProviders().map((p) => ({
    id: p.id,
    name: p.name,
    model: p.model,
    format: p.format,
    vision: p.vision,
    baseUrlHost: safeHost(p.baseUrl),
  }));
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export async function callLlm(req: LlmRequest, provider?: ProviderConfig | null): Promise<LlmResponse> {
  const p = provider || getDefaultProvider();
  if (!p) {
    throw new Error('LLM not configured: please fill in BYOK (Base URL / API Key / model / format) in settings.');
  }

  // R-01: when the breaker is open, fail fast — do not pile more load on a dying upstream.
  assertCircuitClosed(p);
  // R-02: process-wide concurrency slot; full queue waits LLM_QUEUE_WAIT_MS, then fast 503 (degrade, do not pile up).
  const releaseSlot = await acquireLlmSlot();

  // A-02: synchronous calls uniformly attach a timeout; a hung upstream is cut off at 30s.
  const { req: timedReq, timedOut } = withTimeout(req);
  // B-05: single retry on 5xx / network jitter; 4xx, timeouts, and client cancels do not retry (avoid amplifying stalls).
  const startedAt = Date.now();
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let result: LlmResponse;
        switch (p.format) {
          case 'anthropic_messages':
            result = await callAnthropicMessages(p, timedReq);
            break;
          case 'openai_responses':
            result = await callOpenAiResponses(p, timedReq);
            break;
          case 'openai_chat':
          default:
            result = await callOpenAiChat(p, timedReq);
            break;
        }
        // B-06: success log point.
        logger.info(
          {
            event: 'llm_call',
            providerId: p.id,
            format: p.format,
            mode: req.mode,
            ms: Date.now() - startedAt,
            ok: true,
          },
          'llm call ok',
        );
        // R-01: success resets the breaker.
        recordProviderSuccess(p);
        return result;
      } catch (e) {
        if (attempt === 1 && !timedOut() && isRetriable(e)) {
          // B-06: retry log point.
          logger.warn(
            {
              event: 'llm_call_retry',
              providerId: p.id,
              format: p.format,
              mode: req.mode,
              status: e instanceof LlmCallError ? e.status : undefined,
            },
            'llm call retry',
          );
          await sleep(LLM_RETRY_BACKOFF_MS);
          continue;
        }
        // R-01: final failure is fed into the breaker (4xx / client cancels are already filtered out internally).
        recordProviderFailure(p, e);
        if (isAbortError(e) && timedOut()) {
          logger.error(
            {
              event: 'llm_call',
              providerId: p.id,
              format: p.format,
              mode: req.mode,
              ms: Date.now() - startedAt,
              ok: false,
              status: 408,
            },
            'llm call timeout',
          );
          throw new LlmCallError(408, '模型响应超时，请稍后重试', { url: '', raw: '' });
        }
        // B-06: failure log point (TypeError = network-layer failure; tag `NETWORK` for log aggregation).
        logger.error(
          {
            event: 'llm_call',
            providerId: p.id,
            format: p.format,
            mode: req.mode,
            ms: Date.now() - startedAt,
            ok: false,
            status: e instanceof LlmCallError ? e.status : e instanceof TypeError ? 'NETWORK' : undefined,
          },
          'llm call failed',
        );
        throw e;
      }
    }
    /* istanbul ignore next -- the loop cap guarantees a return or a throw. */
    throw new Error('unreachable');
  } finally {
    releaseSlot();
  }
}

/** Stream output: thinking / text chunks. `openai_responses` degrades to a single text chunk. */
export async function* streamLlm(
  req: LlmRequest,
  provider?: ProviderConfig | null,
): AsyncGenerator<StreamChunk, void, unknown> {
  const p = provider || getDefaultProvider();
  if (!p) {
    throw new Error('LLM not configured: please fill in BYOK (Base URL / API Key / model / format) in settings.');
  }

  // R-01 + R-02: breaker check + slot held for the entire streaming lifetime.
  assertCircuitClosed(p);
  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await acquireLlmSlot();
  } catch (e) {
    // P0-1: slot-queue timeout happened before the call — reset the probe flag or every subsequent request to this provider returns 503.
    releaseCircuitProbe(p);
    throw e;
  }

  // A-02: stream calls also attach the timeout so a hung upstream cannot pin the SSE.
  const { req: timedReq, timedOut } = withTimeout(req);
  let finished = false;
  try {
    if (p.format === 'anthropic_messages') {
      yield* streamAnthropicMessages(p, timedReq);
      finished = true;
      return;
    }
    if (p.format === 'openai_chat') {
      yield* streamOpenAiChat(p, timedReq);
      finished = true;
      return;
    }
    // B-04: the Responses format does not have a real streaming path yet; fall back to one bulk yield.
// First-chunk latency equals the full generation latency, so early-stop is ineffective. Use this log when triaging.
    logger.warn(
      { providerId: p.id, format: p.format },
      'openai_responses: real streaming not implemented, degraded to single-shot output (early-stop ineffective)',
    );
    const full = await callOpenAiResponses(p, timedReq);
    if (full.text) yield { kind: 'text' as const, text: full.text };
    finished = true;
  } catch (e) {
    // R-01: real failures count toward the breaker; hover early-stops and client cancels are intentional and do not (filtering is internal).
    recordProviderFailure(p, e);
    if (isAbortError(e) && timedOut()) {
      throw new LlmCallError(408, '模型响应超时，请稍后重试', { url: '', raw: '' });
    }
    throw e;
  } finally {
    releaseSlot?.();
    // P0-1: when the stream does not finish normally (early-stop / client cancel go through `finally`, not `catch`), release the half-open probe flag
// to avoid a stuck "probe in flight" forever; normal completion closes the breaker via `recordProviderSuccess`.
    if (!finished) releaseCircuitProbe(p);
    else recordProviderSuccess(p);
  }
}
