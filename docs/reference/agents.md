# Agents

> Language: **English** | [简体中文](agents.zh.md)

Reference for the in-product Agent surface: tool registry, prompt
assembly, memory layers, and reasoning modes. Implementation lives in
[`services/agent`](../../services/agent/); see also
[`../architecture/agent-modes.md`](../architecture/agent-modes.md) for
the design rationale and
[`../architecture/data-flow.md`](../architecture/data-flow.md#2-panel-react-chat)
for the request shape.

## Tool registry

The tool registry is the **only** place that knows which tools the
panel Agent can call. Adding a tool requires three steps:

1. Implement its port in the relevant service (e.g.
   `services/content/src/services/articleRepository` for
   `search_articles`).
2. Register it in
   [`services/agent/src/lib/tools/registry.ts`](../../services/agent/src/lib/tools/registry.ts).
3. Declare its name in
   [`packages/contracts/src/permissions.ts`](../../packages/contracts/src/permissions.ts)
   so the RBAC layer can authorize it.

Built-in tools:

| Tool | Args | Result | Authoritative service |
|---|---|---|---|
| `search_articles` | `{ query: string; domain?: string; limit?: number }` | `ArticleSummary[]` | `services/content` |
| `get_article` | `{ slug: string }` | `Article` | `services/content` |

The registry resolves a tool name to its implementation; unknown names
return a 422 + SSE `error`. Adding a tool without registering it in
permissions is a gate failure (`pnpm boundaries`).

## Prompt assembly

Two prompt templates live in
[`services/agent/src/lib/agentPrompt.ts`](../../services/agent/src/lib/agentPrompt.ts):

- **Hover**: short, declarative, 2–3 sentences in the user's locale.
  Uses positive examples; forbids explicit "do not…" lists because
  models tend to parrot them.
- **Panel**: structured
  `Thought → Explain → Practice → Next`. When the reasoning mode is
  `react` or the user has the "Allow tools" checkbox on, the prompt
  carries the tool registry description so the model can choose to
  invoke a tool.

Hover prompt inputs are passed through
[`packages/contracts/src/hoverSanitize.ts`](../../packages/contracts/src/hoverSanitize.ts)
**before** prompt assembly; the template assumes its inputs are
already trusted.

## Memory

Per-user memory is read-only and injected at prompt assembly. There are
three layers, persisted in the `AgentMemory` table:

- **Episodic**: recent turns, capped to the last N exchanges.
- **Semantic**: distilled facts (e.g. "user prefers CJK explanations"),
  written by the panel Agent on demand.
- **User profile**: stable preferences, written by `services/identity`
  on settings change.

Memory is **not** persisted across the BYOK key boundary: a user who
rotates their provider key keeps their memory; a user who deletes their
account has their memory purged.

## Reasoning modes

The panel Agent supports three reasoning modes today:

| Mode | Tool-loop | Cost | Latency |
|---|---|---|---|
| `direct` | off | low | low |
| `react` | on (default for "Allow tools") | medium | medium |
| `plan` | off (model returns a plan first, then a final turn) | medium | high |

A fourth mode, `tree`, is reserved but not yet wired (see
[`../roadmap/tool-loop-roadmap.md`](../roadmap/tool-loop-roadmap.md)).

The reasoning mode selector is exposed in the front-end Agent panel;
"Allow tools" is the legacy checkbox and equivalent to `react` for
backward compatibility.

## SSE event shapes

Shared by hover and panel:

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

See [`http-api.md`](./http-api.md#sse-event-shapes) for the full
contract and `streamConsumers.test.ts` for the pinned shape.

## L2 hover cache

The hover path uses an L2 server cache keyed on
`(articleSlug, locale, promptHash)` with key version `v7`. The cache is
cleared by `POST /api/v1/agent/cache/clear` (admin only). Sanitization
runs before the cache lookup, so malformed payloads never poison the
cache.
