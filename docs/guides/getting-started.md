# Getting started

> Language: **English** | [简体中文](getting-started.zh.md)

A first-run walkthrough: install, configure, seed the database, and
boot the dev stack.

## Prerequisites

- Node.js >= 20.9. The exact release is pinned in [`.nvmrc`](../../.nvmrc).
- pnpm 11. The exact release is pinned by `packageManager` in
  [`package.json`](../../package.json).
- **Windows is the reference platform.** Several test suites
  (process-runner, sandbox, file-lock jitter) are Win32-only and skip
  on other OSes. CI runs on `windows-latest`; see
  [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Install

```bash
pnpm install
```

## Configure the API

```bash
cp .env.example services/api/.env
```

Edit `services/api/.env`:

- `SEED_ADMIN_PASSWORD` — required; the seed refuses to run without it.
- `JWT_SECRET` — replace the placeholder with a long random string.
- `DATABASE_URL` — defaults to SQLite (`file:./dev.db`); switch to
  PostgreSQL for production-like runs (see
  [../operations/postgres.md](../operations/postgres.md)).
- `LLM_PROVIDER_ID` + matching `*_API_KEY` / `*_BASE_URL` / `*_MODEL`
  for at least one provider. The default is StepFun.

Full env reference: [../reference/configuration.md](../reference/configuration.md).

## Generate, migrate, and seed

```bash
pnpm --filter @grimoire/api db:generate
pnpm --filter @grimoire/api db:migrate
pnpm --filter @grimoire/api db:seed
```

The seed runs `seed.ts` (admin) then `seed-content.ts` (system articles
and animations). Both fail-fast on missing required env.

## Boot the dev stack

```bash
pnpm dev
```

This launches `services/api` (8181) and `apps/web` (8180) together.

- Front-end: <http://localhost:8180>
- API: <http://localhost:8181/health>
- Swagger UI (dev only): <http://localhost:8181/docs>

To run them separately:

```bash
pnpm dev:web
pnpm dev:api
```

## Verify the install

```bash
pnpm verify
```

This is the full CI gate: build, typecheck, coverage, boundaries,
`check:deps`, `check:exports`, web i18n.

For a faster smoke:

```bash
pnpm test
```

## Next steps

- Read [../architecture.md](../architecture.md) for the layered shape
  and dependency rules.
- Read [../architecture/composition-root.md](../architecture/composition-root.md)
  for how the API is wired.
- Browse the route table in
  [../reference/http-api.md](../reference/http-api.md).
- If you intend to extend the project, read
  [add-a-service.md](./add-a-service.md) and
  [add-a-package.md](./add-a-package.md) before opening a PR.
