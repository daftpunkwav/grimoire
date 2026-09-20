/**
 * @file sse
 * @description Server-Sent Events (SSE) helpers and session lifecycle (split from routes/agent.ts).
 *
 * Responsibilities:
 * - initSse / sseWrite: low-level response header + frame writer
 * - startSseHeartbeat: keep-alive ping (R-05) against proxies / NAT idle timeouts
 * - createSseSession / endSseSession (B-10): unified session with heartbeat, abort signal, and cleanup
 * - softStreamHoverAnswer: sentence-by-sentence stream with a small gap for readability (C-08)
 */
import type { Request, Response } from 'express';

export function initSse(res: Response) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

export function sseWrite(res: Response, obj: unknown) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * R-05: SSE heartbeat — write a comment line every `intervalMs` to prevent idle disconnects
 * through reverse proxies / NAT. Returns a stopper that MUST be called during response teardown.
 * Clients only parse `data:` lines; comment lines are ignored by spec, so the contract is unchanged.
 */
export function startSseHeartbeat(res: Response, intervalMs = 15_000): () => void {
  const timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    try {
      res.write(': ping\n\n');
    } catch {
      /* Connection already broken — teardown will handle it. */
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

/** SSE session handle: unifies heartbeat, abort signal, and teardown resources (B-10 single-point cleanup). */
export type SseSession = {
  res: Response;
  /** Fires when the client disconnects or abort() is called; for upstream cancellation / early-stop. */
  signal: AbortSignal;
  /** Response has ended or the connection has been destroyed (client disconnect). */
  gone(): boolean;
  /** Trigger the signal (used by hover early-stop). */
  abort(): void;
  /** Stop heartbeat + remove close listener (idempotent); call during teardown. */
  stop(): void;
};

/**
 * Create an SSE session: initSse + heartbeat + auto-abort upstream on client disconnect.
 * Caller is responsible for: streaming → (success) sseWrite(done) / (failure) sseWrite(error) → finally endSseSession.
 */
export function createSseSession(req: Request, res: Response): SseSession {
  initSse(res);
  const stopHeartbeat = startSseHeartbeat(res);
  const controller = new AbortController();
  let stopped = false;
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  req.on('close', onClose);
  return {
    res,
    signal: controller.signal,
    gone: () => res.writableEnded || res.destroyed,
    abort: () => controller.abort(),
    stop() {
      if (stopped) return;
      stopped = true;
      stopHeartbeat();
      req.removeListener('close', onClose);
    },
  };
}

/**
 * Unified teardown (B-10): stop heartbeat / unbind listeners → close the unconsumed stream
 * (frees the bulkhead slot) → res.end to prevent double-end.
 *
 * All early-exit paths (cache hit, client disconnect, error) MUST funnel through here.
 */
export async function endSseSession(
  session: SseSession,
  llmStream?: AsyncGenerator<unknown, void, unknown>,
): Promise<void> {
  session.stop();
  if (llmStream) {
    try {
      await llmStream.return();
    } catch {
      /* Already finished */
    }
  }
  if (!session.res.writableEnded) {
    try {
      session.res.end();
    } catch {
      /* Already closed */
    }
  }
}

/** Sentence-by-sentence soft stream with short delays for readability. */
export async function softStreamHoverAnswer(res: Response, answer: string, gapMs = 36) {
  // C-08: split sentences and append "？" / "…" defensively (isSafeHoverPublicAnswer already
  // rejects "?" so this is a robustness fallback only).
  const pieces =
    answer.match(/[^。！？…]*[。！？…]/g)?.filter((x) => x.trim()) || (answer ? [answer] : []);
  for (let i = 0; i < pieces.length; i++) {
    if (res.writableEnded || res.destroyed) return;
    const piece = pieces[i];
    if (!piece) continue;
    sseWrite(res, { type: 'delta', text: piece });
    if (i < pieces.length - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}
