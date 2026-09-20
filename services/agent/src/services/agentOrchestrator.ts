/**
 * @file agentOrchestrator
 * @description Explain/chat orchestration: context assembly, answer gating, and final persistence.
 *
 * Responsibilities:
 * - Prepare the prompt payload for explain (`runExplain`) and chat (`prepareChat`).
 * - Compute history budget by mode (fast 600 / deep 2000 estimated tokens) from the most recent messages backward.
 * - Build the provider failover chain (BYOK → preferred server provider → others) and surface `NO_PROVIDER` when empty.
 * - Gate hover answers (safety check + empty fallback retry) and finalize chat turns (persist + topic + important memory).
 * - Resolve hover-cache hits both before and after prepping the request (R-06).
 *
 * Split out of `routes/agent.ts` so the route layer stays a thin HTTP/SSE adapter.
 */
import { logger } from '@grimoire/foundation';
import {
  buildDeepSystem,
  buildHoverRetrySystem,
  buildHoverSystem,
  buildReactSystem,
} from '../lib/agentPrompt.js';
import { extractHoverAnswer, isSafeHoverPublicAnswer } from '@grimoire/contracts';
import { HOVER_RETRY_TIMEOUT_MS } from '../lib/agentConstants.js';
import { LLM_TOKEN_LIMITS } from '@grimoire/contracts';
import type { AgentDeps } from '../ports.js';
import type { ProviderConfig } from '@grimoire/contracts';
import type { AgentConversation } from './agentConversation.js';
import type { HoverCache } from './hoverCache.js';
import type { AgentMemory } from './agentMemory.js';
import type { ToolLoop } from '../lib/tools/toolLoop.js';
import type { ChatBody, ExplainBody } from '../schemas.js';
import { mapLlmError, noProviderError } from './llmErrors.js';

export type { ChatBody, ExplainBody } from '../schemas.js';

export function createAgentOrchestrator(
  deps: AgentDeps,
  internal: {
    conversation: AgentConversation;
    hoverCache: HoverCache;
    memory: AgentMemory;
    toolLoop: ToolLoop;
  },
) {
  const { llm } = deps;
  const { conversation, hoverCache, memory, toolLoop } = internal;

  /** Minimal retry on empty answer (no memory, thinking off); A-02: the fallback retry uses a short timeout. */
  async function retryHoverExplain(
    provider: ProviderConfig,
    userMsg: string,
  ): Promise<string> {
    try {
      const result = await llm.callLlm(
        {
          mode: 'fast',
          maxTokens: LLM_TOKEN_LIMITS.hoverRetry.maxTokens,
          temperature: LLM_TOKEN_LIMITS.hoverRetry.temperature,
          messages: [
            { role: 'system', content: buildHoverRetrySystem() },
            { role: 'user', content: userMsg.slice(0, 400) },
          ],
          signal: AbortSignal.timeout(HOVER_RETRY_TIMEOUT_MS),
        },
        provider,
      );
      const answer = extractHoverAnswer(result.thinking || '', result.text || '');
      if (answer && isSafeHoverPublicAnswer(answer)) {
        logger.info({ event: 'hover_retry_ok' }, 'hover retry ok');
        return answer;
      }
      logger.warn({ event: 'hover_retry_fail' }, 'hover retry fail');
      return '';
    } catch (e) {
      logger.warn({ event: 'hover_retry_fail', err: String(e) }, 'hover retry fail');
      return '';
    }
  }

  /**
   * Hover answer gate + empty fallback retry (B-02: sync and streaming share the same trigger semantics).
   * `candidate` is the already-extracted hover candidate; if unsafe, blank it; if blank, retry once.
   */
  async function finalizeHoverAnswer(
    provider: ProviderConfig,
    userMsg: string,
    candidate: string,
    onRetry?: () => void,
  ): Promise<string> {
    let answer = candidate;
    if (answer && !isSafeHoverPublicAnswer(answer)) answer = '';
    if (!answer) {
      onRetry?.();
      answer = await retryHoverExplain(provider, userMsg);
    }
    return answer;
  }

  /** B-09: rough token estimate (CJK ~1.5 chars/token, English ~0.25 words/token), used for the history budget. */
  function estimateTokens(s: string): number {
    const cn = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const rest = s.length - cn;
    return Math.ceil(cn / 1.5 + rest / 4);
  }

  /** B-09: history block token budget — fast 600 / deep 2000, accumulated from the most recent message backward. */
  const HISTORY_TOKEN_BUDGET = { fast: 600, deep: 2000 } as const;

  /**
   * B-02: chat sync/streaming shared context assembly.
   * History is accumulated from the most recent backward, bounded by the mode's token budget
   * (conv.summary rolling digest + recent messages, not a fixed 12-message dump).
   * `reasoningMode=react` or `toolsEnabled` → ReAct system prompt + real tool loop.
   */
  function resolveReactEnabled(body: ChatBody): boolean {
    return body.reasoningMode === 'react' || body.toolsEnabled === true;
  }

  async function prepareChat(body: ChatBody, userId: string | undefined) {
    const ctx = await memory.loadUserContext(userId, body.context?.route);
    // R-04: failover chain (BYOK → preferred server provider → others); `provider` is used for metadata/prompting, `chain` is used for the call.
    const chain = llm.resolveProviderChain(ctx.byok);
    if (!chain.length) throw noProviderError();
    const provider = chain[0];

    const style = body.style || ctx.style;
    const mode = body.mode || 'deep';
    const reactEnabled = resolveReactEnabled(body);
    const conv = await conversation.ensureConversation(userId, {
      conversationId: body.conversationId,
      guestKey: body.guestKey,
    });
    const recent = await conversation.loadRecentMessages(conv.id);
    const budget = HISTORY_TOKEN_BUDGET[mode];
    const rows: string[] = [];
    let used = 0;
    for (const m of [...recent].reverse()) {
      const line = `${m.role}: ${m.content.slice(0, 400)}`;
      const t = estimateTokens(line);
      if (rows.length && used + t > budget) break;
      rows.push(line);
      used += t;
    }
    const historyBlock = rows.join('\n');
    const systemBase = reactEnabled
      ? buildReactSystem(style, ctx.memoryBlock)
      : mode === 'fast'
        ? buildHoverSystem(style, ctx.memoryBlock)
        : buildDeepSystem(style, ctx.memoryBlock);
    const system = [
      systemBase,
      conv.summary ? `【会话摘要】\n${conv.summary}` : '',
      historyBlock ? `【近期对话】\n${historyBlock}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const userContent = [
      body.message,
      body.context?.route ? `（当前路由 ${body.context.route}）` : '',
      body.context?.articleSlug ? `（文章 ${body.context.articleSlug}）` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { ctx, provider, chain, style, mode, reactEnabled, conv, system, userContent };
  }

  /** B-02: chat sync/streaming shared finalization — persist turn, topic memory, important memory. */
  async function finalizeChatTurn(
    convId: string,
    userId: string | undefined,
    userMsg: string,
    answer: string,
    thinking: string,
  ) {
    await conversation.persistTurn(convId, userMsg, { content: answer, thinking });
    void memory.rememberTopic(userId, userMsg, 'chat');
    void memory.maybeSaveImportantMemory(userId, userMsg, answer);
  }

  function llmError(err: unknown) {
    return mapLlmError(llm, err);
  }
  async function runExplain(body: ExplainBody, userId: string | undefined) {
    const ctx = await memory.loadUserContext(userId, body.selection.route);
    // R-04: failover chain; `provider` is used for metadata/prompting, `chain` is used for the call.
    const chain = llm.resolveProviderChain(ctx.byok);
    if (!chain.length) throw noProviderError();
    const provider = chain[0];

    const style = body.style || ctx.style;
    const isHover = body.mode === 'hover';
    const system = isHover
      ? buildHoverSystem(style, ctx.memoryBlock)
      : buildDeepSystem(style, ctx.memoryBlock);

    const topic = body.selection.title
      ? `${body.selection.title}\n${body.selection.text}`
      : body.selection.text;

    // Hover user content carries only the knowledge point; the constraints live in the system prompt
    // to avoid the model parroting "in 2-3 sentences…" back to the user (bug-4).
    const userMsg = isHover
      ? [
          (body.selection.title || '').trim() || topic.slice(0, 200),
          body.selection.text &&
          body.selection.text.trim() &&
          body.selection.text.trim() !== (body.selection.title || '').trim()
            ? body.selection.text.trim().slice(0, 280)
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `【待讲解片段】\n${topic}`,
          body.selection.context ? `【所在段落/上下文】\n${body.selection.context}` : '',
          body.selection.route ? `页面：${body.selection.route}` : '',
          body.selection.articleSlug ? `文章：${body.selection.articleSlug}` : '',
          '请针对该知识点详细讲解，按 ReAct 风格结构输出。',
        ]
          .filter(Boolean)
          .join('\n\n');

    return {
      provider,
      chain,
      style,
      isHover,
      system,
      userMsg,
      topic: body.selection.text,
      mode: body.mode,
    };
  }

  /**
   * R-06: hover cache-hit strategy shared by the sync and streaming endpoints.
   * First probe with the default style (the cache is the degradation layer; Provider resolution can be skipped).
   * On miss, if the prep step resolved a different real style, probe once more with that style.
   */
  async function resolveHoverCacheHit(
    body: ExplainBody,
    prep?: Pick<ExplainPrep, 'isHover' | 'topic' | 'style'>,
  ): Promise<{ style: string; answer: string } | null> {
    if (body.mode !== 'hover') return null;
    const preStyle = body.style || 'professional'; // Matches the default style used by `loadUserContext`.
    const preCached = await hoverCache.getHoverCacheSafe(body.selection.text, preStyle);
    if (preCached) return { style: preStyle, answer: preCached };
    if (!prep?.isHover) return null;
    const preChecked = preStyle === prep.style;
    if (preChecked) return null;
    const cached = await hoverCache.getHoverCacheSafe(prep.topic, prep.style);
    return cached ? { style: prep.style, answer: cached } : null;
  }

  return {
    retryHoverExplain,
    finalizeHoverAnswer,
    estimateTokens,
    resolveReactEnabled,
    prepareChat,
    finalizeChatTurn,
    llmError,
    noProviderError,
    runExplain,
    resolveHoverCacheHit,
    toolLoop,
    memory,
  };
}

export type ExplainPrep = Awaited<ReturnType<ReturnType<typeof createAgentOrchestrator>['runExplain']>>;
export type AgentOrchestrator = ReturnType<typeof createAgentOrchestrator>;
