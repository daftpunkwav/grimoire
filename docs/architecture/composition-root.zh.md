# 组合根

> 语言：**简体中文** | [English](composition-root.md)

`services/api/src/compose.ts` 是仓库中**唯一** import 其他 service 源码的文件。
它也是唯一构造 port 实现并把它们装配进 HTTP host 的文件。

## 入口链

```
进程启动
  → services/api/src/index.ts
      → loadSettings()              # env.ts:已校验,fail-fast
      → prisma()                    # lib/prisma.ts:共享单例
      → compose()                   # compose.ts:构建 RuntimeComponents
      → startServer(components)     # app.ts:绑定 + 路由 + listen
      → installSignalHandlers()     # SIGINT/SIGTERM 优雅关闭
```

顺序固定。`loadSettings()` 必须先成功,然后 `prisma()` 才能连接;`prisma()`
就绪后 `compose()` 才能构建会查询它的实现;`compose()` 必须完成,
`startServer()` 才能绑定依赖这些实现的端口。

## `compose()` 装配的内容

按顺序:

1. **基础**:`Clock`、`Logger`、`ErrorHandler` —— 来自 `@grimoire/foundation`。
2. **Identity**:`UserRepository`、`RefreshTokenStore`、settings 辅助 ——
   来自 `@grimoire/identity`。
3. **Content**:`ArticleRepository`、`AnnotationAcl`、view tracking —— 来自
   `@grimoire/content`。
4. **Community**:`TopicRepository` —— 来自 `@grimoire/community`。
5. **LLM**:`LlmProvider`、`LlmKeyAccess`、熔断、adapter 目录 —— 来自
   `@grimoire/llm`。
6. **Agent**:`AgentConversationStore`、`HoverExplainCache`、
   `AgentMemoryAccess`、提示词装配、tool 注册表 —— 来自 `@grimoire/agent`。
7. **HTTP**:Express app、路由挂载、中间件栈、Swagger UI —— 在 `app.ts` 中
   用已装配的 service 构建。

组合结果是 `RuntimeComponents` bundle,`startServer()` 消费它,不再做额外
变更。

## 启动守卫

| 守卫 | 失败模式 |
|---|---|
| `loadSettings()` 缺少必需 env | 进程以 `SettingsLoadError` 退出(HTTP 500 风格消息,非零退出码)。不绑定端口。 |
| `prisma()` 连接失败 | 进程在 `compose()` 之前退出。 |
| `compose()` port 实现在初始化时抛出 | 同上;依赖该 port 的路由永远不会被挂载。 |
| `startServer()` 端口被占用 | 进程在快速预检后以 `PortInUseError` 退出;若预检竞态且 bind 失败,`errorHandler` 返回 503。 |
| `installSignalHandlers()` 缺失 | 进程拒绝启动(`index.ts` 中的门禁记录日志并退出)。 |

## 新增 port

1. 在 [`packages/contracts/src/ports.ts`](../../packages/contracts/src/ports.ts)
   中声明 port 接口。
2. 在所属 service(例如 `services/<name>/src/<thing>.ts`)中实现。
3. 在 [`services/api/src/compose.ts`](../../services/api/src/compose.ts) 对应的
   `compose()` 步骤中注册实现。
4. 至少加一个测试覆盖消费该 port 的路由。CI 门禁 `pnpm check:exports`
   强制导出覆盖;`pnpm boundaries` 强制路由只 import port 表面。

## 反模式

- 在 `compose.ts` 之外 import 其他 service 的源码。`pnpm boundaries`
  门禁拒绝。
- 在路由处理器内构造 service 的 port 实现。在 `compose()` 中构造一次
  并注入。
- 不在组合根注册就新增 route leaf。每个路由只挂载一次。
- 在 service 之间共享模块级状态(缓存的 `Date.now()`、缓存的 env
  读取、跨 service 边界的单例)。状态在 `compose()` 中创建,随
  `RuntimeComponents` bundle 传递。
