# 配置

> 语言：**简体中文** | [English](configuration.md)

`loadSettings()` 读取的全部环境变量。真相源:
[`services/api/src/lib/env.ts`](../../services/api/src/lib/env.ts)。每个调用
它的工作区都运行同一个 loader;缺失或格式错误的值在启动时 fail-fast。

## 读取顺序

```
1. process.env               # 显式覆盖优先
2. 仓库根 .env                # 以 .env.example 提交;绝不提交 .env
3. 工作区本地 .env            # apps/web/.env、services/api/.env(gitignored)
```

本地开发把 `.env.example` 复制为 `.env`(或 `services/api/.env`)并编辑必需
键。`.env` 已 gitignored。

## API / HTTP

| 变量 | 默认 | 必填 | 说明 |
|---|---|---|---|
| `PORT` | `8181` | 否 | API 绑定端口。前端 `/api` 代理跟随,除非被 `VITE_API_PORT` 覆盖。 |
| `HOST` | `127.0.0.1` | 否 | 绑定地址。容器 / 反向代理后设为 `0.0.0.0`。 |
| `CORS_ORIGIN` | (开发:自动放行 localhost) | 生产必填 | 逗号分隔的白名单。生产缺失即 fail-fast。 |
| `TRUST_PROXY` | `0` | 否 | 仅在可信反向代理后设为 `1`。直连暴露时开启会让客户端伪造 `X-Forwarded-For` 绕过限流。 |
| `LOG_LEVEL` | `debug` (开发) / `info` (生产) | 否 | `debug` \| `info` \| `warn` \| `error`。 |

## 数据库

| 变量 | 默认 | 必填 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | 否 | SQLite 路径或 PostgreSQL URL。PostgreSQL 通过 `docker-compose.yml`。 |
| `NODE_ENV` | `development` | 否 | `development` / `production`。 |

## 认证

| 变量 | 默认 | 必填 | 说明 |
|---|---|---|---|
| `JWT_SECRET` | 占位符 | 是 | 长随机字符串。占位符下种子拒绝执行。 |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | 否 | access-token TTL。 |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | 否 | refresh-token TTL。 |
| `BYOK_ENCRYPTION_KEY` | (从 `JWT_SECRET` 派生) | 否 | BYOK 静态加密的 AES-GCM 密钥,>= 16 字符。建议生产用专用密钥。 |

## 种子

| 变量 | 默认 | 必填 | 说明 |
|---|---|---|---|
| `SEED_ADMIN_EMAIL` | `admin@example.local` | 否 | 引导管理员邮箱。 |
| `SEED_ADMIN_PASSWORD` | (无) | **是** | 引导管理员密码。缺失 → 种子拒绝执行。 |
| `SEED_ADMIN_NAME` | `Admin` | 否 | 显示名。 |
| `SEED_FORCE_ADMIN` | `0` | 否 | 设为 `1` 以提权已存在的同邮箱用户。 |

## LLM providers

默认 provider 是 StepFun。新增 provider 意味着在
[`services/llm/src/adapters/`](../../services/llm/src/adapters/) 下新增文件
并注册;见 [llm-providers.md](./llm-providers.md)。

| 变量 | 默认 | 必填 | 说明 |
|---|---|---|---|
| `LLM_PROVIDER_ID` | `stepfun` | 否 | Adapter id。 |
| `STEPFUN_API_KEY` | (无) | 使用时必填 | 服务端 StepFun 密钥。 |
| `STEPFUN_BASE_URL` | `https://api.stepfun.com/step_plan` | 否 | Anthropic 兼容 base。 |
| `STEPFUN_MODEL` | `step-3.7-flash` | 否 | 默认 model。 |
| `STEPFUN_API_FORMAT` | `anthropic_messages` | 否 | Adapter 选择器。 |
| `OPENAI_API_KEY` | (无) | 使用时必填 | OpenAI 密钥。 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 否 | |
| `OPENAI_MODEL` | `gpt-4o-mini` | 否 | |
| `OPENAI_API_FORMAT` | `openai_chat` | 否 | `openai_chat` \| `openai_responses`。 |
| `GENERIC_LLM_*` | (无) | 否 | 可选通用网关。 |

## LLM 韧性

| 变量 | 默认 | 说明 |
|---|---|---|
| `LLM_CIRCUIT_FAILURES` | `3` | 连续 N 次失败后熔断。 |
| `LLM_CIRCUIT_OPEN_MS` | `30000` | 开放期间冷却;快速 503。 |
| `LLM_MAX_CONCURRENT` | `12` | 进程内并发上限。 |
| `LLM_QUEUE_WAIT_MS` | `5000` | 满员时排队等位;超时 503。 |
| `LLM_BYOK_FALLBACK_TO_SERVER` | `0` | R-04。默认关闭以保证每用户配额隔离。 |

## Agent tool-loop

| 变量 | 默认 | 说明 |
|---|---|---|
| `TOOL_LOOP_MAX_ITERS` | `5` | 每 turn 最大 ReAct 迭代。 |
| `TOOL_TIMEOUT_MS` | `8000` | 每 tool 超时。 |
| `TOOL_LOOP_OVERALL_MS` | `75000` | ReAct 循环墙上时间;必须 < 前端 tools 模式超时(90 秒)。 |

## Web (Vite)

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_PORT` | `8180` | Vite 开发服务器端口。 |
| `VITE_API_PORT` | (跟随 `PORT` 或 `8181`) | 前端 `/api` 代理目标。 |
| `VITE_API_BASE_URL` | (相对 `/api/v1`) | 仅当前端独立部署时直连跨源。 |

## 失败与含义

- `SettingsLoadError`:进程在绑定端口之前退出。
- `PortInUseError`:端口预检失败;不重试。
- provider 熔断开:503,`Retry-After` 取自 `LLM_CIRCUIT_OPEN_MS`。
