# Grimoire

> Language: **English** | [简体中文](README.zh.md)

Interactive Agent / LLM learning platform. Reader and author surfaces share one
modular monolith: rich-text articles, step-driven animations, and a dual-mode
in-product Agent (hover quick-explain + panel ReAct).

## Quick start

```bash
pnpm install

# Required: SEED_ADMIN_PASSWORD and JWT_SECRET (see .env.example).
cp .env.example services/api/.env

# Database + seed (schema lives in services/api/prisma).
pnpm --filter @grimoire/api db:generate
pnpm --filter @grimoire/api db:migrate
pnpm --filter @grimoire/api db:seed

# Front-end (8180) + API (8181, includes /docs Swagger UI in dev) together.
pnpm dev
```

Ports:

- Front-end: <http://localhost:8180> (loopback, strict port)
- API: <http://localhost:8181/health>
- API docs (Swagger UI, dev only): <http://localhost:8181/docs>

Port rule: **8180** web · **8181** API (with `/docs`). New services follow
**8182, 8183, 8184 …** in order. The dev launcher does **not** auto-shift; a
busy port aborts with a clear message.

### Explicit port override

```bash
VITE_PORT=5555 PORT=3333 pnpm dev         # both
VITE_PORT=5555 pnpm dev                   # front-end only
PORT=3333 pnpm dev                        # API only; front-end proxy follows

pnpm dev:web                              # front-end only
pnpm dev:api                              # API only
```

`VITE_API_BASE_URL` falls back to a relative `/api/v1` (Vite dev proxy
forwards). Set it explicitly only when the front-end is hosted independently
of the API, then also configure production `CORS_ORIGIN` and CSP `connect-src`.

CORS dev mode auto-allows any localhost / 127.0.0.1 origin. Production keeps a
strict `CORS_ORIGIN` allowlist (required, fail-fast). The API binds to
`127.0.0.1` by default; set `HOST=0.0.0.0` for container / reverse-proxy
deployments (see [docs/operations/deployment.md](docs/operations/deployment.md)).

### Default admin

The seed creates a single admin from the `SEED_ADMIN_*` env vars:

- Email: `admin@example.local` (override with `SEED_ADMIN_EMAIL`)
- Password: **must** be set in `.env` via `SEED_ADMIN_PASSWORD` (no built-in
  fallback; the seed refuses to run if missing)
- Role: `admin`, `adminLevel=100`, `authorTier=elite`
- An existing user with the same email is **not** auto-promoted unless
  `SEED_FORCE_ADMIN=1`

## Architecture

### Workspace layout

```
apps/web                  Vite 8 + React 19 + RR 7 front-end; i18n catalogs
                          under src/i18n; depends only on contracts/foundation
services/api              Composition root + Express 5 HTTP host + Swagger UI
                          (services/api is the only place that wires every
                          service into ports and starts the server)

services/identity         Auth, users, author applications, settings
                          (User, RefreshToken, AuthorApplication)
services/content          Articles, animations, domains, annotations
                          (Article, Domain, AnimationDef, Annotation)
services/community        Topic forum (Topic, TopicReply)
services/agent            Hover + panel Agents, memory, progress, tool-loop
services/llm              LLM gateway: providers, adapters, breaker, BYOK
                          decryption; owns every secret

packages/contracts        Shared DTOs, permission matrix, hover sanitization,
                          LLM types; zero-dependency leaf
packages/foundation       Infrastructure: errors, logger, JWT, hashing,
                          BYOK crypto, SSE, middleware

tests/                    Cross-domain journey tests through @grimoire/*
                          public exports only (see tests/README.md)
scripts/                  Quality gates and dev helpers (see scripts/README.md)
docs/                     English + 简体中文 parallel docs (see docs/README.md)
```

### Dependency rules

1. `packages/contracts` is the leaf. Every package may depend on it, and it
   depends on no business package.
2. The composition root lives only in `services/api/src/compose.ts` and owns
   all wiring (port implementations + dependency injection).
3. Services talk to each other only through contracts ports, never by
   importing another service's implementation.
4. `services/llm` is the **only** package that holds provider credentials;
   every other package reads decrypted keys through the `LlmKeyAccess` port.
5. `apps/web` depends only on `@grimoire/contracts` and `@grimoire/foundation`;
   all other server traffic is mediated by the front-end API client.

### Key ports (`@grimoire/contracts`)

| Port | Purpose | Implemented in |
|---|---|---|
| `UserRepository` | User lookup / persistence | `services/identity` |
| `RefreshTokenStore` | Refresh-token rotation & revocation | `services/identity` |
| `ArticleRepository` | Article CRUD + search | `services/content` |
| `AnnotationAcl` | Annotation visibility / moderation | `services/content` |
| `TopicRepository` | Topic + reply persistence | `services/community` |
| `AgentConversationStore` | Conversation + message ledger | `services/agent` |
| `HoverExplainCache` | L2 server-side hover cache | `services/agent` |
| `LlmProvider` | Server-side provider invocation | `services/llm` |
| `LlmKeyAccess` | BYOK decrypt + per-user quota lookup | `services/llm` |
| `Clock` | Swappable time source | `packages/foundation` |

`CircuitBreaker` is not a contracts port — it is the stateful breaker primitive
inside `services/llm`, with the time source injected at construction and held
per provider.

### Data flow for one hover quick-explain

```
Browser hover
  → apps/web (useHoverAgent + hoverExplainCache L1)
    → POST /api/v1/agent/explain  (services/api routes/agent)
      → services/agent (HoverExplainService)
        → services/llm (LlmProvider, possibly via LlmKeyAccess for BYOK)
      → HoverExplainCache (L2, cache key v7)
    → SSE /api/v1/agent/explain/stream (panel streaming path)
```

### Data flow for one panel ReAct turn

```
apps/web AgentPanel
  → POST /api/v1/agent/chat  →  services/agent (AgentConversationService)
    → AgentDriver.run() with reasoningMode: react
      → tool registry resolves search_articles / get_article
      → SSE: thought / action / observation / final
    → AgentMemory injected (read-only) at prompt assembly
```

## Testing

```bash
pnpm test               # vitest run
pnpm test:coverage      # threshold-gated run
pnpm typecheck          # whole-repo typecheck
pnpm -r build           # build every package
```

Test strategy and budgets live in
[docs/operations/testing.md](docs/operations/testing.md); coverage thresholds
are a gate (red means restore coverage, not lower numbers).

## Development

Node.js >= 20.9 (`.nvmrc` pins the exact version) and pnpm 11 (the
`packageManager` field pins the exact release). Workspace members are listed
in `pnpm-workspace.yaml`.

```bash
pnpm build          # all packages
pnpm typecheck      # whole-repo typecheck + test typecheck
pnpm test           # vitest
pnpm test:coverage  # threshold-gated coverage
pnpm boundaries     # scripts/check-boundaries.mjs (import direction)
pnpm check:deps     # scripts/check-package-deps.mjs (declared vs imported)
pnpm check:exports  # scripts/check-export-tests.mjs (every export tested)
pnpm check:i18n     # apps/web i18n gate (catalog parity + CJK sweep)
pnpm lint           # per-workspace oxlint
pnpm verify         # the full CI gate: build + typecheck + coverage + lint +
                    #   i18n + boundaries + deps + exports
```

The web app carries its own gate `pnpm --filter @grimoire/web check:i18n`:
catalog-key parity between `en` and `zh-CN`, plus a CJK sweep over `src/app`,
`src/components`, and `src/i18n` so user-visible copy never bypasses the
catalogs.

### Repository layout

```
apps/<app>/              composition root (api) and front-end (web);
                         see apps/README.md
packages/<name>/         capability packages; every package ships src/,
                         tests/, README.md, package.json, and tsconfig.json
services/<domain>/       one workspace per business domain; same shape
tests/<journey>/         cross-domain journey tests through @grimoire/*
                         public exports only
scripts/                 quality gates (boundaries, deps, exports, i18n) and
                         dev helpers (dev.mjs, smoke.mjs)
docs/                    English + 简体中文 parallel documentation tree;
                         see docs/README.md for the map
```

Every package README states its responsibilities, seam surface, and dependency
direction. [docs/architecture/overview.md](docs/architecture/overview.md)
defines the layered architecture, dependency directions, and shared
vocabulary.

### Conventions

- Commits follow Conventional Commits with `feat`, `fix`, `docs`, `refactor`,
  `chore`, `test`, or `perf`, an imperative subject of at most 50 characters,
  and one concern per commit. Branches are `<type>/<kebab-case>`.
- Code and comments are English. Documentation ships in English with
  Simplified Chinese mirrors. User-visible UI copy lives in the i18n catalogs
  under `apps/web/src/i18n/catalogs/`, with `zh-CN` canonical and `en`
  type-pinned, and never inline.
- The composition root owns all wiring. Adding a service means registering
  its port implementations in `services/api/src/compose.ts`.
- Sandbox / deny-list decisions live in `services/llm`; the web app trusts the
  API to enforce every policy.
- Contributing starts at
  [CONTRIBUTING.md](CONTRIBUTING.md) (简体中文:
  [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)).
- For coding agents, follow [AGENTS.md](AGENTS.md).

## Workspace catalog

| Workspace | Responsibility |
|---|---|
| `@grimoire/web` | Vite 8 + React 19 + RR 7 SPA, i18n provider, dev server |
| `@grimoire/api` | Express 5 composition root + Swagger UI + Docker image |
| `@grimoire/identity` | Auth, users, author applications, settings (BYOK encrypted) |
| `@grimoire/content` | Articles, animations, domains, annotations |
| `@grimoire/community` | Topic forum (topics + replies) |
| `@grimoire/agent` | Hover + panel Agents, memory, progress, tool-loop |
| `@grimoire/llm` | LLM gateway: providers, adapters, breaker, BYOK decryption |
| `@grimoire/contracts` | Shared DTOs, permission matrix, hover sanitization |
| `@grimoire/foundation` | Infrastructure: errors, logger, JWT, hashing, SSE, middleware |
