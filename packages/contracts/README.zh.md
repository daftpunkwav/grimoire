# `@grimoire/contracts`

> 语言：**简体中文** | [English](README.md)

零依赖叶子:共享 DTO、权限矩阵、悬停净化、LLM 类型、port 接口。

## 职责

- **DTO**:在前后端以及每个 service 之间流动的请求 / 响应形态。`apps/web`
  的 `src/lib/api/*` 与每个 service 的 `serialize.ts` 的真相源。
- **权限**:RBAC 矩阵(`guest / reader / author / admin`,带 `adminLevel`
  分级)与面板 Agent 查询的每 tool 白名单。
- **悬停净化**:在缓存或返回客户端之前检测并拒绝畸形 / 可疑 payload。
  同样的规则应用于服务端缓存查找。
- **LLM 类型**:`services/llm` 使用的、被其他每个 service 的提示词装配
  消费的共享请求 / 响应类型。
- **Ports**:组合根消费的每个接口。实现位于各自的所属 service。

## 布局

```
src/
  index.ts                barrel:公共导出
  dto.ts                  共享请求 / 响应 DTO
  permissions.ts          RBAC 矩阵 + tool 白名单
  ports.ts                port 接口(UserRepository、ArticleRepository、
                          AgentConversationStore、HoverExplainCache、
                          LlmProvider、LlmKeyAccess、…)
  llm-types.ts            共享 LLM 请求 / 响应类型
  hoverSanitize.ts        payload 检测 + 拒绝
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/contracts build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/contracts typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/contracts test` | Vitest run。 |
| `pnpm --filter @grimoire/contracts lint` | oxlint。 |

## 依赖

Runtime:**无**。Dev:`vitest`、`oxlint`、`typescript`。

## 规则

- 本 package 不依赖任何业务包。任何 service 都不能从这里 import 另一个
  service —— 只能 import port 接口。
- 新增 DTO 是 `dto.ts` 中的一行改动;同一 commit 中镜像到每个
  `serialize.ts` 与每个前端 client 文件。
- 新增 port 需要在所属 service 中提供实现,并在同一 commit 中于
  `services/api/src/compose.ts` 注册。
- 悬停净化规则**有意严格**;`hoverSanitize.test.ts` 中的测试钉住拒绝
  模式。放宽规则需配对的 ADR 条目。
