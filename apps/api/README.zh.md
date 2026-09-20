# `@grimoire/api`

> 语言：**简体中文** | [English](README.md)

Grimoire 组合根:Express 5 + Prisma 6 + Swagger UI + Docker 镜像。**唯一**
构造 port 实现并把所有服务装配进 HTTP host 的位置。

## 职责

- HTTP host:绑定、路由、中间件、限流、优雅关闭。
- 组合根:实例化每个 service 的 port 实现,并在每个路由消费的位置注入。
- 健康探针:`/health` 与 `/ready`。
- 仅开发环境的 Swagger UI,挂载于 `/docs`(由路由 schemas 通过
  `zod-to-openapi` 自动生成)。
- Prisma schema、迁移与种子脚本。
- 仓库根 `docker-compose.yml` 使用的 Dockerfile。

## 布局

```
src/
  index.ts              入口;启动 server、安装信号处理
  app.ts                Express app 工厂(中间件 + 路由挂载)
  compose.ts            组合根:构造每个 service 的 port 实现并注入
  lib/
    env.ts              loadSettings()(已校验,fail-fast)
    prisma.ts           共享 PrismaClient 单例

prisma/
  schema.prisma         15 个模型(User、RefreshToken、Domain、Article、
                        AnimationDef、ArticleAnimation、Topic、TopicReply、
                        AuthorApplication、Annotation、AgentConversation、
                        AgentMessage、AgentMemory、LearningProgress、
                        HoverExplainCache)
  seed.ts               管理员种子(消费 SEED_ADMIN_*)
  seed-content.ts       系统文章与动画种子

scripts/
  test-hover-extract.ts 悬停答案调优时的一次性脚本

Dockerfile              生产镜像
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/api dev` | `tsx watch src/index.ts`。 |
| `pnpm --filter @grimoire/api build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/api start` | 运行构建后的 server。 |
| `pnpm --filter @grimoire/api db:generate` | `prisma generate`。 |
| `pnpm --filter @grimoire/api db:migrate` | `prisma migrate dev`。 |
| `pnpm --filter @grimoire/api db:seed` | 运行 `seed.ts` + `seed-content.ts`。 |
| `pnpm --filter @grimoire/api db:reset` | 删库重建并重新种子(仅开发)。 |
| `pnpm --filter @grimoire/api test` | Vitest run。 |

## 环境

见 [../../.env.example](../../.env.example)。关键 env(`loadSettings()`
fail-fast):

- `PORT`(默认 `8181`),`HOST`(默认 `127.0.0.1`)。
- `DATABASE_URL`(SQLite 默认 `file:./dev.db`;PostgreSQL 通过
  `docker-compose.yml`)。
- `JWT_SECRET`、`JWT_ACCESS_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN`。
- `CORS_ORIGIN`(生产必填;开发环境自动放行 localhost)。
- `SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD`(密码必填)。

完整参考:[../../docs/reference/configuration.md](../../docs/reference/configuration.md)。

## 约定

- 组合根是唯一 import service 源码的文件。其他任何消费方(包括未来
  `apps/api/src/routes/*`)只能从 `@grimoire/contracts` import。
- 服务启动顺序固定:`env → prisma → compose → listen → signal handlers`。
  顺序记录于 [../../docs/architecture/composition-root.md](../../docs/architecture/composition-root.md)。
- Dockerfile 是生产镜像来源。CI 在 smoke job 中构建它。

## 依赖

Runtime:`express`、`cors`、`helmet`、`express-rate-limit`、`jsonwebtoken`、
`bcryptjs`、`pino`、`dotenv`、`zod`、`@prisma/client`、
`@grimoire/{contracts,foundation,llm,identity,content,community,agent}`。
Dev:`tsx`、`prisma`、`pino-pretty`、`vitest`、`oxlint`、`typescript`。
