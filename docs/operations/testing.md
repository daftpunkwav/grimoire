# Testing

> Language: **English** | [简体中文](testing.zh.md)

Operational map for the test layout. Source of truth lives in
[`../../tests/README.md`](../../tests/README.md); this page is the
deployment view (how `vitest` finds tests, how timeouts are tuned, how
coverage thresholds are enforced).

## Test tiers

| Tier | Location | May import | Owned by |
|---|---|---|---|
| Unit / integration | `packages/<name>/tests/`, `services/<name>/tests/`, `apps/<name>/tests/` | The workspace's own `../src/` and its public barrel. | Each workspace. |
| Cross-domain journey | `tests/<journey>/` | `@grimoire/*` public exports only. | Root `tests/`. |
| App-level | `apps/api/tests/`, `apps/web/tests/` | The app's own source + `@grimoire/contracts` (web only). | Each app. |
| Smoke (post-deploy) | `scripts/smoke.mjs` | HTTP only; no in-process state. | CI. |

## Runner configuration

[`../../vitest.config.ts`](../../vitest.config.ts) at the repo root
wires everything:

- **Aliases**: `@grimoire/contracts`, `@grimoire/foundation`,
  `@grimoire/llm`, `@grimoire/identity`, `@grimoire/content`,
  `@grimoire/community`, `@grimoire/agent`, `@grimoire/api`,
  `@grimoire/web`.
- **Include globs**:
  - `tests/**/*.test.ts`
  - `packages/*/tests/**/*.test.ts`
  - `services/*/tests/**/*.test.ts`
  - `apps/*/tests/**/*.test.{ts,tsx}`
- **`testTimeout`**: `30_000` ms.
- **`retry`**: `1` (PowerShell cold start + file-lock release jitter on
  Windows).
- **Coverage provider**: `v8`, scope includes the same source globs as
  the runner, excludes `**/*.test.*`, `**/*.d.ts`, `**/index.ts`
  (barrels), `**/types.ts`, `**/tests/**`, `**/dist/**`.

## Coverage thresholds

Set in [`../../vitest.config.ts`](../../vitest.config.ts) (the
`coverage.thresholds` block). Red means restore the test, **not** lower
the number. Lowering a threshold requires an ADR entry.

| Metric | Threshold |
|---|---|
| Statements | 70 |
| Branches | 60 |
| Functions | 70 |
| Lines | 70 |

These are intentionally soft while the codebase is young; the iron
direction is **up**. Each gate-failure resolution is expected to land
with new tests that raise the bar.

## Test type rules

- **One test file = one thing.** Shared scaffolding > ~25 lines goes
  into `mock-deps.ts` / `fixtures.ts` in the same directory (no `.test`
  suffix so the runner skips it).
- **Journey tests must not write to the filesystem, start servers, or
  open network ports.** Stub everything at the port boundary. The
  composition root is exercised by `apps/api/tests/`, not here.
- **Test files follow the same `@file` / `@description` JSDoc header
  convention as production source.** See
  [`../../AGENTS.md`](../../AGENTS.md).

## Local commands

```bash
pnpm test                  # vitest run (no coverage)
pnpm test:coverage         # vitest run --coverage (CI threshold)
pnpm --filter @grimoire/web test     # one workspace
pnpm --filter @grimoire/api test     # one workspace
```

To debug a single test:

```bash
pnpm test -- -t "should reject malformed payload"
```

(Replace with the actual test name.)

## CI

`pnpm verify` runs the full chain. The CI workflow
`.github/workflows/ci.yml` runs the same chain on `windows-latest` plus
a `smoke` job. The `smoke` job is the only place the server process is
started; the rest of the pipeline runs unit tests only.

Coverage is uploaded as `cov-report/` (always, even on failure) so the
artifact is reviewable.

## Adding a journey test

1. Create `tests/<journey>/<area>.test.ts`.
2. Import only from `@grimoire/*` public barrels. No deep-path imports.
3. Stub the runtime at the port boundary; do not start the server.
4. Add the journey to the discovery glob in
   `vitest.config.ts` only if it does not match the existing
   `tests/**/*.test.ts` pattern (it should).
5. Update the `tests/README.md` map with a one-line summary.
