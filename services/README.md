# services/

> Language: **English** | [简体中文](README.zh.md)

This directory holds the business-domain workspaces of the Grimoire monorepo.

Each service owns one bounded context. Services never import another
service's source — they communicate only through port interfaces declared
in [`@grimoire/contracts`](../packages/contracts/).

| Service | Workspace | Responsibility |
|---|---|---|
| [`identity`](identity/) | `@grimoire/identity` | Authentication, users, author applications, settings (BYOK encrypted). Owns `User`, `RefreshToken`, `AuthorApplication`. |
| [`content`](content/) | `@grimoire/content` | Articles, animations, domains, annotations. Owns `Article`, `Domain`, `AnimationDef`, `Annotation`. |
| [`community`](community/) | `@grimoire/community` | Topic forum: `Topic` + `TopicReply`. |
| [`agent`](agent/) | `@grimoire/agent` | Hover + panel Agents, memory, progress, tool-loop. Owns `AgentConversation`, `AgentMessage`, `AgentMemory`, `LearningProgress`, `HoverExplainCache`. |
| [`llm`](llm/) | `@grimoire/llm` | LLM gateway: providers, adapters, breaker, BYOK decryption. The **only** package that holds provider credentials. |
| [`api`](../apps/api/) | `@grimoire/api` | Composition root + HTTP host (lives under `apps/api/` because it is a runnable, not a domain). |

## Rules

- A service depends only on `@grimoire/contracts` and
  `@grimoire/foundation`. No cross-service source imports are allowed;
  the gate `scripts/check-boundaries.mjs` enforces this.
- Every port implementation a service exposes is registered in
  `services/api/src/compose.ts`. The composition root is the only place that
  imports service internals.
- Each service ships its own `routes/`, `services/`, `lib/`, and `tests/`.
  Routes are Express 5 handlers; services are the application-layer use
  cases; lib holds framework-level helpers that are still internal to the
  service.
- A new service is introduced only when a business domain cannot be
  expressed as a port + implementation pair inside an existing service.
  See [docs/guides/add-a-service.md](../docs/guides/add-a-service.md) for
  the decision criteria.

See the root [README](../README.md) for the full workspace catalog and
[docs/architecture/overview.md](../docs/architecture/overview.md) for the
layered architecture.
