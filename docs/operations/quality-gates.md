# Quality gates

> Language: **English** | [简体中文](quality-gates.zh.md)

The seven gates CI runs on `windows-latest`. Each gate owns one
concern; failures mean fix the code or restore the test, **not** lower
the threshold.

`pnpm verify` runs all of them in order. Any single failure exits the
chain non-zero.

| Gate | Script | What it owns | What a failure means |
|---|---|---|---|
| `pnpm -r build` | (per workspace `tsc -p tsconfig.json`) | TypeScript compiles across every workspace. | A workspace diverged from its declared deps or types. Fix the workspace. |
| `pnpm -r typecheck` | (per workspace `tsc --noEmit`) | The same, no emit. | Same. |
| `pnpm typecheck:tests` | `tsc -p tsconfig.tests.json --noEmit` | Tests typecheck against the repo base. | A test references a path the runner can't resolve. |
| `pnpm test:coverage` | `vitest run --coverage` | Unit tests pass and coverage thresholds are met. | Restore the test, not lower the threshold (see `vitest.config.ts`). |
| `pnpm boundaries` | `scripts/check-boundaries.mjs` | Import direction: no cross-service source imports; only `apps/api/src/compose.ts` may import every service. | Move the offending import behind a port, or move it to the composition root. |
| `pnpm check:deps` | `scripts/check-package-deps.mjs` | Declared vs imported deps; no value/dynamic cycles; runtime dep used only in tests → demote. | Update `package.json` to match the imports. |
| `pnpm check:exports` | `scripts/check-export-tests.mjs` | Every callable public export is referenced by a test (constants / schemas / enums ignored). | Add a test for the export, or add it to the `PENDING` allowlist (the list only ever shrinks). |
| `pnpm --filter @grimoire/web check:i18n` | `apps/web/scripts/check-i18n.mjs` | Catalog key parity between `en` and `zh-CN`; CJK sweep over `src/app`, `src/components`, `src/i18n` (with allowlist). | Add the missing translation, or remove the inline string. |
| `pnpm --filter @grimoire/web lint` | `apps/web` oxlint | Web-only lint rules (React hooks, only-export-components). | Fix the code. |

## Per-gate failure table

### `pnpm boundaries`

The script scans every `.ts`/`.tsx` outside the composition root and
rejects:

- `import '@grimoire/<other-service>'` (cross-service source import).
- `import { prisma.<model> }` (cross-domain Prisma model access).

Allowed exceptions are listed in the script's header.

**Fix**: introduce a port in `@grimoire/contracts`, implement it in the
owning service, register it in
[`apps/api/src/compose.ts`](../../apps/api/src/compose.ts), and let the
consumer import only the port.

### `pnpm check:deps`

The script walks each `package.json` and the imports in its `src/`:

- Reject value / dynamic import of an undeclared `@grimoire/*`.
- Reject type-only import of an undeclared `@grimoire/*`.
- Reject value import from a `devDependency` at runtime.
- Reject declared runtime / dev dep used nowhere.
- Reject value / dynamic dependency cycles (type-only edges ignored).
- Warn on declared runtime dep used only in tests → demote to
  `devDependencies`.

**Fix**: edit the `package.json` to match what the code actually
imports. Do not silence the gate.

### `pnpm check:exports`

The script follows each workspace's `src/index.ts` re-export chain and
flags callable public exports (functions, classes, arrows) that no test
references. Constants, Zod schemas, and enum values are ignored.

A `PENDING` allowlist of symbols without tests lives in
`scripts/check-export-tests.mjs`. The list is **read-only at runtime**;
to add a symbol, you must edit the file and explain why in the comment
above the entry. The list is reviewed at every release; it must only
ever shrink.

**Fix**: write the missing test. If a symbol is genuinely internal but
re-exported by accident, narrow the public surface.

### `pnpm --filter @grimoire/web check:i18n`

Two passes:

1. **Catalog parity**: load `apps/web/src/i18n/catalogs/en` and
   `apps/web/src/i18n/catalogs/zh-CN`, then assert every key in `zh-CN`
   is present in `en` and vice versa (with type-level enforcement at
   `tsc` time).
2. **CJK sweep**: walk `apps/web/src/app`, `apps/web/src/components`,
   and `apps/web/src/i18n` for hardcoded Chinese strings outside the
   `zh-CN` catalogs. Comments and `console.*` calls are exempt. An
   allowlist in `apps/web/scripts/check-i18n.mjs` covers known
   non-user-visible CJK (e.g. token payload sentinels).

**Fix**: add the missing key to both catalogs, or extract the inline
string to the `zh-CN` catalog and read it through `useT()`.

## Adding a new gate

1. Add the script under `scripts/<name>.mjs`.
2. Add the `pnpm <name>` alias in `package.json`.
3. Add the gate to the `pnpm verify` chain in dependency order
   (boundaries → deps → exports → i18n → tests → typecheck → build).
4. Add a row to this file with what it owns and what a failure means.
5. Document the new gate in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## CI

`.github/workflows/ci.yml` runs the same gates on `windows-latest`,
plus a `smoke` job that boots `services/api` and probes it with
`pnpm smoke`. The `smoke` job is the only place a server process is
started in CI; the rest of the pipeline runs unit tests only.
