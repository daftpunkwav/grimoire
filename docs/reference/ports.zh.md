# Ports

> 语言：**简体中文** | [English](ports.md)

[`packages/contracts/src/ports.ts`](../../packages/contracts/src/ports.ts)
中声明的每个 port 接口,以及拥有实现的工作区和消费方。

组合根恰好一次装配每个 port 实现。每个消费方从 `@grimoire/contracts`
import port;没有任何消费方 import 另一个 service 的源码。

## Identity

| Port | 实现 | 消费方 |
|---|---|---|
| `UserRepository` | `services/identity/src/repositories.ts` | `services/api`(auth 路由)、`services/content`(文章归属)、`services/agent`(记忆注入)。 |
| `RefreshTokenStore` | `services/identity/src/repositories.ts` | `services/identity`(auth + logout)。 |

## Content

| Port | 实现 | 消费方 |
|---|---|---|
| `ArticleRepository` | `services/content/src/services/articleRepository.ts` | `services/content`(路由)、`services/agent`(tool:`get_article`、`search_articles`)。 |
| `AnnotationAcl` | `services/content/src/services/annotationAcl.ts` | `services/content`(批注路由)、列出批注的每个调用方。 |
| `TopicRepository` | `services/community/src/index.ts` | `services/community`(topic 路由)。 |

## Agent

| Port | 实现 | 消费方 |
|---|---|---|
| `AgentConversationStore` | `services/agent/src/services/agentConversation.ts` | `services/agent`(chat 路由)、`services/agent`(orchestrator)。 |
| `HoverExplainCache` | `services/agent/src/services/hoverCache.ts` | `services/agent`(explain 路由)。 |
| `AgentMemoryAccess` | `services/agent/src/services/agentMemory.ts` | `services/agent`(orchestrator 在提示词装配时)。 |

## LLM

| Port | 实现 | 消费方 |
|---|---|---|
| `LlmProvider` | `services/llm/src/providers.ts` | `services/agent`(orchestrator)。 |
| `LlmKeyAccess` | `services/llm/src/providerSecret.ts` | `services/llm`(一次请求作用域)。 |

## Foundation

| Port | 实现 | 消费方 |
|---|---|---|
| `Clock` | `packages/foundation/src/clock.ts`(注入) | 熔断、缓存 TTL、JWT 过期检查。 |
| `Logger` | `packages/foundation/src/logger.ts` | 每个工作区。 |
| `ErrorHandler` | `packages/foundation/src/errorHandler.ts` | `services/api`(终极中间件)。 |

## 新增 port

1. 在 `packages/contracts/src/ports.ts` 中声明接口。
2. 在所属工作区实现;从该工作区的 `src/index.ts` re-export。
3. 在 [`services/api/src/compose.ts`](../../services/api/src/compose.ts) 对应
   `compose()` 步骤中注册实现。
4. 至少加一个通过 `RuntimeComponents` bundle 使用该 port 的消费方。

package 级别指南见 [`../guides/add-a-package.md`](../guides/add-a-package.md),
service 级别见 [`../guides/add-a-service.md`](../guides/add-a-service.md)。
