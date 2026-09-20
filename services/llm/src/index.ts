/**
 * @file index
 * @description Public exports for the @grimoire/llm package.
 *
 * Responsibilities:
 * - Re-export provider-list and provider-resolution helpers (`resolveProvider`, `resolveProviderChain`, `getDefaultProvider`, `listPublicProviders`, `maskApiKey`).
 * - Re-export call/stream entry points (`callLlm`, `callLlmWithFallback`, `streamLlm`, `resolveStreamWithFallback`).
 * - Re-export `LlmCallError`, the cache reset/load helpers, and the shared types from `@core/contracts`.
 * - Provide `createLlmGateway()` which returns an object shaped to fit the agent/identity port.
 *
 * This service holds every LLM key (env providers and decrypted BYOK plaintext); keys are decrypted only inside this service.
 */
import {
  callLlm,
  callLlmWithFallback,
  getDefaultProvider,
  listPublicProviders,
  maskApiKey,
  resolveProvider,
  resolveProviderChain,
  resolveStreamWithFallback,
  streamLlm,
} from './providers.js';
import { LlmCallError } from './providerHttp.js';

/** Whether a thrown value matches the `LlmCallError` shape (consumed by agent/identity). */
function isLlmCallError(e: unknown): e is LlmCallError {
  return e instanceof LlmCallError;
}

/** Safe client-facing message (no url/raw); null when the error is not an `LlmCallError`. */
function llmErrorMessage(e: unknown): string | null {
  return isLlmCallError(e) ? e.messageForClient : null;
}

function llmErrorInfo(e: unknown): {
  status?: number;
  diagnostic?: { url?: string; raw?: string };
  messageForClient: string;
} | null {
  if (!isLlmCallError(e)) return null;
  return { status: e.status, diagnostic: e.diagnostic, messageForClient: e.messageForClient };
}

export function createLlmGateway() {
  return {
    resolveProvider,
    resolveProviderChain,
    getDefaultProvider,
    listPublicProviders,
    maskApiKey,
    callLlm,
    callLlmWithFallback,
    streamLlm,
    resolveStreamWithFallback,
    isLlmCallError,
    llmErrorMessage,
    llmErrorInfo,
  };
}

export type LlmGateway = ReturnType<typeof createLlmGateway>;
export { LlmCallError } from './providerHttp.js';
export { resetProviderCache, loadProviders } from './providers.js';
export type { LlmRequest, LlmResponse, ProviderConfig, StreamChunk } from '@core/contracts';
