# `@grimoire/llm`

> Language: **English** | [简体中文](README.zh.md)

LLM gateway: providers, adapters, breaker, and BYOK decryption. The
**only** workspace that holds provider credentials.

## Responsibilities

- **Provider invocation** (`LlmProvider` port): dispatches to one of
  three adapters — `anthropicMessages`, `openaiChat`,
  `openaiResponses` — based on the configured `LLM_PROVIDER_ID` and the
  per-key `API_FORMAT`.
- **BYOK decryption** (`LlmKeyAccess` port): decrypts the per-user
  BYOK blob (written by `services/identity`) and exposes it only for the
  duration of one outbound request. Never logs, caches, or returns the
  decrypted key to a caller.
- **Resilience** (`resilience.ts`): in-process breaker per provider
  (`LLM_CIRCUIT_FAILURES`, `LLM_CIRCUIT_OPEN_MS`), per-provider
  concurrency cap (`LLM_MAX_CONCURRENT`, `LLM_QUEUE_WAIT_MS`),
  and a deny-list policy applied to outbound URLs (`byokUrlPolicy` from
  `@grimoire/foundation`).
- **Adapter catalog**: each adapter is a `*.ts` file under
  `src/adapters/`, registering itself with `providerEnv.ts`.

## Layout

```
src/
  index.ts                barrel: public exports
  config.ts               provider catalog + adapter selection
  providers.ts            LlmProvider port impl
  providerEnv.ts          load provider env (key, base URL, model)
  providerHttp.ts         shared HTTP client with retry / breaker hooks
  providerSecret.ts       BYOK decrypt for one request
  resilience.ts           circuit breaker + concurrency cap + queue
  types.ts                LLM request / response types
  adapters/
    anthropicMessages.ts  Anthropic Messages API
    openaiChat.ts         OpenAI Chat Completions
    openaiResponses.ts    OpenAI Responses API
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/llm build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/llm typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/llm test` | Vitest run. |
| `pnpm --filter @grimoire/llm lint` | oxlint. |

## Dependencies

Runtime: `@grimoire/contracts`, `@grimoire/foundation`. Dev: `vitest`,
`oxlint`, `typescript`.

## Conventions

- Provider credentials are loaded once at process start via
  `providerEnv.ts`. After startup they live only inside the breaker
  context, never in module-level constants.
- Adapter selection is data-driven: a new provider is a new file under
  `src/adapters/`, registered by name. No conditional `if/else` inside
  `providers.ts`.
- The breaker holds the time source by injection (`Clock` from
  `@grimoire/foundation`), so tests can fast-forward.
- R-04 (BYOK failure fall-back to server-side provider) is **off** by
  default to honor per-user quota isolation.
