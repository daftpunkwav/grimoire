# tests/

> Language: **English** | [简体中文](README.zh.md)

Cross-domain journey tests for the Grimoire monorepo.

This directory is reserved for tests that need to compose **two or more**
workspaces through their **public exports only**. Anything that can be
covered by a single workspace lives next to that workspace's source under
`packages/*/tests/`, `services/*/tests/`, or `apps/*/tests/`.

## Placement rule

| Test type | Location | May import |
|---|---|---|
| Single-package unit / integration | `packages/<name>/tests/`, `services/<name>/tests/`, `apps/<name>/tests/` | Only the package's own `../src/` and its public barrel. |
| Cross-domain journey | `tests/<journey>/` | Only `@grimoire/*` public exports. No deep-path imports across packages. |
| Front-end app test | `apps/web/tests/` | Front-end source + `@grimoire/contracts` only. |
| API host test | `apps/api/tests/` | API source + `@grimoire/contracts` only. |

A journey test that fits inside a single package does **not** belong here.
Move it next to the package it exercises.

## Conventions

- One test file = one thing. Shared scaffolding > ~25 lines goes into
  `mock-deps.ts` or `fixtures.ts` in the same directory (no `.test` suffix
  so the runner skips it).
- Tests run with `pnpm test` from the repo root. The full coverage gate
  uses `pnpm test:coverage`.
- Journey tests must not write to the filesystem, start servers, or open
  network ports. Stub everything at the port boundary; the composition
  root is exercised by `apps/api/tests/`, not here.
- Test files follow the same `@file` / `@description` header convention as
  production source. See [../AGENTS.md](../AGENTS.md).
- The runner resolves `@grimoire/*` aliases through
  [`../vitest.config.ts`](../vitest.config.ts).

## Discovery

The root [`vitest.config.ts`](../vitest.config.ts) wires this directory
into the runner with:

```
tests/**/*.test.ts
```

Adding a new journey directory under `tests/` is enough — no further
registration is required.

See [../docs/operations/testing.md](../docs/operations/testing.md) for the
operational map and coverage thresholds.
