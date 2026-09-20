/**
 * @file ports
 * @description Cross-service port contracts (composition-root injection).
 *
 * Responsibilities:
 * - User summary and preferences ports (provided by identity)
 * - Article query port (provided by content)
 * - LLM gateway port (provided by llm)
 * - LLM error info shape consumed by all callers
 *
 * Each service declares only "what it needs"; implementations are injected by the host composition root,
 * so identity / content / community / agent do not duplicate the same shapes and force-cast at the seam.
 */
import type { ByokConfig, LlmRequest, LlmResponse, ProviderConfig, StreamChunk } from './llm-types.js';

/** User summary (for serializing author names without coupling to identity's User table shape). */
export interface UserSummary {
  id: string;
  name: string;
}

/** Batch user-summary lookup (provided by identity). */
export interface UserSummaryPort {
  getUserSummaries(ids: string[]): Promise<UserSummary[]>;
}

/** Single-user preferences, including encrypted BYOK (provided by identity). */
export interface UserPreferencesPort {
  getUserPreferences(userId: string): Promise<{
    agentStyle?: string;
    autoplayAnim?: boolean;
    animSpeed?: number;
    byok?: ByokConfig | null;
  } | null>;
}

export type UserQueryPort = UserSummaryPort & UserPreferencesPort;

/** Article query (provided by content). getArticleBySlug returns published only; getArticleMetaBySlug accepts any status. */
export interface ArticleQueryPort {
  getArticleBySlug(
    slug: string,
  ): Promise<{ id: string; slug: string; title: string; summary: string; markdown: string; category: string; level: string } | null>;
  /** Fetch id+slug+title of an article by slug in any status (used for progress checks / memory titles). */
  getArticleMetaBySlug(slug: string): Promise<{ id: string; slug: string; title: string } | null>;
  /** Fetch article id by slug (used by community for article links; any status). */
  getArticleIdBySlug(slug: string): Promise<string | null>;
  searchArticles(q: string, take: number): Promise<{ title: string; slug: string; summary: string; category: string; level: string }[]>;
  getArticlesByIds(ids: string[]): Promise<{ id: string; title: string; slug: string }[]>;
}

/** Structured shape for LLM gateway errors (thrown by the llm service). */
export interface LlmErrorInfo {
  status?: number;
  diagnostic?: { url?: string; raw?: string };
  messageForClient: string;
}

/** LLM gateway (provided by llm). Keys and BYOK decryption live inside llm; callers go through this port only. */
export interface LlmGatewayPort {
  resolveProvider(byok?: ByokConfig | null): ProviderConfig | null;
  resolveProviderChain(byok?: ByokConfig | null): ProviderConfig[];
  getDefaultProvider(): ProviderConfig | null;
  listPublicProviders(): { id: string; name: string; model: string; format: string; vision: boolean; baseUrlHost: string }[];
  maskApiKey(key: string): string;
  callLlm(req: LlmRequest, provider?: ProviderConfig | null): Promise<LlmResponse>;
  callLlmWithFallback(
    req: LlmRequest,
    chain: ProviderConfig[],
  ): Promise<{ result: LlmResponse; provider: ProviderConfig }>;
  streamLlm(req: LlmRequest, provider?: ProviderConfig | null): AsyncGenerator<StreamChunk, void, unknown>;
  resolveStreamWithFallback(
    req: LlmRequest,
    chain: ProviderConfig[],
  ): Promise<{ provider: ProviderConfig; stream: AsyncGenerator<StreamChunk, void, unknown> }>;
  isLlmCallError(e: unknown): e is LlmErrorInfo;
  llmErrorMessage(e: unknown): string | null;
  llmErrorInfo(e: unknown): LlmErrorInfo | null;
}
