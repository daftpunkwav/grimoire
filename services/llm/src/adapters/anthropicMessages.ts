/**
 * @file anthropicMessages
 * @description Anthropic Messages API adapter — builds requests, parses responses, and parses SSE streams for the `anthropic_messages` format.
 *
 * Responsibilities:
 * - Resolve the full `/v1/messages` URL (or `…/messages` directly) from the provider's `baseUrl`.
 * - Build the request body (typed shape, not `Record<string, unknown>`), and disable `thinking` for hover/fast mode.
 * - Stream SSE events into `StreamChunk` (`text` / `thinking`), with a non-stream fallback when no chunks arrive.
 * - Make a non-stream call (`callAnthropicMessages`) and extract typed `text` / `thinking` blocks.
 * - Throw `LlmCallError` with sanitized client-facing messages; raw URLs/responses only ever reach the log.
 *
 * This service is the only workspace that holds provider credentials.
 */
import type { LlmRequest, LlmResponse, ProviderConfig, StreamChunk } from '../types.js';
import { extractVisibleAnswer } from '@core/foundation';
import { LLM_TOKEN_LIMITS } from '../config.js';
import { LlmCallError, stripSlash, tokenDefaults } from '../providerHttp.js';
import { providerApiKey } from '../providerSecret.js';

/**
 * Full Anthropic Messages URL.
 * - base ends with `/v1` → `{base}/messages`
 * - base is a root path like `step_plan` → `{base}/v1/messages`
 * - base already contains `/messages` → returned as-is
 */
export function resolveAnthropicMessagesUrl(baseUrl: string): string {
  const b = stripSlash(baseUrl);
  if (b.endsWith('/messages')) return b;
  if (/\/v1$/i.test(b)) return `${b}/messages`;
  return `${b}/v1/messages`;
}

/** Anthropic Messages request body (C-01: covers the fields actually used instead of `Record<string, unknown>` + cast). */
interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  temperature: number;
  system?: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  stream?: boolean;
  thinking?: { type: 'disabled' };
}

/** Anthropic Messages response body (only the fields actually read). */
interface AnthropicResponseBody {
  content?: Array<{ type?: string; text?: string; thinking?: string }>;
  completion?: string;
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
  message?: string;
  /** Raw text fallback when JSON parsing fails (used in error logs; never sent to the client). */
  raw?: string;
}

export function buildAnthropicBody(p: ProviderConfig, req: LlmRequest, stream: boolean): AnthropicRequestBody {
  const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const messages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const { maxTokens, temperature } = tokenDefaults(req);
  const body: AnthropicRequestBody = {
    model: p.model,
    max_tokens: maxTokens,
    temperature,
    system: system || undefined,
    messages,
    stream,
  };
  // Hover/fast: try to disable extended thinking to cut CoT leak and latency.
  // StepFun and some compatible gateways may ignore this field; when ignored, extraction still cleans the output.
  if (req.mode === 'fast') {
    body.thinking = { type: 'disabled' };
  }
  return body;
}

export async function* streamAnthropicMessages(
  p: ProviderConfig,
  req: LlmRequest,
): AsyncGenerator<StreamChunk, void, unknown> {
  const url = resolveAnthropicMessagesUrl(p.baseUrl);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': providerApiKey(p),
      authorization: `Bearer ${providerApiKey(p)}`,
      'anthropic-version': '2023-06-01',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(buildAnthropicBody(p, req, true)),
    signal: req.signal,
  redirect: 'manual',
  });

  if (!res.ok) {
    const raw = await res.text();
    // If the gateway rejected the request for disabling `thinking`, fall back once without the field.
    if (req.mode === 'fast' && (res.status === 400 || res.status === 422)) {
      try {
        const fallbackReq = { ...req, mode: 'deep' as const };
        // Using `deep` mode here just suppresses `thinking.disabled`; original `maxTokens` is still used.
        const body = buildAnthropicBody(p, fallbackReq, true);
        delete body.thinking;
        body.max_tokens = req.maxTokens ?? LLM_TOKEN_LIMITS.hover.maxTokens;
        body.temperature = req.temperature ?? LLM_TOKEN_LIMITS.hover.temperature;
        const retry = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': providerApiKey(p),
            authorization: `Bearer ${providerApiKey(p)}`,
            'anthropic-version': '2023-06-01',
            accept: 'text/event-stream',
          },
          body: JSON.stringify(body),
          signal: req.signal,
        redirect: 'manual',
        });
        if (retry.ok && retry.body) {
          yield* readAnthropicSse(retry, p, req);
          return;
        }
      } catch {
        /* fallthrough */
      }
    }
    try {
      const full = await callAnthropicMessages(p, req);
      if (full.thinking) yield { kind: 'thinking' as const, text: full.thinking };
      if (full.text) yield { kind: 'text' as const, text: full.text };
      if (full.text || full.thinking) return;
    } catch {
      /* fallthrough */
    }
    // A-01: error-message sanitization — url/raw only ever reach the log; the client sees only the safe message.
    throw new LlmCallError(res.status, `模型流式生成失败（HTTP ${res.status}）`, {
      url,
      raw: raw.slice(0, 500),
    });
  }
  if (!res.body) {
    const full = await callAnthropicMessages(p, req);
    if (full.thinking) yield { kind: 'thinking' as const, text: full.thinking };
    if (full.text) yield { kind: 'text' as const, text: full.text };
    return;
  }

  yield* readAnthropicSse(res, p, req);
}

async function* readAnthropicSse(
  res: Response,
  p: ProviderConfig,
  req: LlmRequest,
): AsyncGenerator<StreamChunk, void, unknown> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let textBuf = '';
  let thinkingBuf = '';

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
            type?: string;
            delta?: { type?: string; text?: string; thinking?: string };
            content_block?: { type?: string; text?: string; thinking?: string };
          };

          if (evt.type === 'content_block_start' && evt.content_block) {
            const cb = evt.content_block;
            if (cb.type === 'text' && cb.text) {
              textBuf += cb.text;
              yield { kind: 'text' as const, text: cb.text };
            }
            if (cb.type === 'thinking' && cb.thinking) {
              thinkingBuf += cb.thinking;
              yield { kind: 'thinking' as const, text: cb.thinking };
            }
          }

          if (evt.type === 'content_block_delta' && evt.delta) {
            const d = evt.delta;
            if ((d.type === 'text_delta' || d.type === 'text') && d.text) {
              textBuf += d.text;
              yield { kind: 'text' as const, text: d.text };
              continue;
            }
            if (
              (d.type === 'thinking_delta' || d.type === 'thinking') &&
              typeof d.thinking === 'string' &&
              d.thinking
            ) {
              thinkingBuf += d.thinking;
              yield { kind: 'thinking' as const, text: d.thinking };
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    if (req.signal?.aborted || (e instanceof Error && e.name === 'AbortError')) return;
    throw e;
  }

  // If no chunks arrived over the whole stream, fall back to a non-stream call.
  if (!textBuf.trim() && !thinkingBuf.trim() && !req.signal?.aborted) {
    const full = await callAnthropicMessages(p, req);
    if (full.thinking) yield { kind: 'thinking' as const, text: full.thinking };
    if (full.text) yield { kind: 'text' as const, text: full.text };
  }
}

export async function callAnthropicMessages(p: ProviderConfig, req: LlmRequest): Promise<LlmResponse> {
  const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const messages = req.messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'user' && req.images?.length && p.vision) {
        const content: unknown[] = [{ type: 'text', text: m.content }];
        for (const img of req.images) {
          if (img.startsWith('data:')) {
            const [meta, data] = img.split(',');
            const mediaType = meta.match(/data:(.*?);/)?.[1] || 'image/png';
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data },
            });
          } else {
            content.push({
              type: 'image',
              source: { type: 'url', url: img },
            });
          }
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

  // StepFun-class models may emit primarily thinking blocks; too-small budgets get truncated.
  const { maxTokens, temperature } = tokenDefaults(req);
  const url = resolveAnthropicMessagesUrl(p.baseUrl);

  const body: AnthropicRequestBody = {
    model: p.model,
    max_tokens: maxTokens,
    temperature,
    system: system || undefined,
    messages,
  };
  // Hover: try to disable thinking (gateways may ignore it; when ignored, extraction still cleans the output).
  if (req.mode === 'fast') {
    body.thinking = { type: 'disabled' };
  }

  const doFetch = async (payload: AnthropicRequestBody) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': providerApiKey(p),
        authorization: `Bearer ${providerApiKey(p)}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    redirect: 'manual',
    });
    const raw = await res.text();
    let data: AnthropicResponseBody = {};
    try {
      data = JSON.parse(raw) as AnthropicResponseBody;
    } catch {
      data = { raw: raw.slice(0, 300) };
    }
    return { res, raw, data };
  };

  let { res, raw, data } = await doFetch(body);

  if (!res.ok && req.mode === 'fast' && body.thinking && (res.status === 400 || res.status === 422)) {
    delete body.thinking;
    ({ res, raw, data } = await doFetch(body));
  }

  if (!res.ok) {
    // A-01: url/raw only ever reach the log; the client sees only the safe message.
    throw new LlmCallError(res.status, `模型调用失败（HTTP ${res.status}）`, {
      url,
      raw: raw.slice(0, 500),
    });
  }

  const { text, thinking } = extractAnthropicParts(data);
  const visible = extractVisibleAnswer(thinking, text);
  return {
    text: visible.answer,
    thinking: visible.thinking || thinking,
    model: p.model,
    format: 'anthropic_messages',
    usage: {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    },
  };
}

export function extractAnthropicParts(data: AnthropicResponseBody): { text: string; thinking: string } {
  const content = data.content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    const thoughts: string[] = [];
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const b = block as { type?: string; text?: string; thinking?: string };
      // D-02: blocks without a `type` no longer fall through as body content (avoid mistaking thinking blocks for body).
      if (b.type === 'text' && b.text) texts.push(String(b.text));
      if (b.type === 'thinking' && b.thinking) thoughts.push(String(b.thinking));
    }
    return { text: texts.join(''), thinking: thoughts.join('') };
  }
  if (typeof data.completion === 'string') return { text: data.completion, thinking: '' };
  if (typeof data.output_text === 'string') return { text: data.output_text, thinking: '' };
  return { text: '', thinking: '' };
}
