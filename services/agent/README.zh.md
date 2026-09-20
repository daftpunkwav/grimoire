# `@grimoire/agent`

> 语言：**简体中文** | [English](README.md)

站内 Agent 服务:悬停快讲、面板 ReAct 对话、记忆、学习进度、tool 注册表。

## 职责

- **悬停快讲**(`POST /api/v1/agent/explain`、
  `POST /api/v1/agent/explain/stream`):单轮 Fast Direct,SSE 流式输出。
  由服务端 L2 缓存(`HoverExplainCache`,缓存键 `v7`)与前端 L1 缓存支持。
  在 port 边界用 `@grimoire/contracts/hoverSanitize` 强制净化。
- **面板 ReAct 对话**(`POST /api/v1/agent/chat`、
  `POST /api/v1/agent/chat/stream`):结构化提示词装配
  (Thought → Explain → Practice → Next),当 `reasoningMode: react` 或
  勾选「允许工具」时启用 P0 tool-loop。tool 调用与结果以 SSE 事件流
  形式下发。
- **记忆**(`/memory`):每用户在提示词装配时只读注入。经 `AgentMemory`
  持久化。
- **学习进度**(`/progress`):`LearningProgress` 账本。
- **缓存管理**(`/cache/clear`,admin):清空 L2 悬停缓存。

## 布局

```
src/
  index.ts                barrel:公共导出(port 实现 + 辅助)
  ports.ts                port 实现:AgentConversationStore、
                          HoverExplainCache、AgentMemoryAccess
  schemas.ts              Zod 请求 / 响应 schemas(也用于 Swagger UI)
  runtime.ts              driver bootstrap + tool-loop 入口
  lib/
    agentPrompt.ts        面板 + 悬停提示词模板
    agentConstants.ts     模型限制、超时、重试预算
    streamConsumers.ts    测试与客户端共用的 SSE consumer 辅助
    tools/
      index.ts            tool registry 的 barrel
      registry.ts         按名字查找 tool(search_articles、get_article)
      parseToolCall.ts    从流式 LLM turn 抽取 JSON
      toolLoop.ts         ReAct loop driver(max iters、timeout、cancel)
      types.ts            共享 tool 输入 / 输出类型
      searchArticles.ts   tool:search_articles
      getArticle.ts       tool:get_article
  routes/
    agent.ts              meta / providers / cache / progress / memory
    explain.ts            悬停快讲 + stream
    chat.ts               面板对话 + stream
    agentSseHelpers.ts    explain/chat 共用的 SSE 事件形态辅助
  services/
    agentConversation.ts  AgentConversation + AgentMessage 持久化
    agentMemory.ts        记忆只读注入
    agentOrchestrator.ts  提示词装配 + driver 调用
    hoverCache.ts         L2 服务端悬停缓存
    learningProgress.ts   LearningProgress 账本
    llmErrors.ts          把 provider 失败映射为 API 错误形态
    userContextCache.ts   每请求用户上下文缓存(BYOK、配额)
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/agent build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/agent typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/agent test` | 同包测试的 Vitest run。 |
| `pnpm --filter @grimoire/agent lint` | oxlint。 |

## 依赖

Runtime:`@grimoire/contracts`、`@grimoire/foundation`、`@grimoire/llm`、
`express`、`express-rate-limit`、`zod`。Dev:`vitest`、`oxlint`、`typescript`。

## 约定

- tool registry 是**唯一**知道面板 Agent 可以调用哪些 tool 的位置。新增
  tool 需要:(1) 在相关 service 实现其 port;(2) 在 `lib/tools/registry.ts`
  注册;(3) 在 `@grimoire/contracts/permissions` 声明名字,以便 RBAC 层授权。
- 悬停与面板路径共用 `streamConsumers.ts` 与 `agentSseHelpers.ts`。SSE
  事件形态不得在两者之间分裂;`lib/streamConsumers.test.ts` 中的测试钉住
  这一契约。
- 净化发生在 port 边界,**而非**提示词模板内部。提示词模板可以假定输入
  已受信任。
