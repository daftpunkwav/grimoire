# packages/

> Language: **English** | [简体中文](README.zh.md)

This directory holds the capability packages of the Grimoire monorepo.

Every package is a workspace member `@grimoire/<name>` and ships `src/`,
`tests/`, `README.md`, `package.json`, and `tsconfig.json`. Packages are
the only allowed place to ship reusable, framework-agnostic building blocks
that other workspaces (apps, services, packages) may depend on.

| Package | Workspace | Role |
|---|---|---|
| [`contracts`](contracts/) | `@grimoire/contracts` | Zero-dependency leaf: shared DTOs, permission matrix, hover sanitization, LLM types, port interfaces. Every other package may depend on it; it depends on no business package. |
| [`foundation`](foundation/) | `@grimoire/foundation` | Infrastructure: errors, logger, JWT, hashing, BYOK crypto, SSE helpers, middleware. The only package allowed to depend on every other package except `apps/`. |

## Rules

- `packages/contracts` is the dependency root for every other workspace.
  Any package or service that wants to share a type or interface declares
  it there.
- A new package is introduced only when **at least two consumers** need
  the same capability, **and** the capability cannot be expressed as a
  cross-service port (see [services/](services/)). See
  [docs/guides/add-a-package.md](../docs/guides/add-a-package.md) for the
  full decision criteria.
- Package READMEs are mandatory. They state responsibilities, seam
  surface, and dependency direction. The root CI gate verifies that every
  public export is referenced by a test (`pnpm check:exports`).
- No package may import from `apps/`. No package may import from another
  service's source — only from `services/<name>/src/index.ts` and only
  when that service's package.json explicitly declares the dependency.

See the root [README](../README.md) for the full workspace catalog.
