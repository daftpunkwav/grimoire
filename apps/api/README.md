# `@grimoire/api`

> Language: **English** | [简体中文](README.zh.md)

Grimoire composition root: Express 5 + Prisma 6 + Swagger UI + Docker
image. The **only** place that constructs port implementations and wires
every service into the HTTP host.

## Responsibilities

- HTTP host: bind, route, middleware, rate-limit, graceful shutdown.
- Composition root: instantiate every service's port implementation and
  inject them where each route consumes them.
- Health probes: `/health` and `/ready`.
- Dev-only Swagger UI mounted at `/docs` (auto-generated from route
  schemas via `zod-to-openapi`).
- Prisma schema, migrations, and seed scripts.
- Dockerfile used by `docker-compose.yml` at the repo root.

## Layout

```
src/
  index.ts              entry; starts the server, installs signal handlers
  app.ts                Express app factory (middlewares + route mounting)
  compose.ts            composition root: constructs every service's port
                        implementation and injects them
  lib/
    env.ts              loadSettings() (validated, fail-fast)
    prisma.ts           shared PrismaClient singleton

prisma/
  schema.prisma         15 models (User, RefreshToken, Domain, Article,
                        AnimationDef, ArticleAnimation, Topic, TopicReply,
                        AuthorApplication, Annotation, AgentConversation,
                        AgentMessage, AgentMemory, LearningProgress,
                        HoverExplainCache)
  seed.ts               admin seed (consumes SEED_ADMIN_* env)
  seed-content.ts       system articles + animations seed

scripts/
  test-hover-extract.ts one-off extractor used during hover-answer tuning

Dockerfile              production image
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/api dev` | `tsx watch src/index.ts`. |
| `pnpm --filter @grimoire/api build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/api start` | Run the built server. |
| `pnpm --filter @grimoire/api db:generate` | `prisma generate`. |
| `pnpm --filter @grimoire/api db:migrate` | `prisma migrate dev`. |
| `pnpm --filter @grimoire/api db:seed` | Run `seed.ts` + `seed-content.ts`. |
| `pnpm --filter @grimoire/api db:reset` | Drop + recreate + reseed (development only). |
| `pnpm --filter @grimoire/api test` | Vitest run. |

## Environment

See [../../.env.example](../../.env.example). Critical env (fail-fast at
`loadSettings()`):

- `PORT` (default `8181`), `HOST` (default `127.0.0.1`).
- `DATABASE_URL` (SQLite default `file:./dev.db`; PostgreSQL via
  `docker-compose.yml`).
- `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
- `CORS_ORIGIN` (production required; development auto-allows localhost).
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (password required).

Full reference: [../../docs/reference/configuration.md](../../docs/reference/configuration.md).

## Conventions

- The composition root is the only file that imports from a service's
  source. Every other consumer (including `services/api/src/routes/*` if
  added) must import only from `@grimoire/contracts`.
- Service startup order is fixed: `env → prisma → compose → listen →
  signal handlers`. The order is documented in
  [../../docs/architecture/composition-root.md](../../docs/architecture/composition-root.md).
- The Dockerfile is the production image source. CI builds it as part of
  the smoke job.

## Dependencies

Runtime: `express`, `cors`, `helmet`, `express-rate-limit`, `jsonwebtoken`,
`bcryptjs`, `pino`, `dotenv`, `zod`, `@prisma/client`,
`@grimoire/{contracts,foundation,llm,identity,content,community,agent}`.
Dev: `tsx`, `prisma`, `pino-pretty`, `vitest`, `oxlint`,
`typescript`.
