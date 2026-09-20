# Decision register

> Language: **English** | [简体中文](decision-register.zh.md)

Load-bearing architectural decisions, with rationale and enforcement.
New decisions are **appended** here, never edited in place. To supersede
a decision, add a new row that links to the old one and explains the
change.

| ID | Decision | Rationale | Enforcement |
|---|---|---|---|
| DR-001 | `packages/contracts` is the dependency root for every other workspace and depends on no business package. | Keeps the public port surface discoverable; prevents transitive dependency cycles. | `pnpm boundaries` (rejects any non-contracts package importing a service). |
| DR-002 | The composition root lives only in `services/api/src/compose.ts`. | Single place to wire port implementations; the rest of the codebase can be reasoned about as data flow through ports. | Code review + `pnpm boundaries` (rejects `compose.ts` from any other file). |
| DR-003 | `services/llm` is the only workspace that holds provider credentials. | Honors per-user BYOK isolation; keeps the secrets blast radius bounded. | `pnpm check:deps` + secret scan in CI. |
| DR-004 | Hover sanitize runs at the port boundary, never inside the prompt template. | A trusted boundary is auditable; running it inside the template invites regressions when the prompt is edited. | `packages/contracts/src/hoverSanitize.test.ts` pins the rejection patterns. |
| DR-005 | The web app depends only on `@grimoire/contracts` and `@grimoire/foundation`; all server traffic goes through the API client. | Keeps the front-end build fast and makes the contract surface explicit. | `pnpm boundaries` + the web app's import allowlist. |
| DR-006 | BYOK R-04 (fall back to server provider on BYOK failure) is **off** by default. | Keeps per-user quota isolation honest; turning it on is an explicit, documented opt-in. | `services/llm/src/resilience.ts` + tests. |
| DR-007 | Refresh tokens are stored as sha256 hashes; plaintext is returned exactly once and never persisted. | Allows server-side revocation without keeping the plaintext; protects against DB-only leaks. | `services/identity/src/routes/auth.ts` + `RefreshTokenStore` port tests. |
| DR-008 | Article mutations use `UncheckedUpdateInput` for nullable foreign keys; `ArticleRepository` is the only file that talks to the Prisma model. | Keeps the port surface typed end-to-end and prevents accidental direct model access from routes. | `pnpm boundaries` + tests. |
| DR-009 | Annotation visibility always runs through `AnnotationAcl`; bypass is a gate failure. | Guests must only see `approved` annotations regardless of route. | `pnpm boundaries` + per-route test review. |
| DR-010 | View tracking deduplicates per `(userId \| guestKey, articleId, day)` via `viewTracking`. | Keeps `LearningProgress` counter honest. | `services/content/src/services/viewTracking.test.ts`. |
| DR-011 | Circuit breaker holds the time source by injection (`Clock`); the canonical `Clock` lives in `services/llm` because no other workspace needs it. **Currently in flight:** `resilience.ts` still uses `Date.now()` directly. The migration to an injected `Clock` is tracked under `docs/roadmap/`. | Tests can fast-forward without sleeping; keeps `packages/foundation` dependency-light. | `services/llm/src/clock.ts` (planned) + per-breaker test (`services/llm/src/resilience.test.ts`). |
| DR-012 | All user-visible UI copy lives under `apps/web/src/i18n/catalogs/{en,zh-CN}/`; inline strings are a gate failure. | Keeps the locale boundary auditable; enables catalog-level coverage. | `pnpm --filter @grimoire/web check:i18n`. |
| DR-013 | The dual-Agent surface (hover / panel) shares `streamConsumers.ts` and `agentSseHelpers.ts`; SSE event shapes must not diverge. | The front-end Agent panel and the hover bubble both consume the same shape; divergence breaks both. | `services/agent/src/lib/streamConsumers.test.ts`. |
| DR-014 | The animation authoring surface is template + step-parametric, never a free canvas. | Bounded authoring surface keeps moderation and accessibility tractable. | `apps/web/src/components/anim/registry.ts` + animation tests. |
| DR-015 | `docker-compose.yml` keeps both ports on loopback by default; production deployments must remove the host mapping. | Reduces the public exposure surface; reverse proxy + TLS is the recommended path. | `docs/operations/deployment.md` + deployment review. |
| DR-016 | Test files follow the same `@file` / `@description` JSDoc header convention as production source. | Test files are part of the codebase; their contract deserves the same level of documentation. | Code review. |
| DR-017 | Quality gates run in CI on `windows-latest`. Several suites (process-runner, sandbox, file-lock jitter) are Win32-only. | Avoids platform-gated test flakes; documented in `CONTRIBUTING.md`. | `.github/workflows/ci.yml`. |
| DR-018 | Coverage thresholds are a CI gate; red means restore coverage, not lower numbers. | Prevents gradual erosion of test quality. | `vitest.config.ts` thresholds + `pnpm test:coverage`. |

## Superseded decisions

| ID | Superseded by | Reason |
|---|---|---|
| (none yet) | | |

## Adding a new decision

1. Append a row to the main table. Use the next free `DR-NNN` ID.
2. Fill in rationale and enforcement; the enforcement field must name
   the gate (or "code review") that proves the decision is held.
3. If the new decision replaces an old one, add a row to the
   "Superseded decisions" table with the old ID and the new ID.
4. Open a PR titled `docs: register DR-NNN <short title>`. Include any
   code change that proves the decision is enforceable.
