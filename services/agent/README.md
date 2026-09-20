# `@grimoire/agent`

> Language: **English** | [简体中文](README.zh.md)

In-product Agent services: hover quick-explain, panel ReAct chat,
memory, learning progress, and the tool registry.

## Responsibilities

- **Hover quick-explain** (`POST /api/v1/agent/explain`,
  `POST /api/v1/agent/explain/stream`): single-turn Fast Direct, streamed
  via SSE. Backed by an L2 server cache (`HoverExplainCache`, cache key
  `v7`) and a front-end L1 cache. Sanitization is enforced at the port
  boundary using `@grimoire/contracts/hoverSanitize`.
- **Panel ReAct chat** (`POST /api/v1/agent/chat`,
  `POST /api/v1/agent/chat/stream`): structured prompt assembly
  (Thought → Explain → Practice → Next), with the P0 tool-loop enabled
  when `reasoningMode: react` or the "Allow tools" checkbox is on. Tool
  calls and results are streamed as SSE events.
- **Memory** (`/memory`): per-user read-only injection at prompt
  assembly. Persisted via `AgentMemory`.
- **Learning progress** (`/progress`): `LearningProgress` ledger.
- **Cache management** (`/cache/clear`, admin): wipes the L2 hover cache.

## Layout

```
src/
  index.ts                barrel: public exports (port impls + helpers)
  ports.ts                port implementations: AgentConversationStore,
                          HoverExplainCache, AgentMemoryAccess
  schemas.ts              Zod request / response schemas for the agent
                          routes (also used by Swagger UI)
  runtime.ts              driver bootstrap + tool-loop entrypoint
  lib/
    agentPrompt.ts        panel + hover prompt templates
    agentConstants.ts     model limits, timeouts, retry budget
    streamConsumers.ts    SSE consumer helpers used by tests + clients
    tools/
      index.ts            barrel for the tool registry
      registry.ts         tool lookup by name (search_articles, get_article)
      parseToolCall.ts    JSON extraction from a streamed LLM turn
      toolLoop.ts         ReAct loop driver (max iters, timeout, cancel)
      types.ts            shared tool input / output types
      searchArticles.ts   tool: search_articles
      getArticle.ts       tool: get_article
  routes/
    agent.ts              meta / providers / cache / progress / memory
    explain.ts            hover quick-explain + stream
    chat.ts               panel chat + stream
    agentSseHelpers.ts    SSE event shape helpers shared by explain/chat
  services/
    agentConversation.ts  AgentConversation + AgentMessage persistence
    agentMemory.ts        read-only memory injection
    agentOrchestrator.ts  prompt assembly + driver invocation
    hoverCache.ts         L2 server-side hover cache
    learningProgress.ts   LearningProgress ledger
    llmErrors.ts          maps provider failures to API error shapes
    userContextCache.ts   per-request user context cache (BYOK, quota)
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/agent build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/agent typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/agent test` | Vitest run for co-located tests. |
| `pnpm --filter @grimoire/agent lint` | oxlint. |

## Dependencies

Runtime: `@grimoire/contracts`, `@grimoire/foundation`,
`@grimoire/llm`, `express`, `express-rate-limit`, `zod`. Dev: `vitest`,
`oxlint`, `typescript`.

## Conventions

- Tool registry is the **only** place that knows which tools the panel
  Agent can call. Adding a tool requires (1) implementing its port in
  the relevant service, (2) registering it in `lib/tools/registry.ts`,
  (3) declaring its name in `@grimoire/contracts/permissions` so the
  RBAC layer can authorize it.
- The hover and panel paths share `streamConsumers.ts` and
  `agentSseHelpers.ts`. The shape of an SSE event must not diverge
  between them; tests in `lib/streamConsumers.test.ts` pin the contract.
- Sanitization happens at the port boundary, **not** in the prompt
  template. The prompt template is allowed to assume its inputs are
  already trusted.
