/**
 * @file toolLoop
 * @description Prompt-based ReAct tool loop (P0) used when the provider has no native tool-calling API.
 *
 * Responsibilities:
 * - Drive the loop: Thought → TOOL_CALL → Observation → … → Final Answer.
 * - Enforce per-iteration and overall-loop timeouts (R-08) with graceful final answers on deadline.
 * - Inject the LlmGatewayPort and the tool executor; this module owns no concrete services.
 * - Emit `tool_call` / `tool_result` / `thinking` / `delta` events for the SSE layer.
 *
 * No native tools API is used here — the model is steered by a single-line `TOOL_CALL:` protocol.
 */
import type { ApiFormat, ChatMessage, ProviderConfig } from '@grimoire/contracts';
import { logger } from '@grimoire/foundation';
import { extractVisibleAnswer } from '@grimoire/foundation';
import { TOOL_LOOP_MAX_ITERS, TOOL_LOOP_OVERALL_MS, TOOL_TIMEOUT_MS } from '../agentConstants.js';
import { parseToolCall } from './parseToolCall.js';
import type { LlmGatewayPort } from '../../ports.js';
import type { ToolLoopEvent } from './types.js';

export type RunToolLoopOpts = {
  provider: ProviderConfig;
  system: string;
  userContent: string;
  maxTokens: number;
  temperature?: number;
  /** Outer cancellation signal (e.g. client disconnect). */
  signal?: AbortSignal;
  maxIters?: number;
  toolTimeoutMs?: number;
  /** R-08: loop-level total timeout override (defaults to TOOL_LOOP_OVERALL_MS). */
  overallTimeoutMs?: number;
  onEvent?: (ev: ToolLoopEvent) => void;
};

export type ToolLoopResult = {
  answer: string;
  thinking: string;
  model: string;
  format: ApiFormat;
  iterations: number;
  hitMaxIters: boolean;
};

/** Factory: inject the LLM gateway and the tool executor. */
export function createToolLoop(
  llm: LlmGatewayPort,
  executeTool: (name: string, rawArgs: unknown, ctx: { signal?: AbortSignal }) => Promise<{
    ok: boolean;
    observation: string;
    ms: number;
  }>,
) {
  function previewObservation(s: string, max = 160): string {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }

  /** Merge the outer abort with the per-tool timeout (the outer signal also drives the loop deadline). */
  function toolSignal(outer: AbortSignal | undefined, timeoutMs: number): AbortSignal {
    const timed = AbortSignal.timeout(timeoutMs);
    if (!outer) return timed;
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any([outer, timed]);
    }
    // Node <20.3 fallback: timeout-only; outer abort is rechecked at the top of the loop.
    return timed;
  }

  /**
   * Synchronous multi-round tool loop. Intermediate rounds use `callLlm` because we need the
   * full text to parse `TOOL_CALL`; `onEvent` pushes `tool_call` / `tool_result` to the SSE layer.
   */
  async function runToolLoop(opts: RunToolLoopOpts): Promise<ToolLoopResult> {
    const maxIters = opts.maxIters ?? TOOL_LOOP_MAX_ITERS;
    const toolTimeoutMs = opts.toolTimeoutMs ?? TOOL_TIMEOUT_MS;
    const messages: ChatMessage[] = [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.userContent },
    ];

    // R-08: loop-level total timeout — prevents 5 rounds × (~30s LLM + 8s tool) ≈ 190s of dead air.
    const overallMs = opts.overallTimeoutMs ?? TOOL_LOOP_OVERALL_MS;
    const deadlineSignal = AbortSignal.timeout(overallMs);
    const loopSignal =
      opts.signal && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([opts.signal, deadlineSignal])
        : opts.signal || deadlineSignal;

    let model = opts.provider.model;
    let format = opts.provider.format;
    let lastThinking = '';
    for (let i = 0; i < maxIters; i++) {
      if (loopSignal.aborted) {
        // R-08: deadline reached → graceful final answer; client disconnect (outer cancel) → normal abort.
        if (deadlineSignal.aborted && !opts.signal?.aborted) {
          logger.warn({ event: 'tool_loop_deadline', iterations: i + 1 }, 'tool loop deadline');
          const answer = '这个问题涉及的检索步骤较多，已超过本轮时限。请缩小问题范围，或关闭「允许工具」直接提问。';
          opts.onEvent?.({ type: 'delta', text: answer });
          return { answer, thinking: lastThinking, model, format, iterations: i + 1, hitMaxIters: true };
        }
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }

      let result: Awaited<ReturnType<LlmGatewayPort['callLlm']>>;
      try {
        result = await llm.callLlm(
          {
            mode: 'deep',
            maxTokens: opts.maxTokens,
            temperature: opts.temperature,
            messages,
            signal: loopSignal,
          },
          opts.provider,
        );
      } catch (e) {
        // R-08: deadline reached — graceful final answer suggesting a narrower question; do not treat as a system fault.
        if (deadlineSignal.aborted && !opts.signal?.aborted) {
          logger.warn({ event: 'tool_loop_deadline', iterations: i + 1 }, 'tool loop deadline');
          const answer = '这个问题涉及的检索步骤较多，已超过本轮时限。请缩小问题范围，或关闭「允许工具」直接提问。';
          opts.onEvent?.({ type: 'delta', text: answer });
          return { answer, thinking: lastThinking, model, format, iterations: i + 1, hitMaxIters: true };
        }
        throw e;
      }
      model = result.model;
      format = result.format;

      const combined = [result.text || '', result.thinking || ''].filter(Boolean).join('\n');
      const toolCall = parseToolCall(combined) || parseToolCall(result.text || '');

      if (!toolCall) {
        const visible = extractVisibleAnswer(result.thinking || '', result.text || '');
        const answer =
          visible.answer ||
          (result.text || '').trim() ||
          '抱歉，这一轮没有生成有效回答，换个问法再试一次。';
        if (visible.thinking) {
          lastThinking = visible.thinking;
          opts.onEvent?.({ type: 'thinking', text: visible.thinking });
        }
        opts.onEvent?.({ type: 'delta', text: answer });
        logger.info(
          { event: 'tool_loop_done', iterations: i + 1, hitMaxIters: false },
          'tool loop finished',
        );
        return {
          answer,
          thinking: lastThinking || visible.thinking,
          model,
          format,
          iterations: i + 1,
          hitMaxIters: false,
        };
      }

      opts.onEvent?.({ type: 'tool_call', name: toolCall.name, args: toolCall.args });

      let exec;
      try {
        exec = await executeTool(toolCall.name, toolCall.args, {
          signal: toolSignal(loopSignal, toolTimeoutMs),
        });
      } catch (e) {
        // R-08: deadline reached inside the tool window — graceful final answer; never silently truncate the stream.
        if (deadlineSignal.aborted && !opts.signal?.aborted) {
          logger.warn({ event: 'tool_loop_deadline', iterations: i + 1 }, 'tool loop deadline');
          const answer = '这个问题涉及的检索步骤较多，已超过本轮时限。请缩小问题范围，或关闭「允许工具」直接提问。';
          opts.onEvent?.({ type: 'delta', text: answer });
          return { answer, thinking: lastThinking, model, format, iterations: i + 1, hitMaxIters: true };
        }
        throw e;
      }

      opts.onEvent?.({
        type: 'tool_result',
        name: toolCall.name,
        ok: exec.ok,
        preview: previewObservation(exec.observation),
      });

      // Append this round's TOOL_CALL and Observation back into the conversation transcript.
      const assistantLine = `TOOL_CALL: ${JSON.stringify({ name: toolCall.name, args: toolCall.args })}`;
      messages.push({ role: 'assistant', content: assistantLine });
      messages.push({
        role: 'user',
        content: `Observation (${toolCall.name}):\n${exec.observation}`,
      });
    }

    logger.warn(
      { event: 'tool_loop_max_iters', maxIters },
      'tool loop hit max iterations',
    );
    const answer =
      '已达到工具调用次数上限，请缩小问题范围或关闭「允许工具」后重试。';
    opts.onEvent?.({ type: 'delta', text: answer });
    return {
      answer,
      thinking: lastThinking,
      model,
      format,
      iterations: maxIters,
      hitMaxIters: true,
    };
  }

  return { runToolLoop };
}

export type ToolLoop = ReturnType<typeof createToolLoop>;
