/**
 * @file llm-types
 * @description LLM types and token-budget constants shared between agent assembly and the llm gateway.
 *
 * Responsibilities:
 * - AgentStyle / LlmApiFormat / ChatMessage / LlmRequest / LlmResponse / StreamChunk
 * - ProviderConfig and ByokConfig wire shapes
 * - LLM_TOKEN_LIMITS single-source-of-truth for hover / chat / click budgets
 *
 * No business package may depend on this file beyond the published surface area.
 */
export type AgentStyle = 'professional' | 'friendly' | 'sassy' | 'concise' | 'socratic';

export type LlmApiFormat = 'anthropic_messages' | 'openai_chat' | 'openai_responses';

/** LLM Provider abstraction (runtime contract with services/llm; web side uses it for typing only). */
export type ApiFormat = LlmApiFormat;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: ChatMessage[];
  /** Low-latency / high-accuracy mode. */
  mode: 'fast' | 'deep';
  maxTokens?: number;
  temperature?: number;
  /** Multimodal: data URL or http image (when the provider supports vision). */
  images?: string[];
  /** Abort an in-flight upstream LLM request (used for hover early-stop). */
  signal?: AbortSignal;
}

export interface LlmResponse {
  text: string;
  /** Model's internal thinking (optional; not shown directly as the body). */
  thinking?: string;
  model: string;
  format: ApiFormat;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** Stream chunk: thinking and body are split into separate kinds. */
export type StreamChunk =
  | { kind: 'thinking'; text: string }
  | { kind: 'text'; text: string };

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  format: ApiFormat;
  /** Whether the provider supports image input. */
  vision: boolean;
}

/** User-supplied BYOK configuration (stored under preferences.byok). */
export interface ByokConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  format: ApiFormat;
  name?: string;
  vision?: boolean;
}

export const API_FORMATS: { id: ApiFormat; label: string; desc: string }[] = [
  {
    id: 'anthropic_messages',
    label: 'Anthropic Messages',
    desc: '原生 /v1/messages（StepFun、Claude 兼容）',
  },
  {
    id: 'openai_chat',
    label: 'OpenAI Chat Completions',
    desc: '/chat/completions',
  },
  {
    id: 'openai_responses',
    label: 'OpenAI Responses',
    desc: '/responses',
  },
];

/** Single source of truth for LLM token budgets (shared between agent assembly and llm fallbacks). */
export const LLM_TOKEN_LIMITS = {
  /** Hover quick explain: short, direct. */
  hover: { maxTokens: 400, temperature: 0.15 },
  /** Minimal fallback retry when hover returns empty (no memory, thinking disabled). */
  hoverRetry: { maxTokens: 400, temperature: 0.1 },
  /** Panel fast answer (chat fast). */
  chatFast: { maxTokens: 600, temperature: 0.3 },
  /** Panel / detail deep explanation (chat deep / click deep). */
  chatDeep: { maxTokens: 2048, temperature: 0.55 },
  /** Selected-snippet deep explanation (click deep). */
  clickDeep: { maxTokens: 2048, temperature: 0.55 },
} as const;
