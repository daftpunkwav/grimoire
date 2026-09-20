# HTTP API

> Language: **English** | [简体中文](http-api.zh.md)

Every HTTP route exposed by `services/api`. Routes are grouped by owning
service; the composition root mounts them in
[`apps/api/src/app.ts`](../../apps/api/src/app.ts).

Conventions:

- All non-public routes require `Authorization: Bearer <accessToken>`.
  The access token is issued by `services/identity` and verified by
  [`packages/foundation/src/auth.ts`](../../packages/foundation/src/auth.ts).
- Public routes: `/health`, `/ready`, `/api/v1/auth/register`,
  `/api/v1/auth/login`, `/api/v1/auth/refresh`.
- Body limit: `MAX_REQUEST_SIZE` (default 10 MiB); chunked bodies are
  re-enforced by the request middleware.
- Error mapping: 4xx for client errors (422 for validation, 401 for
  unauthenticated, 403 for unauthorized, 404 for missing, 409 for
  conflict), 5xx for upstream / server errors. The response body is
  JSON `{ error: { code, message, requestId } }`.
- Swagger UI mounts at `/docs` in development only.

## Cross-cutting middleware

```
helmet                    # secure HTTP headers
cors                      # CORS allowlist (CORS_ORIGIN or dev auto-allow)
express.json              # body parser with body-size cap
express.urlencoded        # form bodies (rarely used; OAuth callbacks only)
request-id                # propagate or mint X-Request-Id
rate-limit                # per-IP and per-user quotas
auth                      # optional; route-applied
error-handler             # final middleware; maps thrown errors to responses
```

## Routes

### `services/identity`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | public | Register a new user; returns `{ user, accessToken, refreshToken }`. |
| POST | `/api/v1/auth/login` | public | Email + password login; rotates any prior refresh token. |
| POST | `/api/v1/auth/logout` | bearer | Revoke the refresh token; idempotent. |
| POST | `/api/v1/auth/refresh` | public | Exchange a refresh token for a new access token. |
| GET | `/api/v1/auth/me` | bearer | Current user summary. |
| GET | `/api/v1/author-applications` | bearer (reader) | List own application; admins see all. |
| POST | `/api/v1/author-applications` | bearer (reader) | Submit an application. |
| PATCH | `/api/v1/author-applications/:id` | bearer (admin) | Approve / reject. |
| GET | `/api/v1/settings` | bearer | Per-user settings (BYOK decrypted only on this response). |
| PUT | `/api/v1/settings` | bearer | Update settings; BYOK encrypted at rest. |
| POST | `/api/v1/settings/test-llm` | bearer | Validate a BYOK key against the chosen provider. |

### `services/content`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/domains` | bearer | List domains. |
| POST | `/api/v1/domains` | bearer (admin) | Create a domain. |
| PATCH | `/api/v1/domains/:id` | bearer (admin) | Update a domain. |
| GET | `/api/v1/articles` | bearer | List articles (filterable by domain, status, author). |
| GET | `/api/v1/articles/:slug` | bearer | Article by slug; records a view via `viewTracking`. |
| POST | `/api/v1/articles` | bearer (author) | Create an article (Markdown body). |
| PATCH | `/api/v1/articles/:id` | bearer (author) | Update; uses `UncheckedUpdateInput` for nullable foreign keys. |
| GET | `/api/v1/animations/:id` | bearer | Animation definition. |
| POST | `/api/v1/animations` | bearer (author) | Create animation. |
| PATCH | `/api/v1/animations/:id` | bearer (author) | Update animation. |
| GET | `/api/v1/annotations` | bearer | List annotations; visibility via `AnnotationAcl`. |
| POST | `/api/v1/annotations` | bearer | Submit an annotation. |
| PATCH | `/api/v1/annotations/:id` | bearer (author \| admin) | Review / status transition. |

### `services/community`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/topics` | bearer | List topics. |
| POST | `/api/v1/topics` | bearer | Create a topic; optional `articleSlug`. |
| GET | `/api/v1/topics/:id` | bearer | Topic + replies (one level deep). |
| POST | `/api/v1/topics/:id/replies` | bearer | Reply to a topic. |

### `services/agent`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/agent/meta` | bearer | Agent metadata (model, mode, capabilities). |
| GET | `/api/v1/agent/providers` | bearer | Provider list (server + user BYOK). |
| POST | `/api/v1/agent/explain` | bearer | Hover quick-explain; non-streaming. |
| POST | `/api/v1/agent/explain/stream` | bearer | Hover quick-explain; SSE. |
| POST | `/api/v1/agent/chat` | bearer | Panel chat; non-streaming. |
| POST | `/api/v1/agent/chat/stream` | bearer | Panel chat; SSE (`thought` / `action` / `observation` / `final` / `error` / `cancelled`). |
| GET | `/api/v1/agent/memory` | bearer | Per-user memory (read-only). |
| POST | `/api/v1/agent/progress` | bearer | Learning progress update. |
| POST | `/api/v1/agent/cache/clear` | bearer (admin) | Clear the L2 hover cache. |

### Cross-cutting

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | public | Liveness probe. |
| GET | `/ready` | public | Readiness probe (DB reachable, port bound). |
| GET | `/docs` | dev only | Swagger UI generated from route schemas. |

## SSE event shapes

Hover (`/explain/stream`) and panel (`/chat/stream`) share the same
event shapes; tests in
[`services/agent/src/lib/streamConsumers.test.ts`](../../services/agent/src/lib/streamConsumers.test.ts)
pin them.

```ts
type AgentStreamEvent =
  | { type: "thought";       text: string }
  | { type: "thought_delta"; delta: string }
  | { type: "thought_end" }
  | { type: "action";         toolName: string; args: unknown }
  | { type: "observation";    toolName: string; result: unknown }
  | { type: "tool_progress";  toolName: string; pct: number }
  | { type: "final";          text: string }
  | { type: "error";          code: string; message: string }
  | { type: "cancelled" };
```

## Error codes

| Code | HTTP | Triggered by |
|---|---|---|
| `validation_failed` | 422 | Zod schema rejected request body / params / query. |
| `unauthenticated` | 401 | Missing / expired / malformed token on a protected route. |
| `unauthorized` | 403 | Token is valid but the user lacks the required role / `adminLevel`. |
| `not_found` | 404 | Resource missing or hidden by ACL. |
| `conflict` | 409 | Unique-key collision or state-machine violation. |
| `provider_error` | 502 | Upstream LLM call failed (not breaker-related). |
| `breaker_open` | 503 | LLM breaker is in cooldown; fast-fail. |
| `rate_limited` | 429 | Per-IP or per-user quota exceeded. |
| `internal_error` | 500 | Anything else; `errorHandler` logs the full stack with `requestId`. |
