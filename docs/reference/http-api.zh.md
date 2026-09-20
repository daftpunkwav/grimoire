# HTTP API

> 语言：**简体中文** | [English](http-api.md)

`services/api` 暴露的全部 HTTP 路由。路由按所属 service 分组;组合根在
[`apps/api/src/app.ts`](../../apps/api/src/app.ts) 中挂载。

约定:

- 所有非公共路由都需要 `Authorization: Bearer <accessToken>`。access token
  由 `services/identity` 签发,由 [`packages/foundation/src/auth.ts`](../../packages/foundation/src/auth.ts)
  验证。
- 公共路由:`/health`、`/ready`、`/api/v1/auth/register`、
  `/api/v1/auth/login`、`/api/v1/auth/refresh`。
- Body 限制:`MAX_REQUEST_SIZE`(默认 10 MiB);分块 body 由请求中间件
  重新强制。
- 错误映射:4xx 表示客户端错误(422 校验失败、401 未认证、403 未授权、
  404 不存在、409 冲突),5xx 表示上游 / 服务器错误。响应体是 JSON
  `{ error: { code、message、requestId } }`。
- Swagger UI 仅在开发环境挂载于 `/docs`。

## 横切中间件

```
helmet                    # 安全的 HTTP headers
cors                      # CORS 白名单(CORS_ORIGIN 或开发自动放行)
express.json              # 带 body 大小上限的解析器
express.urlencoded        # 表单 body(极少使用;仅 OAuth 回调)
request-id                # 传递或生成 X-Request-Id
rate-limit                # 每 IP 与每用户配额
auth                      # 可选;按路由应用
error-handler             # 终极中间件;把抛出的错误映射为响应
```

## 路由

### `services/identity`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 公共 | 注册新用户;返回 `{ user、accessToken、refreshToken }`。 |
| POST | `/api/v1/auth/login` | 公共 | 邮箱 + 密码登录;轮换之前的 refresh token。 |
| POST | `/api/v1/auth/logout` | bearer | 吊销 refresh token;幂等。 |
| POST | `/api/v1/auth/refresh` | 公共 | 用 refresh token 换取新 access token。 |
| GET | `/api/v1/auth/me` | bearer | 当前用户摘要。 |
| GET | `/api/v1/author-applications` | bearer (reader) | 列出自己的申请;管理员看到全部。 |
| POST | `/api/v1/author-applications` | bearer (reader) | 提交申请。 |
| PATCH | `/api/v1/author-applications/:id` | bearer (admin) | 通过 / 拒绝。 |
| GET | `/api/v1/settings` | bearer | 每用户设置(BYOK 仅在本响应解密)。 |
| PUT | `/api/v1/settings` | bearer | 更新设置;BYOK 静态加密。 |
| POST | `/api/v1/settings/test-llm` | bearer | 用所选 provider 校验 BYOK 密钥。 |

### `services/content`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/v1/domains` | bearer | 列出领域。 |
| POST | `/api/v1/domains` | bearer (admin) | 创建领域。 |
| PATCH | `/api/v1/domains/:id` | bearer (admin) | 更新领域。 |
| GET | `/api/v1/articles` | bearer | 列出文章(可按 domain、status、author 过滤)。 |
| GET | `/api/v1/articles/:slug` | bearer | 按 slug 取文章;经 `viewTracking` 记录一次阅读。 |
| POST | `/api/v1/articles` | bearer (author) | 创建文章(Markdown 正文)。 |
| PATCH | `/api/v1/articles/:id` | bearer (author) | 更新;对可空外键使用 `UncheckedUpdateInput`。 |
| GET | `/api/v1/animations/:id` | bearer | 动画定义。 |
| POST | `/api/v1/animations` | bearer (author) | 创建动画。 |
| PATCH | `/api/v1/animations/:id` | bearer (author) | 更新动画。 |
| GET | `/api/v1/annotations` | bearer | 列出批注;可见性经 `AnnotationAcl`。 |
| POST | `/api/v1/annotations` | bearer | 提交批注。 |
| PATCH | `/api/v1/annotations/:id` | bearer (author \| admin) | 审批 / 状态转换。 |

### `services/community`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/v1/topics` | bearer | 列出话题。 |
| POST | `/api/v1/topics` | bearer | 创建话题;可选 `articleSlug`。 |
| GET | `/api/v1/topics/:id` | bearer | 话题 + 回复(单层)。 |
| POST | `/api/v1/topics/:id/replies` | bearer | 回复话题。 |

### `services/agent`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/v1/agent/meta` | bearer | Agent 元数据(model、mode、capabilities)。 |
| GET | `/api/v1/agent/providers` | bearer | provider 列表(服务端 + 用户 BYOK)。 |
| POST | `/api/v1/agent/explain` | bearer | 悬停快讲;非流式。 |
| POST | `/api/v1/agent/explain/stream` | bearer | 悬停快讲;SSE。 |
| POST | `/api/v1/agent/chat` | bearer | 面板对话;非流式。 |
| POST | `/api/v1/agent/chat/stream` | bearer | 面板对话;SSE(`thought` / `action` / `observation` / `final` / `error` / `cancelled`)。 |
| GET | `/api/v1/agent/memory` | bearer | 每用户记忆(只读)。 |
| POST | `/api/v1/agent/progress` | bearer | 学习进度更新。 |
| POST | `/api/v1/agent/cache/clear` | bearer (admin) | 清空 L2 悬停缓存。 |

### 横切

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/health` | 公共 | Liveness 探针。 |
| GET | `/ready` | 公共 | Readiness 探针(DB 可达、端口已绑定)。 |
| GET | `/docs` | 仅开发 | Swagger UI,由路由 schema 自动生成。 |

## SSE 事件形态

悬停(`/explain/stream`)与面板(`/chat/stream`)共用同一事件形态;
[`services/agent/src/lib/streamConsumers.test.ts`](../../services/agent/src/lib/streamConsumers.test.ts)
中的测试钉住它们。

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

## 错误码

| Code | HTTP | 触发 |
|---|---|---|
| `validation_failed` | 422 | Zod schema 拒绝了请求 body / params / query。 |
| `unauthenticated` | 401 | 受保护路由缺少 / 过期 / 错误格式的 token。 |
| `unauthorized` | 403 | token 有效,但用户缺少所需角色 / `adminLevel`。 |
| `not_found` | 404 | 资源不存在或被 ACL 隐藏。 |
| `conflict` | 409 | 唯一键冲突或状态机违规。 |
| `provider_error` | 502 | 上游 LLM 调用失败(非熔断相关)。 |
| `breaker_open` | 503 | LLM 熔断在冷却中;快速失败。 |
| `rate_limited` | 429 | 每 IP 或每用户配额超限。 |
| `internal_error` | 500 | 其他一切;`errorHandler` 用 `requestId` 记录完整堆栈。 |
