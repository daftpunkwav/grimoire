# Data flow

> Language: **English** | [简体中文](data-flow.zh.md)

End-to-end flows for the four load-bearing request shapes in Grimoire.
Every hop cites the owning workspace.

## 1. Hover quick-explain

```
Browser hover
  → apps/web (components/agent/useHoverAgent + lib/hoverExplainCache L1)
    → POST /api/v1/agent/explain  (services/api routes/agent → services/agent routes/explain)
      → services/agent/services/agentOrchestrator.hover()
        → @grimoire/contracts/hoverSanitize.sanitize()          # reject malformed
        → services/llm/providers.invoke()                       # LlmProvider port
            → if BYOK: services/identity → services/llm (decrypt via LlmKeyAccess)
            → else:      services/llm provider env key
        → services/agent/services/hoverCache.put()              # L2 server cache (key v7)
    → SSE /api/v1/agent/explain/stream (panel streaming path; same shape)
```

Failure modes:

- Sanitize rejects → 422, no LLM call.
- Breaker open → 503 fast; `errorHandler` maps provider failure to 502.
- BYOK decrypt fails → 401 (no key) or 502 (provider error).

## 2. Panel ReAct chat

```
apps/web/components/agent/AgentPanel
  → POST /api/v1/agent/chat  (services/api routes/agent → services/agent routes/chat)
    → services/agent/services/agentConversation.openOrLoad()
      → services/agent/services/agentOrchestrator.runTurn()
        → services/agent/lib/agentPrompt.assemble()              # Thought → Explain → Practice → Next
        → if reasoningMode: react OR "Allow tools" checked:
            → services/agent/lib/tools/toolLoop.run()
              → services/agent/lib/tools/registry.resolve(toolName)
                → search_articles or get_article
              → services/content/services/articleRepository  # via port
        → SSE: thought / action / observation / final
    → services/agent/services/agentConversation.persist()        # AgentMessage append
```

Failure modes:

- Tool not in registry → 422 + SSE `error`.
- Tool call exceeds `TOOL_LOOP_MAX_ITERS` or `TOOL_LOOP_OVERALL_MS`
  → graceful stop, SSE `cancelled`.
- Provider breaker open → SSE error chunk, conversation not persisted
  beyond the partial turn.

## 3. Article read with annotation visibility

```
Browser GET /knowledge/:slug
  → apps/web/components/article/ArticleBody (lib/api/articles)
    → GET /api/v1/articles?slug=…  (services/api → services/content routes/articles)
      → services/content/services/articleRepository.findBySlug()
      → services/content/services/viewTracking.record()
        → (userId or guestKey, articleId, day) dedupe
    → GET /api/v1/annotations?articleId=…
      → services/content/services/annotationAcl.filter()         # guest → approved only
    → apps/web renders article + filtered annotations
```

## 4. Identity bootstrap (login + me + settings)

```
Browser POST /api/v1/auth/login { email, password }
  → services/identity/routes/auth
    → services/identity/repositories.UserRepository.findByEmail()
    → services/foundation/hash.verify()                          # bcryptjs
    → services/identity/services/auth.issueTokens()
      → services/foundation/jwt.signAccess()
      → services/foundation/jwt.issueRefresh()
        → sha256(token) → services/identity/repositories.RefreshTokenStore.put()
    → 200 { accessToken, refreshToken, user }

Browser GET /api/v1/auth/me  (Authorization: Bearer <accessToken>)
  → services/identity/services/auth.verifyAccess()
    → services/foundation/jwt.verifyAccess()
  → services/identity/repositories.UserRepository.findById()
  → 200 { id, email, role, adminLevel, authorTier }

Browser GET /api/v1/settings  (BYOK encrypted at rest)
  → services/identity/routes/settings
    → services/identity/repositories.UserRepository.findSettings()
    → services/identity/services/settingsHelpers.decryptBYOK()
      → services/foundation/byokCrypto.decrypt()
    → 200 { llmProviderId, byokKey: <decrypted only for this response> }
```

See [`architecture/agent-modes.md`](./agent-modes.md) for the Agent-mode
shape in prose and the prompt templates that the orchestrator uses.
