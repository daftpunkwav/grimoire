/**
 * @file types
 * @description Re-exports of the shared LLM/provider type contracts from `@grimoire/contracts`.
 *
 * Responsibilities:
 * - Re-export `ApiFormat`, `AgentStyle`, `ByokConfig`, `ChatMessage`, `LlmRequest`, `LlmResponse`, `ProviderConfig`, `StreamChunk` from `@grimoire/contracts`.
 * - Re-export the `API_FORMATS` constant from `@grimoire/contracts`.
 *
 * No runtime code; type-only module. The contracts package is the single source of truth across services.
 */
export type {
  ApiFormat,
  AgentStyle,
  ByokConfig,
  ChatMessage,
  LlmRequest,
  LlmResponse,
  ProviderConfig,
  StreamChunk,
} from '@grimoire/contracts';
export { API_FORMATS } from '@grimoire/contracts';
