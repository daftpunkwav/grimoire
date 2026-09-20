/**
 * @file resilience
 * @description Per-process circuit breaker (R-01) and concurrency bulkhead (R-02) for the LLM gateway.
 *
 * Responsibilities:
 * - Isolate breakers by `provider.id::provider.baseUrl` — each BYOK user is independent; server-side providers share.
 * - Count only real upstream faults (5xx / network / 408 timeout); 4xx is a caller-side configuration problem and does not trip the breaker.
 * - In `half_open`, allow exactly one probe request: success closes the breaker, failure re-opens it.
 * - Provide a process-level semaphore: over-capacity callers wait `LLM_QUEUE_WAIT_MS`, otherwise fast 503 (degrade, do not pile up).
 * - In multi-replica deployments each instance counts independently (accepted weak consistency; see docs P2-4).
 *
 * No provider knowledge lives here — only breaker and bulkhead mechanics.
 */
import { logger } from '@grimoire/foundation';
import { LlmCallError, isAbortError, isRetriable } from './providerHttp.js';

type CircuitState = 'closed' | 'open' | 'half_open';

interface Circuit {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number;
  probeInFlight: boolean;
}

/** Consecutive failures that trip the breaker (overridable via `LLM_CIRCUIT_FAILURES`). */
const FAILURE_THRESHOLD = Math.max(
  1,
  parseInt(process.env.LLM_CIRCUIT_FAILURES || '3', 10) || 3,
);
/** Open-circuit cooldown (overridable via `LLM_CIRCUIT_OPEN_MS`). */
const OPEN_MS = Math.max(
  1000,
  parseInt(process.env.LLM_CIRCUIT_OPEN_MS || '30000', 10) || 30000,
);

const circuits = new Map<string, Circuit>();

function circuitKey(provider: { id: string; baseUrl: string }): string {
  return `${provider.id}::${provider.baseUrl}`;
}

/** Whether this error counts as an upstream fault (breaker counter scope: 5xx / network layer / timeout; intentional cancels and 4xx do not count). */
function isProviderFault(err: unknown): boolean {
  if (err instanceof LlmCallError) return isRetriable(err) || err.status === 408;
  if (err instanceof TypeError) return true; // fetch network-layer failure
  return false;
}

/**
 * Pre-call check: when the breaker is open, fail fast with 503; when the cooldown has elapsed, transition to half-open and let exactly one probe through.
 * When a probe is already in flight, every other request fails fast (no concurrent probes).
 */
export function assertCircuitClosed(provider: { id: string; baseUrl: string }): void {
  const key = circuitKey(provider);
  const c = circuits.get(key);
  if (!c || c.state === 'closed') return;

  if (c.state === 'open') {
    if (Date.now() - c.openedAt < OPEN_MS) {
      throw new LlmCallError(503, '模型暂时不可用（熔断保护中），请稍后重试', { url: '', raw: '' });
    }
    c.state = 'half_open';
    c.probeInFlight = false;
    logger.info({ event: 'llm_circuit_half_open', provider: key }, 'llm circuit half-open');
  }

  if (c.probeInFlight) {
    throw new LlmCallError(503, '模型恢复探测中，请稍后重试', { url: '', raw: '' });
  }
  c.probeInFlight = true;
}

/**
 * Clear the half-open probe flag (P0-1 fix): called when a probe request ends without completing the call (client disconnect, hover early-stop, slot-queue timeout).
 * Prevents `probeInFlight` from being stuck forever, which would turn every subsequent request into a 503.
 * Idempotent: no-op when not half-open or no probe is in flight.
 */
export function releaseCircuitProbe(provider: { id: string; baseUrl: string }): void {
  const key = circuitKey(provider);
  const c = circuits.get(key);
  if (c?.state === 'half_open' && c.probeInFlight) {
    c.probeInFlight = false;
    logger.info({ event: 'llm_circuit_probe_released', provider: key }, 'llm circuit probe released');
  }
}

export function recordProviderSuccess(provider: { id: string; baseUrl: string }): void {
  const key = circuitKey(provider);
  const c = circuits.get(key);
  if (c && c.state !== 'closed') {
    logger.info({ event: 'llm_circuit_closed', provider: key }, 'llm circuit closed');
  }
  circuits.delete(key);
}

export function recordProviderFailure(provider: { id: string; baseUrl: string }, err: unknown): void {
  const key = circuitKey(provider);
  const c = circuits.get(key);

  // Half-open probe finished: a fault-class error re-opens the breaker; a non-fault (e.g. client-cancel) just clears the probe flag and stays half-open.
  if (c?.state === 'half_open') {
    c.probeInFlight = false;
    if (isProviderFault(err)) {
      c.state = 'open';
      c.openedAt = Date.now();
      logger.warn({ event: 'llm_circuit_reopen', provider: key }, 'llm circuit re-opened');
    }
    return;
  }

  if (!isProviderFault(err) || isAbortError(err)) return;

  const next: Circuit = c || {
    state: 'closed',
    consecutiveFailures: 0,
    openedAt: 0,
    probeInFlight: false,
  };
  next.consecutiveFailures += 1;
  if (next.consecutiveFailures >= FAILURE_THRESHOLD) {
    next.state = 'open';
    next.openedAt = Date.now();
    logger.warn(
      {
        event: 'llm_circuit_open',
        provider: key,
        failures: next.consecutiveFailures,
        openMs: OPEN_MS,
      },
      'llm circuit opened',
    );
  }
  circuits.set(key, next);
}

/** Test-only: clear all breaker state. */
export function resetCircuits(): void {
  circuits.clear();
}

// ---------------- R-02 concurrency bulkhead ----------------

/** Maximum concurrent LLM calls per process (overridable via `LLM_MAX_CONCURRENT`). */
const MAX_CONCURRENT = Math.max(
  1,
  parseInt(process.env.LLM_MAX_CONCURRENT || '12', 10) || 12,
);
/** Queue wait before a fast 503 (overridable via `LLM_QUEUE_WAIT_MS`). */
const QUEUE_WAIT_MS = Math.max(
  0,
  parseInt(process.env.LLM_QUEUE_WAIT_MS || '5000', 10) || 5000,
);

let inFlight = 0;
const waiters: Array<{ resolve: () => void }> = [];

function makeRelease(): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    inFlight -= 1;
    // Hand the slot directly to the head of the waiter queue to avoid thundering-herd contention.
    const next = waiters.shift();
    if (next) {
      inFlight += 1;
      next.resolve();
    }
  };
}

/**
 * Acquire an LLM concurrency slot; returns a release function (must be called in `finally`).
 * When the queue is full, callers wait up to `LLM_QUEUE_WAIT_MS`; otherwise fast 503 (degrade, never queue forever).
 */
export async function acquireLlmSlot(): Promise<() => void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight += 1;
    return makeRelease();
  }
  await new Promise<void>((resolve, reject) => {
    const entry = {
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
    };
    const timer = setTimeout(() => {
      const i = waiters.indexOf(entry);
      if (i >= 0) waiters.splice(i, 1);
      // `code='LLM_CAPACITY'`: local concurrency full (upstream-agnostic); failover skips this so the chain does not idle.
      reject(new LlmCallError(503, 'AI 服务繁忙，请稍后重试', { url: '', raw: '' }, 'LLM_CAPACITY'));
    }, QUEUE_WAIT_MS);
    waiters.push(entry);
  });
  return makeRelease();
}

/** Test/observability helper. */
export function llmSlotStats(): { inFlight: number; queued: number; max: number } {
  return { inFlight, queued: waiters.length, max: MAX_CONCURRENT };
}
