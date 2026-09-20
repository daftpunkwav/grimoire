# Architecture

> Language: **English** | [简体中文](architecture.zh.md)

Grimoire's architecture is built around three load-bearing mechanisms:

1. **Seams first.** Cross-service communication goes through port
   interfaces declared in [`@grimoire/contracts`](./reference/ports.md).
   Implementations live in the owning service; no other workspace may
   import them.
2. **Backend registration.** Every concrete implementation (provider,
   tool, dimension, route leaf) is registered by name at the composition
   root. New work means adding a registration, not a conditional.
3. **Single composition root.** `services/api/src/compose.ts` is the
   only place that constructs port implementations and wires the HTTP
   host. See [architecture/composition-root.md](./architecture/composition-root.md).

These three mechanisms make the monorepo's "modular monolith" shape
honest: today every service runs in one process, but tomorrow any
service can be moved to its own process by replacing its in-process
port implementation with an HTTP / RPC client, without touching its
consumers.

## Layer map

```
apps/web                    Vite 8 + React 19 SPA; i18n catalogs only
services/api                Express 5 composition root + HTTP host
                            (the only file that imports every service)

services/identity           users, auth, author applications, settings
services/content            articles, animations, domains, annotations
services/community          topics + replies
services/agent              hover + panel Agents, memory, tool-loop
services/llm                LLM gateway, breaker, BYOK decrypt

packages/contracts          zero-dep leaf: DTOs, ports, permissions,
                            hover sanitization, LLM types
packages/foundation         errors, logger, JWT, hashing, BYOK crypto,
                            SSE helpers, middleware, Clock

tests/                      cross-domain journey tests through
                            @grimoire/* public exports only
```

## Dependency rules (enforced by `pnpm boundaries`)

1. `packages/contracts` is the dependency root for every other
   workspace. It depends on no business package.
2. The composition root lives only in `services/api/src/compose.ts`.
   Every other consumer of a port imports it from
   `@grimoire/contracts` and receives its implementation through the
   root.
3. `services/*` may depend on `@grimoire/contracts`,
   `@grimoire/foundation`, and `@grimoire/llm` (for prompt assembly
   only). They never depend on each other.
4. `apps/web` depends only on `@grimoire/contracts` and
   `@grimoire/foundation`. All server traffic is mediated by the
   front-end API client.
5. `services/llm` is the only package that holds provider credentials.
   Other packages read decrypted keys through the `LlmKeyAccess` port
   for the lifetime of one request.

## Vocabulary

The shared vocabulary appears across the docs tree; the canonical
definitions live here.

- **Workspace**: a directory under `apps/`, `packages/`, or `services/`
  that ships a `package.json` with a workspace name (`@grimoire/<name>`)
  and is listed in `pnpm-workspace.yaml`.
- **Service**: a workspace under `services/<domain>/` that owns one
  bounded context. Communicates only through ports.
- **Package**: a workspace under `packages/<name>/` that ships
  framework-agnostic building blocks. The only allowed place to share
  reusable code across services.
- **Port**: a TypeScript interface declared in
  `@grimoire/contracts/ports.ts`. Implementations live in their owning
  service; the composition root wires them together.
- **Composition root**: `services/api/src/compose.ts`. The only file
  that constructs port implementations and wires every service into the
  HTTP host.
- **Journey test**: a test under `tests/<journey>/` that exercises two
  or more workspaces through their public exports. Anything that fits
  one package lives next to it.
- **Hover Agent / Panel Agent**: the two shapes of the in-product
  Agent. Hover is single-turn Fast Direct streamed over SSE; panel is
  multi-turn ReAct with optional tool-loop. See
  [architecture/agent-modes.md](./architecture/agent-modes.md).
- **BYOK**: "Bring Your Own Key". Per-user provider keys stored
  encrypted at rest in `services/identity` and decrypted on demand by
  `services/llm` through the `LlmKeyAccess` port.
- **R-NN**: numbered resilience / architecture decisions documented in
  [architecture/decision-register.md](./architecture/decision-register.md).

## How to read the rest of the docs

- [`architecture/overview.md`](./architecture/overview.md) — concepts,
  layer map, key invariants.
- [`architecture/composition-root.md`](./architecture/composition-root.md)
  — what the root wires, in what order, with which startup guards.
- [`architecture/data-flow.md`](./architecture/data-flow.md) — end-to-end
  flows for hover quick-explain, panel ReAct, content CRUD, and
  identity bootstrap.
- [`architecture/package-layout.md`](./architecture/package-layout.md)
  — `packages/<name>/` and `services/<name>/` anatomy, dependency
  rules, name resolution.
- [`architecture/decision-register.md`](./architecture/decision-register.md)
  — load-bearing ADRs (decision / rationale / enforcement).
- [`architecture/agent-modes.md`](./architecture/agent-modes.md) — the
  dual-Agent system.
- [`architecture/animation-system.md`](./architecture/animation-system.md)
  — VisualKind × template animation runtime.
- [`architecture/identity-permissions.md`](./architecture/identity-permissions.md)
  — RBAC matrix and `adminLevel` grading.
- [`architecture/security.md`](./architecture/security.md) —
  implemented / pending security checklist.

See [`README.md`](./README.md) for the full docs map.
