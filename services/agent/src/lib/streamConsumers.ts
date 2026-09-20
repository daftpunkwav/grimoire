/**
 * @file streamConsumers
 * @description Shared stream-consumption module used by both the explain and chat SSE handlers.
 *
 * Responsibilities:
 * - Accumulate thinking/text chunks.
 * - Per-delta thinking gate for deep mode (drop `isSystemEcho` chunks from `safeThinking`).
 * - Early-stop probe for hover mode (2-sentence safe answer → abort the upstream generator).
 * - Throttle status events (100ms for explain/hover; unthrottled for chat/fast).
 *
 * The route layer keeps the loop skeleton, SSE write-back, and final-event assembly.
 * This module is independent of Express so it can be unit-tested without the router.
 */
import type { StreamChunk } from '@grimoire/contracts';
import { extractHoverAnswer, isSafeHoverPublicAnswer, isSystemEcho } from '@grimoire/contracts';
import { logger } from '@grimoire/foundation';

export type StreamMode = 'hover' | 'fast' | 'deep';

export interface StreamConsumerOptions {
  /** hover: early-stop probe + never relay thinking; fast: status only, no early stop; deep: relay thinking after gating. */
  mode: StreamMode;
  /** Topic used for hover early-stop logging. */
  topic?: string;
  /** Status throttle interval in ms; 0 = unthrottled (chat/fast semantics). */
  statusThrottleMs?: number;
  /** Early-stop probe throttle in ms. */
  probeThrottleMs?: number;
  /** Minimum character delta to trigger an early-stop probe. */
  probeMinDelta?: number;
  /** Abort the upstream stream (used when hover early-stop fires). */
  abort: () => void;
  /** Throttled status callback (hover/fast only). */
  onStatus?: () => void;
  /** Gated safe-thinking chunk callback (deep only). */
  onThinking?: (text: string) => void;
  /** Text-delta callback (deep only). */
  onText?: (text: string) => void;
}

export interface StreamConsumeResult {
  thinkingAcc: string;
  textAcc: string;
  safeThinking: string;
  /** Hover early-stop answer (empty = no early stop fired). */
  earlyAnswer: string;
}

export function createStreamConsumer(opts: StreamConsumerOptions) {
  let thinkingAcc = '';
  let textAcc = '';
  let safeThinking = '';
  let earlyAnswer = '';
  let lastStatusAt = 0;
  let lastProbeAt = 0;
  let lastProbeLen = 0;

  const isHover = opts.mode === 'hover';
  // hover/fast: thinking is never relayed upstream, only status events fire.
  const isQuiet = isHover || opts.mode === 'fast';

  function emitStatus(): void {
    const now = Date.now();
    const throttle = opts.statusThrottleMs ?? 0;
    if (throttle > 0 && now - lastStatusAt < throttle) return;
    lastStatusAt = now;
    opts.onStatus?.();
  }

  function probeEarlyAnswer(): void {
    if (earlyAnswer) return;
    const total = thinkingAcc.length + textAcc.length;
    const now = Date.now();
    if (
      now - lastProbeAt < (opts.probeThrottleMs ?? 220) &&
      total - lastProbeLen < (opts.probeMinDelta ?? 60)
    ) {
      return;
    }
    lastProbeAt = now;
    lastProbeLen = total;
    const candidate = extractHoverAnswer(thinkingAcc, textAcc);
    // Early-stop requires at least 2 sentences to avoid half-sentence premature stop.
    const n = (candidate.match(/[。！]/g) || []).length;
    if (candidate && n >= 2 && isSafeHoverPublicAnswer(candidate)) {
      earlyAnswer = candidate;
      // B-06: log the early-stop hit (token-saving observability).
      logger.info(
        { event: 'hover_early_stop', topic: (opts.topic || '').slice(0, 60), chars: total },
        'hover early stop',
      );
      opts.abort();
    }
  }

  /**
   * Consume a single chunk. Returns `'break'` when the caller should stop (early-stop fired).
   * The caller still owns client-disconnect checks at the top of its loop (sse.gone / signal.aborted).
   */
  function handle(chunk: StreamChunk): 'break' | 'continue' | void {
    if (earlyAnswer) return 'break';
    if (chunk.kind === 'thinking') {
      thinkingAcc += chunk.text;
      if (isQuiet) {
        emitStatus();
        if (isHover) probeEarlyAnswer();
      } else {
        // A-04: drop thinking chunks that echo system rules before they reach the client
        // (final-state gating is the safety net; the stream filter is the first line of defense).
        if (isSystemEcho(chunk.text)) {
          logger.warn({ event: 'thinking_echo_blocked' }, 'thinking echo chunk dropped');
          return 'continue';
        }
        safeThinking += chunk.text;
        opts.onThinking?.(chunk.text);
      }
    } else {
      textAcc += chunk.text;
      if (isQuiet) {
        emitStatus();
        if (isHover) probeEarlyAnswer();
      } else {
        opts.onText?.(chunk.text);
      }
    }
  }

  return {
    handle,
    result(): StreamConsumeResult {
      return { thinkingAcc, textAcc, safeThinking, earlyAnswer };
    },
  };
}

export type StreamConsumer = ReturnType<typeof createStreamConsumer>;
