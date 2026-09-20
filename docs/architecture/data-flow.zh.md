# 数据流

> 语言：**简体中文** | [English](data-flow.md)

Grimoire 四种关键请求形态的端到端流,每一跳都指向所属工作区。

## 1. 悬停快讲

```
浏览器悬停
  → apps/web(components/agent/useHoverAgent + lib/hoverExplainCache L1)
    → POST /api/v1/agent/explain(services/api routes/agent → services/agent routes/explain)
      → services/agent/services/agentOrchestrator.hover()
        → @grimoire/contracts/hoverSanitize.sanitize()          # 拒绝畸形
        → services/llm/providers.invoke()                       # LlmProvider port
            → BYOK:services/identity → services/llm(经 LlmKeyAccess 解密)
            → 否则:    services/llm provider env key
        → services/agent/services/hoverCache.put()              # L2 服务端缓存(键 v7)
    → SSE /api/v1/agent/explain/stream(面板流式路径;同一形态)
```

失败模式:

- sanitize 拒绝 → 422,不调 LLM。
- 熔断开 → 快速 503;`errorHandler` 把 provider 失败映射为 502。
- BYOK 解密失败 → 401(无密钥)或 502(provider 错误)。

## 2. 面板 ReAct 对话

```
apps/web/components/agent/AgentPanel
  → POST /api/v1/agent/chat(services/api routes/agent → services/agent routes/chat)
    → services/agent/services/agentConversation.openOrLoad()
      → services/agent/services/agentOrchestrator.runTurn()
        → services/agent/lib/agentPrompt.assemble()              # Thought → Explain → Practice → Next
        → 若 reasoningMode: react 或勾选了「允许工具」:
            → services/agent/lib/tools/toolLoop.run()
              → services/agent/lib/tools/registry.resolve(toolName)
                → search_articles 或 get_article
              → services/content/services/articleRepository      # 经 port
        → SSE:thought / action / observation / final
    → services/agent/services/agentConversation.persist()        # AgentMessage 追加
```

失败模式:

- tool 不在 registry → 422 + SSE `error`。
- tool 调用超过 `TOOL_LOOP_MAX_ITERS` 或 `TOOL_LOOP_OVERALL_MS` → 优雅
  停止,SSE `cancelled`。
- provider 熔断开 → SSE 错误分块,会话在部分 turn 之内不持久化。

## 3. 阅读文章(带批注可见性)

```
浏览器 GET /knowledge/:slug
  → apps/web/components/article/ArticleBody(lib/api/articles)
    → GET /api/v1/articles?slug=…(services/api → services/content routes/articles)
      → services/content/services/articleRepository.findBySlug()
      → services/content/services/viewTracking.record()
        → (userId 或 guestKey、articleId、day) 去重
    → GET /api/v1/annotations?articleId=…
      → services/content/services/annotationAcl.filter()         # guest → 仅 approved
    → apps/web 渲染文章 + 过滤后的批注
```

## 4. 身份引导(登录 + me + 设置)

```
浏览器 POST /api/v1/auth/login { email, password }
  → services/identity/routes/auth
    → services/identity/repositories.UserRepository.findByEmail()
    → services/foundation/hash.verify()                          # bcryptjs
    → services/identity/services/auth.issueTokens()
      → services/foundation/jwt.signAccess()
      → services/foundation/jwt.issueRefresh()
        → sha256(token) → services/identity/repositories.RefreshTokenStore.put()
    → 200 { accessToken, refreshToken, user }

浏览器 GET /api/v1/auth/me(Authorization: Bearer <accessToken>)
  → services/identity/services/auth.verifyAccess()
    → services/foundation/jwt.verifyAccess()
  → services/identity/repositories.UserRepository.findById()
  → 200 { id、email、role、adminLevel、authorTier }

浏览器 GET /api/v1/settings(BYOK 静态加密)
  → services/identity/routes/settings
    → services/identity/repositories.UserRepository.findSettings()
    → services/identity/services/settingsHelpers.decryptBYOK()
      → services/foundation/byokCrypto.decrypt()
    → 200 { llmProviderId、byokKey:<仅本响应解密> }
```

Agent 形态的散文描述与 orchestrator 使用的提示词模板见
[`architecture/agent-modes.md`](./agent-modes.md)。
