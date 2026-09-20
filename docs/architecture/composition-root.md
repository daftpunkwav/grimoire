# Composition root

> Language: **English** | [简体中文](composition-root.zh.md)

`apps/api/src/compose.ts` is the **only** file in the repository that
imports another service's source. It is also the only file that
constructs port implementations and wires them into the HTTP host.

## Entry chain

```
process start
  → services/api/src/index.ts
      → loadSettings()              # env.ts: validated, fail-fast
      → prisma()                    # lib/prisma.ts: shared singleton
      → compose()                   # compose.ts: build RuntimeComponents
      → startServer(components)     # app.ts: bind + route + listen
      → installSignalHandlers()     # SIGINT/SIGTERM graceful shutdown
```

The order is fixed. `loadSettings()` must succeed before `prisma()`
connects; `prisma()` must be ready before `compose()` builds
implementations that query it; `compose()` must finish before
`startServer()` binds a port that depends on those implementations.

## What `compose()` wires

In order:

1. **Foundations**: `Clock`, `Logger`, `ErrorHandler` — sourced from
   `@grimoire/foundation`.
2. **Identity**: `UserRepository`, `RefreshTokenStore`, settings
   helpers — sourced from `@grimoire/identity`.
3. **Content**: `ArticleRepository`, `AnnotationAcl`, view tracking —
   sourced from `@grimoire/content`.
4. **Community**: `TopicRepository` — sourced from `@grimoire/community`.
5. **LLM**: `LlmProvider`, `LlmKeyAccess`, breaker, adapter catalog —
   sourced from `@grimoire/llm`.
6. **Agent**: `AgentConversationStore`, `HoverExplainCache`,
   `AgentMemoryAccess`, prompt assembly, tool registry — sourced from
   `@grimoire/agent`.
7. **HTTP**: Express app, route mounting, middleware stack, Swagger UI
   — built in `app.ts` from the assembled services.

The composition result is a `RuntimeComponents` bundle that
`startServer()` consumes without further mutation.

## Startup guards

| Guard | Failure mode |
|---|---|
| `loadSettings()` missing required env | Process exits with `SettingsLoadError` (HTTP 500-style message, non-zero exit). No port is bound. |
| `prisma()` connection failure | Process exits before `compose()`. |
| `compose()` port implementation throws on init | Same as above; the route that depends on the port is never mounted. |
| `startServer()` port busy | Process exits with `PortInUseError` after a fast precheck; `errorHandler` returns 503 if the precheck races and the bind fails. |
| `installSignalHandlers()` missing | Process refuses to start (the gate in `index.ts` logs and exits). |

## Adding a new port

1. Declare the port interface in
   [`packages/contracts/src/ports.ts`](../../packages/contracts/src/ports.ts).
2. Implement it in the owning service (e.g. `services/<name>/src/<thing>.ts`).
3. Register the implementation in
   [`apps/api/src/compose.ts`](../../apps/api/src/compose.ts) inside the
   matching `compose()` step.
4. Add at least one test that exercises the route that consumes the
   port. The CI gate `pnpm check:exports` enforces export coverage;
   the gate `pnpm boundaries` enforces that the port surface is the
   only thing the route imports.

## Anti-patterns

- Importing another service's source from anywhere outside `compose.ts`.
  The gate `pnpm boundaries` rejects this.
- Constructing a service's port implementation inside a route
  handler. Construct once in `compose()` and inject.
- Adding a route leaf without registering its handler at the
  composition root. Every route is mounted exactly once.
- Sharing module-level state between services (cached `Date.now()`,
  cached env reads, singletons across service boundaries). State is
  created in `compose()` and travels with the `RuntimeComponents`
  bundle.
