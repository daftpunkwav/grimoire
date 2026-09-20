# Configuration

> Language: **English** | [简体中文](configuration.zh.md)

All environment variables read by `loadSettings()`. Source of truth:
[`services/api/src/lib/env.ts`](../../services/api/src/lib/env.ts).
The same loader runs in every workspace that calls it; missing or
malformed values fail-fast at startup.

## Reading order

```
1. process.env               # explicit overrides win
2. repo-root .env            # committed as .env.example; never .env
3. workspace-local .env      # apps/web/.env, services/api/.env (gitignored)
```

For local development copy `.env.example` to `.env` (or
`services/api/.env`) and edit the required keys. `.env` is gitignored.

## API / HTTP

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `8181` | no | API bind port. Front-end `/api` proxy follows unless overridden by `VITE_API_PORT`. |
| `HOST` | `127.0.0.1` | no | Bind address. Set to `0.0.0.0` for container / reverse-proxy deployments. |
| `CORS_ORIGIN` | (dev only: auto-allow localhost) | yes (production) | Comma-separated allowlist. Missing in production is a fail-fast. |
| `TRUST_PROXY` | `0` | no | Set to `1` only when behind a trusted reverse proxy. Direct exposure allows clients to forge `X-Forwarded-For` and bypass rate limits. |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | no | `debug` \| `info` \| `warn` \| `error`. |

## Database

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | no | SQLite path or PostgreSQL URL. PostgreSQL via `docker-compose.yml`. |
| `NODE_ENV` | `development` | no | `development` / `production`. |

## Auth

| Variable | Default | Required | Description |
|---|---|---|---|
| `JWT_SECRET` | placeholder | yes | Long random string. The seed refuses to run with the placeholder. |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | no | Access-token TTL. |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | no | Refresh-token TTL. |
| `BYOK_ENCRYPTION_KEY` | (derive from `JWT_SECRET`) | no | AES-GCM key for BYOK at-rest encryption. >= 16 chars. Recommended: a dedicated key in production. |

## Seed

| Variable | Default | Required | Description |
|---|---|---|---|
| `SEED_ADMIN_EMAIL` | `admin@example.local` | no | Email for the bootstrap admin. |
| `SEED_ADMIN_PASSWORD` | (none) | **yes** | Password for the bootstrap admin. Missing → seed refuses to run. |
| `SEED_ADMIN_NAME` | `Admin` | no | Display name. |
| `SEED_FORCE_ADMIN` | `0` | no | Set to `1` to promote an existing user with the same email. |

## LLM providers

The default provider is StepFun. Adding a new provider means adding a
file under [`services/llm/src/adapters/`](../../services/llm/src/adapters/)
and registering it; see
[llm-providers.md](./llm-providers.md).

| Variable | Default | Required | Description |
|---|---|---|---|
| `LLM_PROVIDER_ID` | `stepfun` | no | Adapter id. |
| `STEPFUN_API_KEY` | (none) | yes (when in use) | Server-side StepFun key. |
| `STEPFUN_BASE_URL` | `https://api.stepfun.com/step_plan` | no | Anthropic-compatible base. |
| `STEPFUN_MODEL` | `step-3.7-flash` | no | Default model. |
| `STEPFUN_API_FORMAT` | `anthropic_messages` | no | Adapter selector. |
| `OPENAI_API_KEY` | (none) | yes (when in use) | OpenAI key. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | no | |
| `OPENAI_MODEL` | `gpt-4o-mini` | no | |
| `OPENAI_API_FORMAT` | `openai_chat` | no | `openai_chat` \| `openai_responses`. |
| `GENERIC_LLM_*` | (none) | no | Optional generic gateway. |

## LLM resilience

| Variable | Default | Description |
|---|---|---|
| `LLM_CIRCUIT_FAILURES` | `3` | Trip the breaker after N consecutive failures. |
| `LLM_CIRCUIT_OPEN_MS` | `30000` | Cooldown during open; fast 503. |
| `LLM_MAX_CONCURRENT` | `12` | In-process cap on concurrent LLM calls. |
| `LLM_QUEUE_WAIT_MS` | `5000` | Wait when at cap; 503 on timeout. |
| `LLM_BYOK_FALLBACK_TO_SERVER` | `0` | R-04. Off by default to honor per-user quota isolation. |

## Agent tool-loop

| Variable | Default | Description |
|---|---|---|
| `TOOL_LOOP_MAX_ITERS` | `5` | Max ReAct iterations per turn. |
| `TOOL_TIMEOUT_MS` | `8000` | Per-tool timeout. |
| `TOOL_LOOP_OVERALL_MS` | `75000` | ReAct loop wall-clock; must be < the front-end tools-mode timeout (90 s). |

## Web (Vite)

| Variable | Default | Description |
|---|---|---|
| `VITE_PORT` | `8180` | Vite dev server port. |
| `VITE_API_PORT` | (follows `PORT` or `8181`) | Front-end `/api` proxy target. |
| `VITE_API_BASE_URL` | (relative `/api/v1`) | Direct cross-origin only when the front-end is hosted independently. |

## Failures and what they mean

- `SettingsLoadError`: process exits before binding a port.
- `PortInUseError`: port precheck failed; no retry.
- Provider breaker open: 503 with `Retry-After` derived from
  `LLM_CIRCUIT_OPEN_MS`.
