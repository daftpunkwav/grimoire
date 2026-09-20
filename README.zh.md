# Grimoire

> 语言：**简体中文** | [English](README.md)

交互式 Agent / LLM 学习平台。读者端与作者端共享一个模块化单体:富文本文章、
可分步动画,以及一套站内双形态 Agent(悬停快讲 + 面板 ReAct)。

## 快速开始

```bash
pnpm install

# 必需:SEED_ADMIN_PASSWORD 与 JWT_SECRET(见 .env.example)。
cp .env.example services/api/.env

# 数据库与种子(schema 在 services/api/prisma)。
pnpm --filter @grimoire/api db:generate
pnpm --filter @grimoire/api db:migrate
pnpm --filter @grimoire/api db:seed

# 同时启动前后端(推荐):前端 8180,API 8181(开发环境含 /docs Swagger UI)。
pnpm dev
```

端口:

- 前端:<http://localhost:8180>(回环,strict port)
- API:<http://localhost:8181/health>
- API 文档(Swagger UI,仅开发环境):<http://localhost:8181/docs>

端口编号规则:**8180** 前端 · **8181** API(含 `/docs`);后续新增服务按
**8182、8183、8184** … 依次顺延。`pnpm dev` **不自动顺延**;端口被占用
会清晰提示并退出。

### 显式指定端口

```bash
VITE_PORT=5555 PORT=3333 pnpm dev      # 同时指定前后端
VITE_PORT=5555 pnpm dev                # 只改前端
PORT=3333 pnpm dev                     # 只改后端(前端 /api 代理自动跟随)

pnpm dev:web                           # 仅前端
pnpm dev:api                           # 仅后端
```

`VITE_API_BASE_URL` 默认走相对路径 `/api/v1`(由 Vite dev proxy 转发);
仅当前后端独立部署时才显式设置,此时还需配置生产 `CORS_ORIGIN` 与 CSP
`connect-src`。

CORS 开发模式自动放行本机任意端口;生产保持严格 `CORS_ORIGIN` 白名单
(必填,缺失即 fail-fast)。API 默认仅绑定 `127.0.0.1`;容器或反代后
用 `HOST=0.0.0.0`(见 [docs/operations/deployment.md](docs/operations/deployment.md))。

### 默认管理员

`db:seed` 根据 `SEED_ADMIN_*` 创建唯一管理员:

- 邮箱:`admin@example.local`(用 `SEED_ADMIN_EMAIL` 覆盖)
- 密码:**必须** 在 `.env` 中通过 `SEED_ADMIN_PASSWORD` 设置(无内置兜底;
  缺失即拒绝执行)
- 角色:`admin`,`adminLevel=100`,`authorTier=elite`
- 已存在同邮箱用户时**不会**自动提权,需 `SEED_FORCE_ADMIN=1`

## 架构

### 工作区布局

```
apps/web                Vite 8 + React 19 + RR 7 前端;i18n catalog 位于
                        src/i18n;仅依赖 contracts 与 foundation
services/api            组合根 + Express 5 HTTP host + Swagger UI
                        (services/api 是唯一把所有服务装配进 ports 并启动
                        HTTP 的位置)

services/identity       认证、用户、作者申请、设置(User、RefreshToken、
                        AuthorApplication)
services/content        文章、动画、领域、批注(Article、Domain、
                        AnimationDef、Annotation)
services/community      话题论坛(Topic、TopicReply)
services/agent          悬停 + 面板 Agent、记忆、进度、tool-loop
services/llm            LLM 网关:providers、adapters、熔断、BYOK 解密,
                        持有全部密钥

packages/contracts      共享 DTO、权限矩阵、悬停净化、LLM 类型;零依赖叶子
packages/foundation     基础设施:errors、logger、JWT、哈希、BYOK 加密、
                        SSE、中间件

tests/                  跨域 journey 测试,只能经 @grimoire/* 公共导出引用
                        (见 tests/README.md)
scripts/                质量门禁与开发辅助(见 scripts/README.md)
docs/                   英文与简体中文并行文档(地图见 docs/README.md)
```

### 依赖规则

1. `packages/contracts` 是叶子。所有 package 可依赖它,它不依赖任何业务包。
2. 组合根**只**位于 `services/api/src/compose.ts`,拥有全部装配(port 实现
   与依赖注入)。
3. 服务之间只通过 contracts ports 通信,**绝不** import 对方实现。
4. `services/llm` 是**唯一**持有 provider 凭据的 package;其他 package 经
   `LlmKeyAccess` port 读取解密后的密钥。
5. `apps/web` 仅依赖 `@grimoire/contracts` 与 `@grimoire/foundation`;
   其他服务端流量由前端 API client 转发。

### 关键 ports(`@grimoire/contracts`)

| Port | 用途 | 实现在 |
|---|---|---|
| `UserRepository` | 用户查找 / 持久化 | `services/identity` |
| `RefreshTokenStore` | refresh token 轮换与吊销 | `services/identity` |
| `ArticleRepository` | 文章 CRUD + 搜索 | `services/content` |
| `AnnotationAcl` | 批注可见性与审核 | `services/content` |
| `TopicRepository` | 话题与回复持久化 | `services/community` |
| `AgentConversationStore` | 会话与消息账本 | `services/agent` |
| `HoverExplainCache` | L2 服务端悬停缓存 | `services/agent` |
| `LlmProvider` | 服务端 provider 调用 | `services/llm` |
| `LlmKeyAccess` | BYOK 解密 + 每用户配额 | `services/llm` |
| `Clock` | 可替换时间源 | `packages/foundation` |

`CircuitBreaker` 不是 contracts port —— 它是 `services/llm` 内部的有状态
breaker 原语,时间源在构造时注入,按 provider 持有。

### 一次悬停快讲的数据流

```
浏览器悬停
  → apps/web(useHoverAgent + hoverExplainCache L1)
    → POST /api/v1/agent/explain(services/api routes/agent)
      → services/agent(HoverExplainService)
        → services/llm(LlmProvider,BYOK 走 LlmKeyAccess)
      → HoverExplainCache(L2,缓存键 v7)
    → SSE /api/v1/agent/explain/stream(面板流式路径)
```

### 一次面板 ReAct turn 的数据流

```
apps/web AgentPanel
  → POST /api/v1/agent/chat  →  services/agent(AgentConversationService)
    → AgentDriver.run() with reasoningMode: react
      → tool registry 解析 search_articles / get_article
      → SSE:thought / action / observation / final
    → AgentMemory 在 prompt 装配时只读注入
```

## 测试

```bash
pnpm test               # vitest run
pnpm test:coverage      # 阈值门控
pnpm typecheck          # 全仓 typecheck
pnpm -r build           # 构建所有 package
```

测试策略与预算见
[docs/operations/testing.md](docs/operations/testing.md);覆盖率阈值是门禁,
红了意味着补测试,而不是调数字。

## 开发

Node.js ≥ 20.9(`.nvmrc` 钉住精确版本),pnpm 11(`packageManager` 字段钉住精确
发布)。workspace 成员见 `pnpm-workspace.yaml`。

```bash
pnpm build          # 构建所有 package
pnpm typecheck      # 全仓 typecheck + 测试 typecheck
pnpm test           # vitest
pnpm test:coverage  # 阈值门控的覆盖率
pnpm boundaries     # scripts/check-boundaries.mjs(import 方向)
pnpm check:deps     # scripts/check-package-deps.mjs(声明 vs 实际)
pnpm check:exports  # scripts/check-export-tests.mjs(每个导出都有测试)
pnpm check:i18n     # apps/web i18n 门禁(catalog 对等 + CJK 扫描)
pnpm lint           # 各 workspace oxlint
pnpm verify         # CI 全门禁:build + typecheck + coverage + lint +
                    #   i18n + boundaries + deps + exports
```

前端自带门禁 `pnpm --filter @grimoire/web check:i18n`:检查 `en` 与
`zh-CN` 的 catalog key 对等,并对 `src/app`、`src/components`、`src/i18n`
做 CJK 扫描,确保用户可见文案绝不绕过 catalog。

### 仓库布局

```
apps/<app>/            组合根(api)与前端(web);见 apps/README.md
packages/<name>/       能力包;每个包都包含 src/、tests/、README.md、
                       package.json、tsconfig.json
services/<domain>/     每个业务域一个 workspace;形态同上
tests/<journey>/       跨域 journey 测试,只能经 @grimoire/* 公共导出
scripts/               质量门禁(boundaries、deps、exports、i18n)与开发
                       辅助(dev.mjs、smoke.mjs)
docs/                  英文与简体中文并行的文档树;地图见 docs/README.md
```

每个 package 的 README 描述职责、seam 表面与依赖方向;
[docs/architecture/overview.md](docs/architecture/overview.md) 定义分层
架构、依赖方向与共享词汇。

### 约定

- Commit 遵循 Conventional Commits,type 为 `feat`、`fix`、`docs`、
  `refactor`、`chore`、`test`、`perf`,subject 祈使式且至多 50 字符,
  每个 commit 一个关注点。分支为 `<type>/<kebab-case>`。
- 代码与注释为英文。文档提供英文与简体中文两个版本。用户可见的 UI 文案
  放在 `apps/web/src/i18n/catalogs/`,以 `zh-CN` 为规范、`en` 类型被钉住,
  绝不内联。
- 组合根拥有全部装配。新增服务意味着在 `services/api/src/compose.ts`
  注册其 port 实现。
- 沙箱 / deny-list 决策位于 `services/llm`;前端信任 API 强制执行所有策略。
- 贡献从 [CONTRIBUTING.md](CONTRIBUTING.md) 开始(简体中文:
  [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md))。
- 编码 agent 遵循 [AGENTS.md](AGENTS.md)。

## 工作区目录

| Workspace | 职责 |
|---|---|
| `@grimoire/web` | Vite 8 + React 19 + RR 7 SPA,i18n provider,开发服务器 |
| `@grimoire/api` | Express 5 组合根 + Swagger UI + Docker 镜像 |
| `@grimoire/identity` | 认证、用户、作者申请、设置(BYOK 加密) |
| `@grimoire/content` | 文章、动画、领域、批注 |
| `@grimoire/community` | 话题论坛(话题 + 回复) |
| `@grimoire/agent` | 悬停 + 面板 Agent、记忆、进度、tool-loop |
| `@grimoire/llm` | LLM 网关:providers、adapters、熔断、BYOK 解密 |
| `@grimoire/contracts` | 共享 DTO、权限矩阵、悬停净化 |
| `@grimoire/foundation` | 基础设施:errors、logger、JWT、哈希、SSE、中间件 |
