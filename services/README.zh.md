# services/

> 语言：**简体中文** | [English](README.md)

本目录存放 Grimoire monorepo 的业务域工作区。

每个 service 拥有一个 bounded context。service 之间绝不 import 对方的源码
—— 仅通过 [`@grimoire/contracts`](../packages/contracts/) 中声明的 port
接口通信。

| Service | Workspace | 职责 |
|---|---|---|
| [`identity`](identity/) | `@grimoire/identity` | 认证、用户、作者申请、设置(BYOK 加密)。拥有 `User`、`RefreshToken`、`AuthorApplication`。 |
| [`content`](content/) | `@grimoire/content` | 文章、动画、领域、批注。拥有 `Article`、`Domain`、`AnimationDef`、`Annotation`。 |
| [`community`](community/) | `@grimoire/community` | 话题论坛:`Topic` + `TopicReply`。 |
| [`agent`](agent/) | `@grimoire/agent` | 悬停 + 面板 Agent、记忆、进度、tool-loop。拥有 `AgentConversation`、`AgentMessage`、`AgentMemory`、`LearningProgress`、`HoverExplainCache`。 |
| [`llm`](llm/) | `@grimoire/llm` | LLM 网关:providers、adapters、熔断、BYOK 解密。**唯一**持有 provider 凭据的 package。 |
| [`api`](../apps/api/) | `@grimoire/api` | 组合根 + HTTP host(位于 `apps/api/`,因为它是可运行程序,不是业务域)。 |

## 规则

- service 仅依赖 `@grimoire/contracts` 与 `@grimoire/foundation`。禁止跨
  service 源码 import,由 `scripts/check-boundaries.mjs` 门禁强制。
- service 暴露的每个 port 实现在 `services/api/src/compose.ts` 注册。组合根是
  唯一 import service 内部的位置。
- 每个 service 自带 `routes/`、`services/`、`lib/`、`tests/`。routes 是
  Express 5 处理器;services 是应用层用例;lib 存放该 service 内部的框架
  级辅助。
- 只有当业务域无法表达为现有 service 内部的 port + 实现对时,才新增 service。
  决策标准见 [docs/guides/add-a-service.md](../docs/guides/add-a-service.md)。

完整工作区目录见根 [README](../README.md),分层架构见
[docs/architecture/overview.md](../docs/architecture/overview.md)。
