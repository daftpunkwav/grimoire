/**
 * @file openaiResponses
 * @description OpenAI Responses API adapter — non-stream calls only (the streaming path is not implemented yet).
 *
 * Responsibilities:
 * - Resolve the full `/responses` URL from the provider's `baseUrl`.
 * - Build the request body: structured `input` array plus top-level `instructions` (C-05; some gateways reject `role: system` inside `input`).
 * - Send a non-stream call (`callOpenAiResponses`) and read `output_text` (falling back to a sliced `output` JSON string).
 * - Throw `LlmCallError` with sanitized client-facing messages; raw URLs/responses only ever reach the log.
 *
 * This service is the only workspace that holds provider credentials.
 */
import type { LlmRequest, LlmResponse, ProviderConfig } from '../types.js';
import { LlmCallError, stripSlash, tokenDefaults } from '../providerHttp.js';
import { providerApiKey } from '../providerSecret.js';

export function resolveOpenAiResponsesUrl(baseUrl: string): string {
  const b = stripSlash(baseUrl);
  if (b.endsWith('/responses')) return b;
  if (/\/v1$/i.test(b)) return `${b}/responses`;
  if (b.includes('/v1')) return `${b}/responses`;
  return `${b}/v1/responses`;
}

/** OpenAI Responses response body (only the fields actually read). */
interface OpenAiResponsesBody {
  output_text?: string;
  output?: unknown;
  error?: { message?: string };
  raw?: string;
}

export async function callOpenAiResponses(p: ProviderConfig, req: LlmRequest): Promise<LlmResponse> {
  // C-05: input uses a structured message array (aligned with callOpenAiChat) instead of a flattened role:content string;
// Responses-API `system` belongs at the top-level `instructions` (some gateways reject `role: system` inside `input`).
  const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const input = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  const url = resolveOpenAiResponsesUrl(p.baseUrl);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${providerApiKey(p)}`,
    },
    body: JSON.stringify({
      model: p.model,
      input,
      instructions: system || undefined,
      max_output_tokens: tokenDefaults(req).maxTokens,
    }),
    // A-02: synchronous calls uniformly attach a timeout (withTimeout synthesizes the signal).
    signal: req.signal,
  redirect: 'manual',
  });
  const raw = await res.text();
  let data: OpenAiResponsesBody = {};
  try {
    data = JSON.parse(raw) as OpenAiResponsesBody;
  } catch {
    data = { raw: raw.slice(0, 300) };
  }
  if (!res.ok) {
    // A-01: url/raw only ever reach the log; the client sees only the safe message.
    throw new LlmCallError(res.status, `模型调用失败（HTTP ${res.status}）`, {
      url,
      raw: raw.slice(0, 500),
    });
  }
  // A-01 review: never fall back to the whole `data` (which may contain raw/error envelopes) as the answer text;
  // trust `output_text` only, and on miss try the structured `output` array (model content, not the envelope).
  const outputText = data.output_text || (data.output ? JSON.stringify(data.output).slice(0, 2000) : '');
  return { text: String(outputText), model: p.model, format: 'openai_responses' };
}
