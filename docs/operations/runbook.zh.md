# Runbook

> 语言：**简体中文** | [English](runbook.md)

运维地图:端口、运行模式、数据布局、关闭语义、失败模式。

## 端口

| 端口 | 服务 | 绑定地址(默认) | 说明 |
|---|---|---|---|
| `8180` | `apps/web` | `127.0.0.1` | Vite 开发服务器,strict port。 |
| `8181` | `services/api` | `127.0.0.1` | Express API。开发环境含 `/docs` Swagger UI。 |
| `5432` | `postgres`(compose) | `127.0.0.1` | 仅回环;生产删除此映射。 |

端口规则:web `8180` · api `8181`;新增服务按 `8182`、`8183`、`8184` …
依次顺延。`pnpm dev` **不自动顺延**。

## 运行模式

| 模式 | 启动 | 说明 |
|---|---|---|
| 开发 | `pnpm dev` | web + api 同时;Swagger UI 实时。 |
| 仅 web | `pnpm dev:web` | Vite 开发服务器。 |
| 仅 API | `pnpm dev:api` | `tsx watch services/api`。 |
| 构建 | `pnpm -r build` | 把每个工作区的 TypeScript 编到 dist。 |
| API 启动(已构建) | `pnpm --filter @grimoire/api start` | `node dist/index.js`。 |
| Docker | `docker compose up -d` | postgres + api;web 单独托管。 |
| Smoke | `pnpm smoke` | `scripts/smoke.mjs`;上线后探测。 |

## 数据布局

```
repo-root/
  .env                                  # gitignored;loadSettings()
  .env.example                          # 提交的模板

services/api/
  .env                                  # gitignored;每工作区覆盖
  prisma/
    schema.prisma                       # 15 个模型
    migrations/                         # 生成;提交
    dev.db                              # SQLite 开发;gitignored
    seed.ts                             # 管理员种子
    seed-content.ts                     # 系统内容种子
```

`docker-compose.yml` 为 postgres 数据目录挂载命名卷
(`grimoire_pg_data`)。删除卷可重置数据库:

```bash
docker compose down -v
```

## 关闭语义

API 安装 `SIGINT` 与 `SIGTERM` 处理器。收到信号:

1. 停止接受新连接(关闭 listener)。
2. 等待最多 **5 秒**,让在飞请求完成。
3. 断开 Prisma。
4. 退出码 0。

5 秒宽限期耗尽时,进程退出 1,由 OS 回收。

`pnpm dev`(组合启动器)对每个子进程安装同样的处理器。杀掉启动器会同时
杀掉两个子进程。

## 失败模式

| 症状 | 第一检查 |
|---|---|
| `SettingsLoadError` | 确认 `.env`(或每工作区 `.env`)含每个必需键(见 [`../reference/configuration.md`](../reference/configuration.md))。 |
| `PortInUseError` | 找出占用端口的进程;杀掉或选新端口(不要自动顺延)。 |
| `PrismaClientInitializationError` | 确认 `DATABASE_URL` 与目标数据库匹配(SQLite vs Postgres),SQLite 路径存在,Postgres compose 健康。 |
| `breaker_open`(503) | provider 熔断冷却。见 `LLM_CIRCUIT_*`;等待或在有 ADR 的情况下降低阈值。 |
| `provider_error`(502) | 检查 provider 状态页与 `providerSecret` 解密日志(request id,绝不记录密钥本身)。 |
| BYOK 路由 `unauthenticated`(401) | 用户未保存 BYOK 密钥,或解密失败。检查 `BYOK_ENCRYPTION_KEY` 派生;绝不记录密钥。 |
| 内存增长 | 检查 `viewTracking` 缓存驱逐(进程内 LRU;默认上限在 `services/content/src/services/viewTracking.ts`)。 |
| SSE 中途断开 | 检查反向代理 idle 超时;nginx 默认 60 秒;agent 路由每 15 秒发一次 keep-alive 注释。 |

## 日志

- API 日志是 JSON,由 `pino` 输出。生产关闭 pretty-print。
- 每个请求带 `requestId`;`errorHandler` 在每个错误响应与每条错误日志
  中输出它。
- 前端日志(`apps/web`)输出到浏览器控制台;开发模式也在 Vite overlay 中
  展示。

## 备份

SQLite 开发 DB 备份 `services/api/prisma/dev.db`。Postgres 用 `pg_dump`
对命名卷备份,或跑一个 sidecar 备份。静态加密交给宿主平台。

## 升级

仓库尚未打 tag。在位升级:

1. `pnpm install`(遵循 `pnpm-lock.yaml`)。
2. `pnpm -r build`(捕获 TS 漂移)。
3. `pnpm --filter @grimoire/api db:migrate`(幂等;可安全重跑)。
4. `pnpm verify`(完整门禁)。
5. 重启 API;重载前端。
