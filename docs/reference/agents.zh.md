# Agent

> 语言：**简体中文** | [English](agents.md)

站内 Agent 表面的参考:tool registry、提示词装配、记忆层、推理模式。
实现位于 [`services/agent`](../../services/agent/);设计理由见
[`../architecture/agent-modes.md`](../architecture/agent-modes.md),请求形态见
[`../architecture/data-flow.md`](../architecture/data-flow.md#2-面板-react-对话)。

## Tool registry

tool registry 是**唯一**知道面板 Agent 可以调用哪些 tool 的位置。新增 tool
需要三步:

1. 在相关 service 中实现其 port(例如 `services/content` 的
   `articleRepository` 提供 `search_articles`)。
2. 在 [`services/agent/src/lib/tools/registry.ts`](../../services/agent/src/lib/tools/registry.ts)
   中注册。
3. 在 [`packages/contracts/src/permissions.ts`](../../packages/contracts/src/permissions.ts)
   中声明名字,以便 RBAC 层授权。

内置 tool:

| Tool | Args | Result | 所属 service |
|---|---|---|---|
| `search_articles` | `{ query: string; domain?: string; limit?: number }` | `ArticleSummary[]` | `services/content` |
| `get_article` | `{ slug: string }` | `Article` | `services/content` |

registry 把 tool 名解析为实现;未知名字返回 422 + SSE `error`。新增 tool
但未在 permissions 中注册是门禁失败(`pnpm boundaries`)。

## 提示词装配

两个提示词模板位于
[`services/agent/src/lib/agentPrompt.ts`](../../services/agent/src/lib/agentPrompt.ts):

- **Hover**:简短、陈述式、用户 locale 的 2–3 句。使用正例;禁用显式
  「不要…」清单(模型倾向于复述)。
- **Panel**:结构化的 `Thought → Explain → Practice → Next`。当推理模式
  为 `react` 或用户勾选了「允许工具」时,提示词携带 tool registry 描述,
  让模型可以选择调用 tool。

Hover 提示词输入经
[`packages/contracts/src/hoverSanitize.ts`](../../packages/contracts/src/hoverSanitize.ts)
**在装配之前**净化;模板可以假定输入已受信任。

## 记忆

每用户记忆为只读,在提示词装配时注入。三层持久化于 `AgentMemory` 表:

- **Episodic**:最近几轮,上限为最近 N 轮。
- **Semantic**:提炼的事实(例如「用户偏好中文解释」),由面板 Agent 按需
  写入。
- **User profile**:稳定偏好,由 `services/identity` 在设置变更时写入。

记忆**不**会跨越 BYOK 密钥边界持久化:轮换密钥的用户保留记忆;删除账户
的用户其记忆被清空。

## 推理模式

面板 Agent 目前支持三种推理模式:

| 模式 | tool-loop | 成本 | 延迟 |
|---|---|---|---|
| `direct` | 关 | 低 | 低 |
| `react` | 开(「允许工具」的默认) | 中 | 中 |
| `plan` | 关(模型先返回计划,再做最终一轮) | 中 | 高 |

第四种模式 `tree` 已保留但尚未接线(见
[`../roadmap/tool-loop-roadmap.md`](../roadmap/tool-loop-roadmap.md))。

推理模式选择器在前端 Agent 面板中暴露;「允许工具」是旧版复选框,等价于
`react`,以保持向后兼容。

## SSE 事件形态

悬停与面板共用:

```ts
type AgentStreamEvent =
  | { type: "thought";       text: string }
  | { type: "thought_delta"; delta: string }
  | { type: "thought_end" }
  | { type: "action";         toolName: string; args: unknown }
  | { type: "observation";    toolName: string; result: unknown }
  | { type: "tool_progress";  toolName: string; pct: number }
  | { type: "final";          text: string }
  | { type: "error";          code: string; message: string }
  | { type: "cancelled" };
```

完整契约见 [`http-api.md`](./http-api.md#sse-事件形态);钉住的形态见
`streamConsumers.test.ts`。

## L2 悬停缓存

悬停路径使用 L2 服务端缓存,键为
`(articleSlug、locale、promptHash)`,键版本 `v7`。缓存经
`POST /api/v1/agent/cache/clear`(仅管理员)清空。sanitize 在缓存查找之前
执行,所以畸形 payload 永远不会污染缓存。
