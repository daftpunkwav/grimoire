/**
 * @file explain
 * @description Hover/click explain routes (sync + SSE).
 *
 * Responsibilities:
 * - Mount `POST /explain` (sync) and `POST /explain/stream` (SSE) on the agent router.
 * - Apply hover rate limit and optional auth.
 * - Resolve a hover-cache hit before contacting the LLM, both before and after prepping the request.
 * - Stream thinking/text deltas via the shared `createStreamConsumer` and write the final frame.
 * - Persist topic memory and (when allowed) populate the hover cache after a successful hover answer.
 *
 * Split out of `routes/agent.ts` so a single file does not own both conversation and memory.
 */
import type { RequestHandler, Router } from 'express';
import {
  logger,
  optionalAuth,
  validate,
  createSseSession,
  endSseSession,
  sseWrite,
  softStreamHoverAnswer,
} from '@grimoire/foundation';
import { extractVisibleAnswer } from '@grimoire/foundation';
import type { LlmResponse, ProviderConfig, StreamChunk } from '@grimoire/contracts';
import { extractHoverAnswer, looksLikeHoverPlanning, LLM_TOKEN_LIMITS } from '@grimoire/contracts';
import { explainSchemaFixed } from '../schemas.js';
import { createStreamConsumer } from '../lib/streamConsumers.js';
import { AGENT_MODE_META } from '../lib/agentPrompt.js';
import type { AgentRuntime } from '../runtime.js';
import {
  hoverCacheJson,
  sseWriteHoverCache,
  writeAgentSseError,
} from './agentSseHelpers.js';

export function mountExplainRoutes(
  agentRouter: Router,
  runtime: AgentRuntime,
  agentHoverLimiter: RequestHandler,
): void {
  const { hoverCache, memory, orchestrator, deps } = runtime;
  const { llm } = deps;
  const { finalizeHoverAnswer, llmError, resolveHoverCacheHit, runExplain } = orchestrator;

  agentRouter.post(
    '/explain',
    agentHoverLimiter,
    optionalAuth,
    validate(explainSchemaFixed),
    async (req, res, next) => {
      try {
        const body = req.body as Parameters<typeof runExplain>[0];

        const hit = await resolveHoverCacheHit(body);
        if (hit) {
          res.json(hoverCacheJson(body, hit.style, hit.answer));
          return;
        }

        const prep = await runExplain(body, req.user?.id);

        const hit2 = await resolveHoverCacheHit(body, prep);
        if (hit2) {
          res.json(hoverCacheJson(body, hit2.style, hit2.answer));
          return;
        }

        let result: LlmResponse;
        let servedBy: ProviderConfig;
        try {
          const r = await llm.callLlmWithFallback(
            {
              mode: prep.isHover ? 'fast' : 'deep',
              maxTokens: prep.isHover ? LLM_TOKEN_LIMITS.hover.maxTokens : LLM_TOKEN_LIMITS.clickDeep.maxTokens,
              temperature: prep.isHover ? LLM_TOKEN_LIMITS.hover.temperature : undefined,
              messages: [
                { role: 'system', content: prep.system },
                { role: 'user', content: prep.userMsg },
              ],
            },
            prep.chain,
          );
          result = r.result;
          servedBy = r.provider;
        } catch (e) {
          throw llmError(e);
        }
        let explanation = prep.isHover
          ? extractHoverAnswer(result.thinking || '', result.text || '')
          : extractVisibleAnswer(result.thinking || '', result.text || '').answer;
        if (prep.isHover) {
          explanation = await finalizeHoverAnswer(servedBy, prep.userMsg, explanation);
          if (explanation) void hoverCache.setHoverCache(prep.topic, prep.style, explanation);
        } else if (explanation && looksLikeHoverPlanning(explanation)) {
          logger.warn({ event: 'deep_planning_leak', mode: body.mode }, 'deep answer looks like planning');
        }
        void memory.rememberTopic(req.user?.id, prep.topic, body.mode);
        res.json({
          explanation,
          mode: body.mode,
          model: result.model,
          format: result.format,
          style: prep.style,
          providerId: servedBy.id,
          cached: false,
          meta: prep.isHover ? AGENT_MODE_META.fast : AGENT_MODE_META.deep,
        });
      } catch (e) {
        next(e);
      }
    },
  );

  agentRouter.post(
    '/explain/stream',
    agentHoverLimiter,
    optionalAuth,
    validate(explainSchemaFixed),
    async (req, res, _next) => {
      const sse = createSseSession(req, res);
      let llmStream: AsyncGenerator<StreamChunk, void, unknown> | undefined;
      let servedBy: ProviderConfig | undefined;
      try {
        const body = req.body as Parameters<typeof runExplain>[0];

        const hit = await resolveHoverCacheHit(body);
        if (hit) {
          sseWriteHoverCache(res, body, hit.style, hit.answer);
          await endSseSession(sse);
          return;
        }

        const prep = await runExplain(body, req.user?.id);

        const hit2 = await resolveHoverCacheHit(body, prep);
        if (hit2) {
          sseWriteHoverCache(res, body, hit2.style, hit2.answer);
          await endSseSession(sse);
          return;
        }

        const consumer = createStreamConsumer({
          mode: prep.isHover ? 'hover' : 'deep',
          topic: prep.topic,
          statusThrottleMs: 100,
          abort: () => sse.abort(),
          onStatus: () => sseWrite(res, { type: 'status', status: 'thinking' }),
          onThinking: (text) => sseWrite(res, { type: 'thinking', text }),
          onText: (text) => sseWrite(res, { type: 'delta', text }),
        });

        const resolved = await llm.resolveStreamWithFallback(
          {
            mode: prep.isHover ? 'fast' : 'deep',
            maxTokens: prep.isHover ? LLM_TOKEN_LIMITS.hover.maxTokens : LLM_TOKEN_LIMITS.clickDeep.maxTokens,
            temperature: prep.isHover ? LLM_TOKEN_LIMITS.hover.temperature : undefined,
            signal: sse.signal,
            messages: [
              { role: 'system', content: prep.system },
              { role: 'user', content: prep.userMsg },
            ],
          },
          prep.chain,
        );
        servedBy = resolved.provider;
        llmStream = resolved.stream;

        sseWrite(res, {
          type: 'meta',
          model: servedBy.model,
          format: servedBy.format,
          providerId: servedBy.id,
          mode: body.mode,
          style: prep.style,
          meta: prep.isHover ? AGENT_MODE_META.fast : AGENT_MODE_META.deep,
        });

        try {
          for await (const chunk of resolved.stream) {
            if (sse.gone()) {
              sse.abort();
              return;
            }
            if (consumer.handle(chunk) === 'break') break;
          }
        } catch (e) {
          if (!(e instanceof Error && e.name === 'AbortError') && !consumer.result().earlyAnswer && !sse.signal.aborted) {
            throw e;
          }
        }
        if (sse.gone()) {
          return;
        }
        const { thinkingAcc, textAcc, safeThinking, earlyAnswer } = consumer.result();
        if (prep.isHover) {
          const answer = await finalizeHoverAnswer(
            servedBy,
            prep.userMsg,
            earlyAnswer || extractHoverAnswer(thinkingAcc, textAcc),
            () => sseWrite(res, { type: 'status', status: 'thinking' }),
          );
          if (answer) {
            void hoverCache.setHoverCache(prep.topic, prep.style, answer);
            await softStreamHoverAnswer(res, answer, 36);
          }
          sseWrite(res, {
            type: 'final',
            answer: answer || '',
            thinking: '',
            complete: Boolean(answer),
          });
        } else {
          const visible = extractVisibleAnswer(thinkingAcc, textAcc);
          if (visible.answer && looksLikeHoverPlanning(visible.answer)) {
            logger.warn(
              { event: 'deep_planning_leak', mode: body.mode },
              'deep answer looks like planning',
            );
          }
          sseWrite(res, {
            type: 'final',
            answer: visible.answer,
            thinking: safeThinking,
          });
        }
        sseWrite(res, { type: 'done' });
        void memory.rememberTopic(req.user?.id, prep.topic, body.mode);
      } catch (e) {
        writeAgentSseError(sse, res, llm, e, '讲解生成失败，请稍后重试');
      } finally {
        await endSseSession(sse, llmStream);
      }
    },
  );
}
