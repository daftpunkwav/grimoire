# Package layout

> Language: **English** | [简体中文](package-layout.zh.md)

Grimoire is a pnpm-workspace monorepo with three workspace families and
a uniform per-workspace shape.

## Workspace families

| Family | Path | Workspace name | Role |
|---|---|---|---|
| App | `apps/<name>/` | `@grimoire/<name>` | Runnable process (composition root, SPA). |
| Package | `packages/<name>/` | `@grimoire/<name>` | Framework-agnostic capability building block. |
| Service | `services/<domain>/` | `@grimoire/<domain>` | One bounded context per business domain. |

`pnpm-workspace.yaml` declares the three glob patterns:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

A workspace is any directory that ships a `package.json` with a
`@grimoire/<name>` name field and is matched by one of the three
globs.

## Per-workspace shape

Every workspace ships:

```
<workspace>/
  package.json             # name, private, exports, files, scripts, deps
  tsconfig.json            # extends the repo base (or web / node preset)
  README.md                # responsibilities, seam surface, dep direction
  README.zh.md             # mirror in Simplified Chinese
  src/                     # source
  tests/                   # tests for this workspace only
```

The composition root (`apps/api/`) additionally ships:

```
apps/api/
  Dockerfile               # production image source
  prisma/
    schema.prisma
    seed.ts
    seed-content.ts
  scripts/                 # one-off scripts (e.g. hover-extract tuning)
```

## Dependency direction

```
apps/api          ──▶  every service, packages/foundation, packages/contracts
apps/web          ──▶  packages/contracts, packages/foundation
services/<x>      ──▶  packages/contracts, packages/foundation, services/llm (prompt only)
packages/foundation ─▶  packages/contracts, bcryptjs, express, jsonwebtoken, pino, zod, @prisma/client
packages/contracts  ─▶  (nothing in this repo)
```

Enforced by `scripts/check-boundaries.mjs` and surfaced by
`pnpm boundaries`. Cross-service source imports are rejected.

## Name resolution

The root [`vitest.config.ts`](../../vitest.config.ts) wires
`@grimoire/*` to each workspace's `src/index.ts` for tests. Production
builds resolve the workspace names through pnpm's `workspace:*`
protocol declared in each workspace's `package.json`.

TypeScript path aliases live in
[`tsconfig.tests.json`](../../tsconfig.tests.json); they mirror the
vitest aliases. Production builds use Node module resolution and
pnpm's symlinked workspace packages.

## Adding a workspace

See [`../guides/add-a-package.md`](../guides/add-a-package.md) and
[`../guides/add-a-service.md`](../guides/add-a-service.md). Both guides
spell out the README contract, the export contract, and the boundary
rules.
