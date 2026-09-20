# apps/

> Language: **English** | [简体中文](README.zh.md)

This directory holds the runnable applications of the Grimoire monorepo.

Apps are not capability leaves: they consume `@grimoire/*` packages and are
not consumed by them. The composition root lives only inside `apps/api/`;
the front-end lives in `apps/web/` and depends only on
`@grimoire/contracts` and `@grimoire/foundation`.

| App | Workspace | Role |
|---|---|---|
| [`api`](api/) | `@grimoire/api` | Express 5 composition root + Swagger UI + Docker image. The only place that constructs port implementations and wires services. |
| [`web`](web/) | `@grimoire/web` | Vite 8 + React 19 + React Router 7 SPA. Owns the i18n provider and the dev server. |

## Rules

- `apps/api/` is the composition root. All cross-service wiring lives in
  `apps/api/src/compose.ts`. Other service files may only import from
  `@grimoire/contracts` (the port interface), never from another service's
  source.
- `apps/web/` depends only on `@grimoire/contracts` and `@grimoire/foundation`.
  All other server traffic is mediated by the front-end API client.
- New apps should be added here only when they introduce a new runnable
  process (server, CLI, worker). Internal capability packages go under
  [`packages/`](../packages/) or [`services/`](../services/).

See the root [README](../README.md) for the full workspace catalog and
[docs/architecture/composition-root.md](../docs/architecture/composition-root.md)
for the composition-root contract.
