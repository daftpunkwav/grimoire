# docs/

> Language: **English** | [简体中文](README.zh.md)

Documentation for the Grimoire monorepo. The English document is canonical;
each page is mirrored in Simplified Chinese with the `.zh.md` suffix.

**Source code and tests are authoritative.** When prose and code disagree,
follow the code and the quality gates (`scripts/check-*.mjs`).

## Map

### Architecture — `architecture/`

Conceptual map, layered architecture, dependency rules, and load-bearing
decisions.

| Document | Description |
|---|---|
| [`architecture.md`](architecture.md) | Layered architecture: capability families, dependency directions, shared vocabulary, three load-bearing mechanisms (seams-first, registered backends, single composition root). |
| [`architecture/overview.md`](architecture/overview.md) | Concepts: workspace, service, package, port, composition root. Layer map and key invariants. *Language: 简体中文 (Chinese-only historical snapshot; English version not yet translated — see [`architecture.md`](architecture.md) for the current English overview.)* |
| [`architecture/composition-root.md`](architecture/composition-root.md) | What `services/api/src/compose.ts` wires, in what order, with which startup guards. The only place that constructs port implementations. |
| [`architecture/data-flow.md`](architecture/data-flow.md) | End-to-end flows for hover quick-explain, panel ReAct, content CRUD, and identity bootstrap. Every hop cites the owning workspace. |
| [`architecture/package-layout.md`](architecture/package-layout.md) | Two-level `packages/<name>/` and `services/<name>/` anatomy, dependency rules, name resolution. |
| [`architecture/decision-register.md`](architecture/decision-register.md) | Load-bearing ADRs (decision / rationale / enforcement). New decisions are appended here, never edited in place. |
| [`architecture/agent-modes.md`](architecture/agent-modes.md) | Dual-Agent system: hover Agent vs. panel Agent; fast-direct vs. ReAct tool-loop; caching layers. *Language: 简体中文.* |
| [`architecture/animation-system.md`](architecture/animation-system.md) | Animation runtime: VisualKind × template mapping; step-parametric editing (no free canvas). *Language: 简体中文.* |
| [`architecture/identity-permissions.md`](architecture/identity-permissions.md) | Identity, RBAC, role model (`guest / reader / author / admin`), `adminLevel` grading. *Language: 简体中文.* |
| [`architecture/security.md`](architecture/security.md) | Implemented / pending security checklist; cross-references [../SECURITY.md](../SECURITY.md). *Language: 简体中文.* |
| [`architecture/modular-monolith-microservices-review-2026-08-19.md`](architecture/modular-monolith-microservices-review-2026-08-19.md) | Architecture decision review: keep the modular monolith shape and document the criteria for splitting. *Language: 简体中文.* |

### Guides — `guides/`

Extension how-tos and onboarding walkthroughs.

| Document | Description |
|---|---|
| [`guides/getting-started.md`](guides/getting-started.md) | Prerequisites, `pnpm install`, dev script (precheck + concurrent web + api), first-run walkthrough. |
| [`guides/add-a-service.md`](guides/add-a-service.md) | When to split a service; required seams; registration at the composition root; boundary rules. |
| [`guides/add-a-package.md`](guides/add-a-package.md) | Package anatomy: `name`, `private`, `exports`, `files`, scripts, deps matching actual imports; boundary rules. |

### Reference — `reference/`

Single-source-of-truth pages that document the contract surface.

| Document | Description |
|---|---|
| [`reference/configuration.md`](reference/configuration.md) | All `loadSettings()` env vars, fail-fast behavior, credential references, data layout. |
| [`reference/http-api.md`](reference/http-api.md) | Every HTTP route: auth, body limits, schemas, SSE event shapes, error mappings. |
| [`reference/ports.md`](reference/ports.md) | Port interfaces declared in `@grimoire/contracts`, with their implementing workspace. |
| [`reference/agents.md`](reference/agents.md) | Tool registry, prompt assembly, memory layers, reasoning modes. |
| [`reference/llm-providers.md`](reference/llm-providers.md) | Server-side provider invocation, adapter catalog, breaker semantics, BYOK decrypt. |

### Operations — `operations/`

Run-mode and on-call material.

| Document | Description |
|---|---|
| [`operations/runbook.md`](operations/runbook.md) | Ports, run modes, data layout, shutdown semantics (SIGINT / SIGTERM with 5 s graceful timeout), failure modes. |
| [`operations/quality-gates.md`](operations/quality-gates.md) | The seven gates (`boundaries`, `check:deps`, `check:exports`, `check:i18n`, `lint`, `typecheck`, `test:coverage`) — what each owns and what a failure means. |
| [`operations/testing.md`](operations/testing.md) | Operational map for [`../../tests/README.md`](../../tests/README.md): test tiers, name resolution, coverage thresholds. |
| [`operations/deployment.md`](operations/deployment.md) | Production topology: loopback bindings, reverse proxy + TLS, CSP, env-var audit. *Language: 简体中文.* |
| [`operations/postgres.md`](operations/postgres.md) | Switching dev DB to PostgreSQL (compose + `DATABASE_URL`). *Language: 简体中文.* |
| [`operations/multi-instance-deployment.md`](operations/multi-instance-deployment.md) | Multi-instance / horizontal-scale semantics. *Language: 简体中文.* |

### Roadmap — `roadmap/`

Pending work items that are scoped but not yet implemented. Each roadmap
item must link back to the architecture page that explains the current
shape, and to the relevant ADR in
[`architecture/decision-register.md`](architecture/decision-register.md).

| Document | Description |
|---|---|
| [`roadmap/httponly-cookie-migration.md`](roadmap/httponly-cookie-migration.md) | Pending: HttpOnly cookie auth migration (today: tokens in localStorage). |
| [`roadmap/tool-loop-roadmap.md`](roadmap/tool-loop-roadmap.md) | Pending: tool-loop + MCP deepening. |

### Reviews — `reviews/`

Time-stamped snapshots of past reviews. **Not maintained with the code**;
kept for traceability only.

| Document | Review date | Scope |
|---|---|---|
| [`reviews/code-review-2026-07-23.md`](reviews/code-review-2026-07-23.md) | 2026-07-23 | Initial whole-repo code-quality review. |
| [`reviews/code-review-2026-08-02.md`](reviews/code-review-2026-08-02.md) | 2026-08-02 | Code-quality follow-up. |
| [`reviews/agent-core-review-2026-08-03.md`](reviews/agent-core-review-2026-08-03.md) | 2026-08-03 | Agent-core focused review. |
| [`reviews/architecture-review-2026-08-04.md`](reviews/architecture-review-2026-08-04.md) | 2026-08-04 | Architecture + design review. |
| [`reviews/architecture-decoupling-review-2026-08-09.md`](reviews/architecture-decoupling-review-2026-08-09.md) | 2026-08-09 | Architecture decoupling + resilience review (P0 / P1 / P2 fixes). |
| [`reviews/comprehensive-review-2026-08-04.md`](reviews/comprehensive-review-2026-08-04.md) (+ `.html`) | 2026-08-04 | Round-1 comprehensive review. |
| [`reviews/comprehensive-review-2026-08-04-round2.md`](reviews/comprehensive-review-2026-08-04-round2.md) (+ `.html`) | 2026-08-04 | Round-2 incremental comprehensive review. |
| [`reviews/architecture-review-20260902-Composer.md`](reviews/architecture-review-20260902-Composer.md) | 2026-09-02 | Top-10 architecture issues, fix-batch summary, 3-stage roadmap. |

> The two `comprehensive-review` documents also ship an HTML rendering
> (`.html` in the same directory).

### Dev progress — `dev-progress.md`

[`dev-progress.md`](dev-progress.md) is a dated per-feature implementation
snapshot. It is **not** authoritative — the source tree and the
architecture docs are.

---

## How to add a new document

1. Decide which subdirectory it belongs to (see the map above).
2. Write the English page first; the Chinese mirror must follow within the
   same change.
3. Open a PR titled `docs: <short description>`; the diff must include
   the `.md` and `.zh.md` pair plus any link updates in this README.
4. CI runs `pnpm verify`, which includes the i18n gate; missing mirrors
   are caught by `pnpm check:i18n`'s catalog parity check.
