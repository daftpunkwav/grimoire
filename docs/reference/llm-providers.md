# LLM providers

> Language: **English** | [简体中文](llm-providers.zh.md)

Reference for the LLM gateway: provider invocation, adapter catalog,
breaker semantics, and BYOK decryption. Implementation lives in
[`services/llm`](../../services/llm/).

## Provider catalog

Each provider is a file under
[`services/llm/src/adapters/`](../../services/llm/src/adapters/) that
registers itself with `providerEnv.ts` at module load. Built-in
adapters:

| Adapter | `API_FORMAT` | Notes |
|---|---|---|
| `anthropicMessages` | `anthropic_messages` | StepFun default. Anthropic-compatible; base URL is `/step_plan` (auto `/v1/messages`). |
| `openaiChat` | `openai_chat` | OpenAI Chat Completions. |
| `openaiResponses` | `openai_responses` | OpenAI Responses API. |

A new adapter is a new file under `src/adapters/`, registered by name.
There are no `if/else` branches in `providers.ts`; selection is
data-driven.

## Resolver order

When a request needs an LLM call, `providers.ts` resolves credentials
in this order:

1. **Per-request BYOK** (`LlmKeyAccess` port). The key was decrypted at
   the start of the request and held in a closure for the duration of
   that one outbound call. Plaintext never persists past the call.
2. **Server-side env key**. Read once at process start; held inside the
   breaker context.
3. **Reject**. No key available → 401 `unauthenticated` from the agent
   route.

`LLM_BYOK_FALLBACK_TO_SERVER` (R-04) is **off** by default; setting it
to `1` makes step 2 the fallback when step 1 fails. Document this in
the user-facing settings before turning it on.

## Breaker semantics

A circuit breaker per provider:

- **Failure threshold**: `LLM_CIRCUIT_FAILURES` consecutive failures.
- **Open cooldown**: `LLM_CIRCUIT_OPEN_MS`; during cooldown every call
  fast-fails with `breaker_open` (HTTP 503, `Retry-After` set to the
  remaining cooldown).
- **Half-open**: after the cooldown, a single probe call is allowed;
  success closes the breaker, failure restarts the cooldown.

The breaker holds its time source by injection (`Clock` from
`@grimoire/foundation`), so tests can fast-forward without sleeping.
Module-level `Date.now()` is forbidden in foundation and llm source.

## Concurrency cap

`LLM_MAX_CONCURRENT` caps concurrent outbound calls per provider.
When the cap is hit, callers wait on a queue for up to
`LLM_QUEUE_WAIT_MS`; on timeout, the call returns 503.

## Outbound URL policy

Before any provider call, the resolved base URL + path is checked
against `packages/foundation/src/byokUrlPolicy.ts`:

- **Allow**: a configured allowlist of provider hosts.
- **Deny**: any host not on the allowlist (SSRF guard).

A violation returns 502 `provider_error` and is logged with the
request id.

## Adapter contract

Every adapter exports the same shape:

```ts
export interface ProviderAdapter {
  readonly id: string;                                  // e.g. "anthropic_messages"
  invoke(args: InvokeArgs, ctx: InvokeContext): Promise<InvokeResult>;
}
```

- `InvokeArgs` is the provider-agnostic input (messages, tools,
  temperature, max tokens, stream flag).
- `InvokeContext` carries the resolved credentials, breaker, request
  id, and `Clock`.
- `InvokeResult` is the provider-agnostic output (text delta stream,
  usage tokens, finish reason).

The orchestrator in `services/agent` consumes the agnostic shape; the
adapter owns the provider-specific translation.

## Adding a new provider

1. Add a file under `services/llm/src/adapters/<provider>.ts`.
2. Register the adapter in `services/llm/src/providerEnv.ts` and in
   `services/llm/src/config.ts`.
3. Add env vars to `.env.example` and document them in
   [`configuration.md`](./configuration.md#llm-providers).
4. Add a test that drives the adapter against a mock HTTP server.
5. Update the front-end provider list (`apps/web`) so the user can
   pick the new provider in settings.
