# 架构

> 语言：**简体中文** | [English](architecture.md)

Grimoire 架构由三项关键机制支撑:

1. **Seams first(先定 seams)。** 跨服务通信走 [`@grimoire/contracts`](./reference/ports.md)
   中声明的 port 接口。实现位于所属 service;任何其他工作区都不得 import 它们。
2. **后端注册。** 每个具体实现(provider、tool、dimension、route leaf)按
   名字在组合根注册。新增工作意味着新增注册项,而不是新增条件分支。
3. **单一组合根。** `services/api/src/compose.ts` 是唯一构造 port 实现并
   装配 HTTP host 的位置。见 [architecture/composition-root.md](./architecture/composition-root.md)。

这三项机制让 monorepo 的「模块化单体」形态名副其实:今天所有 service 跑
在一个进程里,明天任意 service 都可以搬进自己的进程 —— 把它的进程内
port 实现换成 HTTP / RPC client 即可,无需改动消费方。

## 分层地图

```
apps/web                    Vite 8 + React 19 SPA;仅 i18n catalog
services/api                Express 5 组合根 + HTTP host
                            (唯一 import 每个 service 的文件)

services/identity           用户、认证、作者申请、设置
services/content            文章、动画、领域、批注
services/community          话题 + 回复
services/agent              悬停 + 面板 Agent、记忆、tool-loop
services/llm                LLM 网关、熔断、BYOK 解密

packages/contracts          零依赖叶子:DTO、ports、permissions、
                            悬停净化、LLM 类型
packages/foundation         errors、logger、JWT、哈希、BYOK 加密、
                            SSE 辅助、中间件、Clock

tests/                      跨域 journey 测试,只能经 @grimoire/*
                            公共导出引用
```

## 依赖规则(由 `pnpm boundaries` 强制)

1. `packages/contracts` 是其他所有工作区的依赖根。它不依赖任何业务包。
2. 组合根仅位于 `services/api/src/compose.ts`。任何其他 port 消费方都从
   `@grimoire/contracts` import,并在根处接收实现。
3. `services/*` 可依赖 `@grimoire/contracts`、`@grimoire/foundation`,以及
   `@grimoire/llm`(仅用于提示词装配)。它们之间互不依赖。
4. `apps/web` 仅依赖 `@grimoire/contracts` 与 `@grimoire/foundation`。
   所有服务端流量由前端 API client 转发。
5. `services/llm` 是唯一持有 provider 凭据的 package。其他 package 通过
   `LlmKeyAccess` port 在一次请求期间读取解密后的密钥。

## 词汇表

共享词汇出现在文档树各处,规范定义集中在这里。

- **Workspace**:`apps/`、`packages/` 或 `services/` 下的目录,自带
  `package.json` 与 workspace 名(`@grimoire/<name>`),并列入
  `pnpm-workspace.yaml`。
- **Service**:`services/<domain>/` 下的工作区,拥有一个 bounded context。
  仅通过 ports 通信。
- **Package**:`packages/<name>/` 下的工作区,发布框架无关的积木。唯一
  允许跨 service 共享可复用代码的位置。
- **Port**:`@grimoire/contracts/ports.ts` 中声明的 TypeScript 接口。
  实现位于所属 service;组合根把它们装配在一起。
- **Composition root**(组合根):`services/api/src/compose.ts`。唯一构造
  port 实现并把每个 service 装配进 HTTP host 的文件。
- **Journey test**:`tests/<journey>/` 下的测试,经公共导出跨越两个或更多
  工作区。能放进单个包的测试放在它旁边。
- **Hover Agent / Panel Agent**:站内 Agent 的两种形态。Hover 是单轮
  Fast Direct,SSE 流式;Panel 是多轮 ReAct,可选 tool-loop。见
  [architecture/agent-modes.md](./architecture/agent-modes.md)。
- **BYOK**:「自带密钥」(Bring Your Own Key)。每用户 provider 密钥在
  `services/identity` 中静态加密存储,按需由 `services/llm` 经
  `LlmKeyAccess` port 解密。
- **R-NN**:编号化的韧性 / 架构决策,见
  [architecture/decision-register.md](./architecture/decision-register.md)。

## 如何阅读其余文档

- [`architecture/overview.md`](./architecture/overview.md) — 概念、分层
  地图、关键不变量。
- [`architecture/composition-root.md`](./architecture/composition-root.md)
  — 根装配的内容、顺序、启动守卫。
- [`architecture/data-flow.md`](./architecture/data-flow.md) — 悬停快讲、
  面板 ReAct、内容 CRUD、身份引导的端到端流。
- [`architecture/package-layout.md`](./architecture/package-layout.md)
  — `packages/<name>/` 与 `services/<name>/` 的两级形态、依赖规则、
  名字解析。
- [`architecture/decision-register.md`](./architecture/decision-register.md)
  — 关键 ADR(决策 / 理由 / 强制机制)。
- [`architecture/agent-modes.md`](./architecture/agent-modes.md) — 双
  Agent 体系。
- [`architecture/animation-system.md`](./architecture/animation-system.md)
  — VisualKind × 模板动画运行时。
- [`architecture/identity-permissions.md`](./architecture/identity-permissions.md)
  — RBAC 矩阵与 `adminLevel` 分级。
- [`architecture/security.md`](./architecture/security.md) — 已实现 /
  待办的安全清单。

完整文档地图见 [`README.md`](./README.md)。
