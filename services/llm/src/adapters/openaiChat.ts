/**
 * @file openaiChat
 * @description OpenAI Chat Completions adapter — builds requests, parses responses, and parses SSE streams for the `openai_chat` format.
 *
 * Responsibilities:
 * - Resolve the full `/chat/completions` URL from the provider's `baseUrl`.
 * - Build the request body (typed-ish via `Record<string, unknown>`), turning off `enable_thinking` / `reasoning_effort` for hover/fast.
 * - Stream SSE events into `StreamChunk` (`text` from `delta.content`, `thinking` from `delta.reasoning_content`).
 * - Make a non-stream call (`callOpenAiChat`) and read `choices[0].message.content`.
 * - Throw `LlmCallError` with sanitized client-facing messages; raw URLs/responses only ever reach the log.
 *
 * This service is the only workspace that holds provider credentials.
 */
import type { LlmRequest, LlmResponse, ProviderConfig, StreamChunk } from '../types.js';
import { LlmCallError, stripSlash, tokenDefaults } from '../providerHttp.js';
import { providerApiKey } from '../providerSecret.js';

export function resolveOpenAiChatUrl(baseUrl: string): string {
  const b = stripSlash(baseUrl);
  if (b.endsWith('/chat/completions')) return b;
  if (/\/v1$/i.test(b)) return `${b}/chat/completions`;
  // Many compatible gateways already include `/v1` in `base`; otherwise append it.
  if (b.includes('/v1')) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}

/** OpenAI Chat Completions response body (only the fields actually read). */
interface OpenAiChatResponseBody {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  raw?: string;
}

export async function* streamOpenAiChat(
  p: ProviderConfig,
  req: LlmRequest,
): AsyncGenerator<StreamChunk, void, unknown> {
  const url = resolveOpenAiChatUrl(p.baseUrl);
  const messages = req.messages.map((m) => ({ role: m.role, content: m.content }));
  const { maxTokens, temperature } = tokenDefaults(req);
  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    stream: true,
    max_tokens: maxTokens,
    temperature,
  };
  // Some OpenAI-compatible gateways use these fields to disable reasoning.
  if (req.mode === 'fast') {
    body.enable_thinking = false;
    body.reasoning_effort = 'none';
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${providerApiKey(p)}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: req.signal,
  redirect: 'manual',
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new LlmCallError(res.status, `模型流式生成失败（HTTP ${res.status}）`, {
      url,
      raw: raw.slice(0, 500),
    });
  }
  if (!res.body) {
    const full = await callOpenAiChat(p, req);
    if (full.text) yield { kind: 'text' as const, text: full.text };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      if (req.signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split(/\r?\n/);
      buf = parts.pop() || '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
          };
          const d = evt.choices?.[0]?.delta;
          if (d?.reasoning_content) yield { kind: 'thinking' as const, text: d.reasoning_content };
          if (d?.content) yield { kind: 'text' as const, text: d.content };
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    if (req.signal?.aborted || (e instanceof Error && e.name === 'AbortError')) return;
    throw e;
  }
}

export async function callOpenAiChat(p: ProviderConfig, req: LlmRequest): Promise<LlmResponse> {
  const messages = req.messages.map((m) => {
    if (m.role === 'user' && req.images?.length && p.vision) {
      const content: unknown[] = [{ type: 'text', text: m.content }];
      for (const img of req.images) {
        content.push({ type: 'image_url', image_url: { url: img } });
      }
      return { role: m.role, content };
    }
    return m;
  });

  const { maxTokens, temperature } = tokenDefaults(req);
  const url = resolveOpenAiChatUrl(p.baseUrl);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${providerApiKey(p)}`,
    },
    body: JSON.stringify({
      model: p.model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
    // A-02: synchronous calls uniformly attach a timeout (withTimeout synthesizes the signal).
    signal: req.signal,
  redirect: 'manual',
  });
  const raw = await res.text();
  let data: OpenAiChatResponseBody = {};
  try {
    data = JSON.parse(raw) as OpenAiChatResponseBody;
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
  const text = data.choices?.[0]?.message?.content || '';
  return { text, model: p.model, format: 'openai_chat' };
}
