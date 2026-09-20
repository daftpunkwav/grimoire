# 快速开始

> 语言：**简体中文** | [English](getting-started.md)

首次运行指南:安装、配置、种子数据库、启动开发栈。

## 前置条件

- Node.js ≥ 20.9。精确发布在 [`.nvmrc`](../../.nvmrc) 中钉住。
- pnpm 11。精确发布由 [`package.json`](../../package.json) 中的
  `packageManager` 钉住。
- **Windows 是参考平台。** 若干测试套件(process-runner、沙箱、文件锁
  抖动)仅适用于 Win32,在其他 OS 上跳过。CI 在 `windows-latest` 上
  运行;见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 安装

```bash
pnpm install
```

## 配置 API

```bash
cp .env.example services/api/.env
```

编辑 `services/api/.env`:

- `SEED_ADMIN_PASSWORD` — 必需;无此值种子会拒绝执行。
- `JWT_SECRET` — 把占位符换成一段长随机字符串。
- `DATABASE_URL` — 默认 SQLite(`file:./dev.db`);类生产运行切到
  PostgreSQL(见 [../operations/postgres.md](../operations/postgres.md))。
- `LLM_PROVIDER_ID` 与对应的 `*_API_KEY` / `*_BASE_URL` / `*_MODEL`,
  至少一个 provider。默认是 StepFun。

完整环境参考:[../reference/configuration.md](../reference/configuration.md)。

## 生成、迁移、种子

```bash
pnpm --filter @grimoire/api db:generate
pnpm --filter @grimoire/api db:migrate
pnpm --filter @grimoire/api db:seed
```

种子先跑 `seed.ts`(管理员)再跑 `seed-content.ts`(系统文章与动画)。
两者在缺少必需 env 时都 fail-fast。

## 启动开发栈

```bash
pnpm dev
```

同时启动 `services/api`(8181)与 `apps/web`(8180)。

- 前端:<http://localhost:8180>
- API:<http://localhost:8181/health>
- Swagger UI(仅开发):<http://localhost:8181/docs>

分别启动:

```bash
pnpm dev:web
pnpm dev:api
```

## 验证安装

```bash
pnpm verify
```

完整 CI 门禁:build、typecheck、coverage、boundaries、`check:deps`、
`check:exports`、web i18n。

更快的 smoke:

```bash
pnpm test
```

## 下一步

- 阅读 [../architecture.md](../architecture.md) 了解分层形态与依赖规则。
- 阅读 [../architecture/composition-root.md](../architecture/composition-root.md)
  了解 API 的装配方式。
- 浏览路由表 [../reference/http-api.md](../reference/http-api.md)。
- 如果打算扩展项目,先读 [add-a-service.md](./add-a-service.md) 与
  [add-a-package.md](./add-a-package.md),再开 PR。
