# `@grimoire/contracts`

> Language: **English** | [简体中文](README.zh.md)

Zero-dependency leaf: shared DTOs, permission matrix, hover
sanitization, LLM types, and port interfaces.

## Responsibilities

- **DTOs**: request / response shapes that flow between the front-end and
  every service. Source of truth for `apps/web/src/lib/api/*` and every
  service's `serialize.ts`.
- **Permissions**: the RBAC matrix (`guest / reader / author / admin`
  with `adminLevel` grading) and the per-tool allowlist consulted by the
  panel Agent.
- **Hover sanitization**: detection + rejection of malformed /
  suspicious payloads before they are cached or returned to the
  client. The same rules apply on the server cache lookup.
- **LLM types**: shared request / response types used by `services/llm`
  and consumed by every other service's prompt assembly.
- **Ports**: every interface that the composition root consumes. The
  implementations live in each owning service.

## Layout

```
src/
  index.ts                barrel: public exports
  dto.ts                  shared request / response DTOs
  permissions.ts          RBAC matrix + tool allowlist
  ports.ts                port interfaces (UserRepository, ArticleRepository,
                          AgentConversationStore, HoverExplainCache,
                          LlmProvider, LlmKeyAccess, …)
  llm-types.ts            shared LLM request / response types
  hoverSanitize.ts        payload detection + rejection
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/contracts build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/contracts typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/contracts test` | Vitest run. |
| `pnpm --filter @grimoire/contracts lint` | oxlint. |

## Dependencies

Runtime: **none.** Dev: `vitest`, `oxlint`, `typescript`.

## Rules

- This package depends on no business package. No service may import
  another service from here — only the port interface.
- Adding a DTO is a one-line change in `dto.ts`; mirror the change in
  every `serialize.ts` and every front-end client file in the same
  commit.
- Adding a port requires an implementation in the owning service and a
  registration in `apps/api/src/compose.ts` in the same commit.
- Hover sanitization rules are intentionally **strict**; tests in
  `hoverSanitize.test.ts` pin the rejection patterns. Loosening a rule
  requires a paired ADR entry.
