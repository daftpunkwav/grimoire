# docs/

> 语言：**简体中文** | [English](README.md)

Grimoire monorepo 的文档。英文文档为规范;每页都以 `.zh.md` 后缀镜像一份
简体中文。

**源码与测试为权威。** 当文字与代码冲突时,以代码与质量门禁
(`scripts/check-*.mjs`)为准。

## 地图

### 架构 — `architecture/`

概念地图、分层架构、依赖规则与关键决策。

| 文档 | 说明 |
|---|---|
| [`architecture.md`](architecture.md) | 分层架构:能力族、依赖方向、共享词汇、三项关键机制(seams-first、后端注册、单一组合根)。 |
| [`architecture/overview.md`](architecture/overview.md) | 概念:workspace、service、package、port、组合根。分层地图与关键不变量。 |
| [`architecture/composition-root.md`](architecture/composition-root.md) | `services/api/src/compose.ts` 装配的内容、顺序与启动守卫。唯一构造 port 实现的位点。 |
| [`architecture/data-flow.md`](architecture/data-flow.md) | 悬停快讲、面板 ReAct、内容 CRUD、身份引导的端到端流,每一跳都指向所属工作区。 |
| [`architecture/package-layout.md`](architecture/package-layout.md) | `packages/<name>/` 与 `services/<name>/` 的两级形态、依赖规则、名字解析。 |
| [`architecture/decision-register.md`](architecture/decision-register.md) | 关键 ADR(决策 / 理由 / 强制机制)。新决策追加,不在原地修改。 |
| [`architecture/agent-modes.md`](architecture/agent-modes.md) | 双 Agent 体系:悬停 Agent 与面板 Agent;fast-direct 与 ReAct tool-loop;缓存层。 |
| [`architecture/animation-system.md`](architecture/animation-system.md) | 动画运行时:VisualKind × 模板映射;步骤参数化编辑(非自由画布)。 |
| [`architecture/identity-permissions.md`](architecture/identity-permissions.md) | 身份、RBAC、角色模型(`guest / reader / author / admin`)、`adminLevel` 分级。 |
| [`architecture/security.md`](architecture/security.md) | 已实现 / 待办的安全清单;交叉引用 [../SECURITY.md](../SECURITY.md)。 |
| [`architecture/modular-monolith-microservices-review-2026-08-19.md`](architecture/modular-monolith-microservices-review-2026-08-19.md) | 架构决策审查:保持模块化单体形态,记录拆分标准。 |

### 指南 — `guides/`

扩展 how-to 与上手文档。

| 文档 | 说明 |
|---|---|
| [`guides/getting-started.md`](guides/getting-started.md) | 前置条件、`pnpm install`、dev 脚本(预检 + 同时拉起 web + api)、首次运行指南。 |
| [`guides/add-a-service.md`](guides/add-a-service.md) | 何时拆分 service;必需的 seams;在组合根注册;边界规则。 |
| [`guides/add-a-package.md`](guides/add-a-package.md) | package 形态:`name`、`private`、`exports`、`files`、scripts、与实际 import 匹配的依赖;边界规则。 |

### 参考 — `reference/`

记录契约表面的单源文档。

| 文档 | 说明 |
|---|---|
| [`reference/configuration.md`](reference/configuration.md) | 全部 `loadSettings()` 环境变量、fail-fast 行为、凭据引用、数据布局。 |
| [`reference/http-api.md`](reference/http-api.md) | 每条 HTTP 路由:认证、body 限制、schemas、SSE 事件形态、错误映射。 |
| [`reference/ports.md`](reference/ports.md) | `@grimoire/contracts` 中声明的 port 接口与对应实现工作区。 |
| [`reference/agents.md`](reference/agents.md) | tool registry、prompt 装配、记忆层、推理模式。 |
| [`reference/llm-providers.md`](reference/llm-providers.md) | 服务端 provider 调用、adapter 目录、熔断语义、BYOK 解密。 |

### 运维 — `operations/`

运行模式与上线值班材料。

| 文档 | 说明 |
|---|---|
| [`operations/runbook.md`](operations/runbook.md) | 端口、运行模式、数据布局、关闭语义(SIGINT / SIGTERM,5 秒优雅超时)、失败模式。 |
| [`operations/quality-gates.md`](operations/quality-gates.md) | 七大门禁(`boundaries`、`check:deps`、`check:exports`、`check:i18n`、`lint`、`typecheck`、`test:coverage`)—— 各门禁的职责与失败含义。 |
| [`operations/testing.md`](operations/testing.md) | [`../../tests/README.md`](../../tests/README.md) 的运维地图:测试层级、名字解析、覆盖率阈值。 |
| [`operations/deployment.md`](operations/deployment.md) | 生产拓扑:回环绑定、反向代理 + TLS、CSP、环境变量审计。 |
| [`operations/postgres.md`](operations/postgres.md) | 开发 DB 切换到 PostgreSQL(compose + `DATABASE_URL`)。 |
| [`operations/multi-instance-deployment.md`](operations/multi-instance-deployment.md) | 多实例 / 横向扩缩语义。 |

### 路线图 — `roadmap/`

已立项但尚未实现的待办。每条路线图都必须反向链接到解释当前形态的架构
页,以及 [`architecture/decision-register.md`](architecture/decision-register.md)
中的相关 ADR。

| 文档 | 说明 |
|---|---|
| [`roadmap/httponly-cookie-migration.md`](roadmap/httponly-cookie-migration.md) | 待办:HttpOnly Cookie 会话迁移(目前 token 存 localStorage)。 |
| [`roadmap/tool-loop-roadmap.md`](roadmap/tool-loop-roadmap.md) | 待办:tool-loop + MCP 深化。 |

### 审查报告 — `reviews/`

时点快照。**不随代码维护**,仅用于追溯。

| 文档 | 审查日期 | 范围 |
|---|---|---|
| [`reviews/code-review-2026-07-23.md`](reviews/code-review-2026-07-23.md) | 2026-07-23 | 初次全仓代码质量审查。 |
| [`reviews/code-review-2026-08-02.md`](reviews/code-review-2026-08-02.md) | 2026-08-02 | 代码质量复查。 |
| [`reviews/agent-core-review-2026-08-03.md`](reviews/agent-core-review-2026-08-03.md) | 2026-08-03 | Agent 核心专项审查。 |
| [`reviews/architecture-review-2026-08-04.md`](reviews/architecture-review-2026-08-04.md) | 2026-08-04 | 架构与设计审查。 |
| [`reviews/architecture-decoupling-review-2026-08-09.md`](reviews/architecture-decoupling-review-2026-08-09.md) | 2026-08-09 | 架构脱耦与韧性审查(P0 / P1 / P2 修复)。 |
| [`reviews/comprehensive-review-2026-08-04.md`](reviews/comprehensive-review-2026-08-04.md)(+ `.html`) | 2026-08-04 | Round-1 全面审查。 |
| [`reviews/comprehensive-review-2026-08-04-round2.md`](reviews/comprehensive-review-2026-08-04-round2.md)(+ `.html`) | 2026-08-04 | Round-2 增量全面审查。 |
| [`reviews/architecture-review-20260902-Composer.md`](reviews/architecture-review-20260902-Composer.md) | 2026-09-02 | TOP-10 架构问题、修复批次汇总、三阶段路线图。 |

> 两份 `comprehensive-review` 还附带 HTML 渲染版(同目录 `.html`)。

### 开发进度 — `dev-progress.md`

[`dev-progress.md`](dev-progress.md) 是按日期的功能实现快照。**它不是权威**
—— 源码与架构文档才是。

---

## 如何新增一篇文档

1. 决定它属于哪个子目录(见上方地图)。
2. 先写英文页;简体中文镜像必须在同一变更中跟进。
3. 开一个标题为 `docs: <short description>` 的 PR;diff 必须包含 `.md`
   与 `.zh.md` 对,以及本 README 中的链接更新。
4. CI 运行 `pnpm verify`,其中包含 i18n 门禁;缺失镜像会被 `pnpm check:i18n`
   的 catalog 对等检查捕获。
