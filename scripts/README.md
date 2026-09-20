# scripts/

> Language: **English** | [简体中文](README.zh.md)

Root-level scripts: quality gates, the dev launcher, and the post-deploy
smoke probe. Each script is plain Node (`*.mjs`) with no build step, so
they can be invoked directly with `node` or via the corresponding `pnpm`
alias.

## Inventory

| Script | pnpm alias | Purpose |
|---|---|---|
| `dev.mjs` | `pnpm dev` | Combined dev launcher: pre-checks ports 8180 / 8181, then spawns `@grimoire/api` + `@grimoire/web` with env forwarding; graceful SIGTERM / SIGINT with a 10 s force-kill fallback. |
| `smoke.mjs` | `pnpm smoke` | Post-deploy probe: read-only HTTP probes against a running server (health / readiness / sessions / agent meta). Bounded timeout; no writes. CI invokes it inside the `smoke` job after `apps/api` boots. |
| `check-boundaries.mjs` | `pnpm boundaries` | Import-direction gate: rejects `import '@grimoire/<other-service>'` outside `services/api`, plus cross-domain Prisma model access. Companion to `check-package-deps`. |
| `check-package-deps.mjs` | `pnpm check:deps` | Dependency-honesty gate: rejects value / dynamic import of an undeclared `@grimoire/*`; rejects type-only import of an undeclared workspace dep; rejects declared runtime dep used nowhere; rejects value / dynamic dependency cycles; warns on declared runtime dep used only in tests (demote to `devDependencies`). |
| `check-export-tests.mjs` | `pnpm check:exports` | Export-coverage gate: every callable public export must be referenced by a test file. Constants / schemas / enums are ignored. Maintains a `PENDING` allowlist of symbols without tests; the list must only ever shrink. |
| `check-i18n.mjs` | `pnpm --filter @grimoire/web check:i18n` | Apps/web i18n gate: catalog-key parity between `en` and `zh-CN`, plus a CJK sweep over `src/app`, `src/components`, and `src/i18n` so user-visible copy never bypasses the catalogs. |

## Conventions

- Scripts live in this directory and have no external build step. They are
  invoked via `node scripts/<name>.mjs` or via the matching `pnpm` alias
  declared in the root `package.json`.
- A script is a **gate** when its `process.exitCode` is non-zero on failure;
  every gate runs in CI on `windows-latest`.
- New scripts must include a JSDoc `@file` / `@description` header matching
  the source-file convention in [../AGENTS.md](../AGENTS.md).

See [../docs/operations/quality-gates.md](../docs/operations/quality-gates.md)
for the full gate catalog and failure semantics.
