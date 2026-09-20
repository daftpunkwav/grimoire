# Ports

> Language: **English** | [简体中文](ports.zh.md)

Every port interface declared in
[`packages/contracts/src/ports.ts`](../../packages/contracts/src/ports.ts),
with the workspace that owns the implementation and the consumers that
read from it.

The composition root wires every port implementation exactly once.
Every consumer imports the port from `@grimoire/contracts`; no consumer
imports another service's source.

## Identity

| Port | Implementation | Consumers |
|---|---|---|
| `UserRepository` | `services/identity/src/repositories.ts` | `services/api` (auth routes), `services/content` (article ownership), `services/agent` (memory injection). |
| `RefreshTokenStore` | `services/identity/src/repositories.ts` | `services/identity` (auth + logout). |

## Content

| Port | Implementation | Consumers |
|---|---|---|
| `ArticleRepository` | `services/content/src/services/articleRepository.ts` | `services/content` (routes), `services/agent` (tool: `get_article`, `search_articles`). |
| `AnnotationAcl` | `services/content/src/services/annotationAcl.ts` | `services/content` (annotation routes), every caller that lists annotations. |
| `TopicRepository` | `services/community/src/index.ts` | `services/community` (topic routes). |

## Agent

| Port | Implementation | Consumers |
|---|---|---|
| `AgentConversationStore` | `services/agent/src/services/agentConversation.ts` | `services/agent` (chat routes), `services/agent` (orchestrator). |
| `HoverExplainCache` | `services/agent/src/services/hoverCache.ts` | `services/agent` (explain routes). |
| `AgentMemoryAccess` | `services/agent/src/services/agentMemory.ts` | `services/agent` (orchestrator at prompt assembly). |

## LLM

| Port | Implementation | Consumers |
|---|---|---|
| `LlmProvider` | `services/llm/src/providers.ts` | `services/agent` (orchestrator). |
| `LlmKeyAccess` | `services/llm/src/providerSecret.ts` | `services/llm` (one request scope). |

## Foundation

| Port | Implementation | Consumers |
|---|---|---|
| `Clock` | `packages/foundation/src/clock.ts` (injected) | Breakers, cache TTLs, JWT expiry checks. |
| `Logger` | `packages/foundation/src/logger.ts` | Every workspace. |
| `ErrorHandler` | `packages/foundation/src/errorHandler.ts` | `services/api` (final middleware). |

## Adding a port

1. Declare the interface in `packages/contracts/src/ports.ts`.
2. Implement it in the owning workspace; re-export from the workspace's
   `src/index.ts`.
3. Register the implementation in
   [`services/api/src/compose.ts`](../../services/api/src/compose.ts) inside the
   matching `compose()` step.
4. Add at least one consumer that uses the port through the
   `RuntimeComponents` bundle.

See [`../guides/add-a-package.md`](../guides/add-a-package.md) for
package-level guidance, and
[`../guides/add-a-service.md`](../guides/add-a-service.md) for
service-level guidance.
