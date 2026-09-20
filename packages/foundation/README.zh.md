# `@grimoire/foundation`

> 语言：**简体中文** | [English](README.md)

基础设施:errors、logger、JWT、哈希、BYOK 加密、SSE 辅助、共享 Express
中间件。唯一允许依赖除 `apps/` 之外所有其他包的 package。

## 职责

- **错误映射**:一个 `errorHandler` 把已知抛出的错误翻译成 HTTP 响应
  (4xx / 5xx + JSON body),未知错误以 `InternalServerError` 形式暴露,
  携带 request id。
- **JWT**:access token 签发 + 验证、refresh-token 轮换辅助、吊销表
  契约。
- **哈希**:`bcryptjs` 封装,被 `services/identity` 使用。
- **BYOK 加密**:AES-GCM 加密用户提供的 provider 密钥,从
  `BYOK_ENCRYPTION_KEY` 或 `JWT_SECRET` 派生密钥,以及认证 tag 验证。
  唯一允许在请求作用域之外看到 BYOK 明文密钥的文件。
- **BYOK URL 策略**:在 `services/llm` 任何 provider 请求之前应用的出站
  URL allow / deny 列表。
- **SSE 辅助**:流式分块 + keep-alive,悬停与面板 Agent 路由共享。
- **Logger**:`pino` 配置、request id 传递、开发模式 pretty-print。
- **中间件**:CORS、helmet、request id、body 限制、限流预设。
- **Clock**:可替换时间源,注入到熔断与缓存 TTL。
- **LLM 答案抽取**:悬停与面板路径用来从流式 turn 抽取最终答案的辅助。

## 布局

```
src/
  index.ts                barrel:公共导出
  auth.ts                 auth 中间件工厂
  byokCrypto.ts           AES-GCM 加 / 解密
  byokUrlPolicy.ts        出站 URL allow / deny 列表
  errors.ts               类型化错误类
  errorHandler.ts         Express 错误中间件
  hash.ts                 bcryptjs 封装
  jwt.ts                  access + refresh 辅助
  llmAnswerExtract.ts     流式 turn 答案抽取
  logger.ts               pino 配置
  params.ts               数值 / 范围校验辅助
  prefs.ts                用户偏好合并辅助
  sse.ts                  SSE 分块 + keep-alive
  validate.ts             基于 Zod 的请求校验
  attachUserRefs.ts       给响应附加用户引用的辅助
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/foundation build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/foundation typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/foundation test` | Vitest run。 |
| `pnpm --filter @grimoire/foundation lint` | oxlint。 |

## 依赖

Runtime:`@grimoire/contracts`、`bcryptjs`、`express`、`jsonwebtoken`、
`pino`、`zod`、`@prisma/client`。Dev:`vitest`、`oxlint`、`typescript`。

## 约定

- 每个导出的错误类都继承自公共基类,以便全局 `errorHandler` 无需 per-class
  `instanceof` 链即可映射。
- 凡使用墙上时钟时间的地方(熔断、缓存 TTL、JWT 过期检查),都注入
  `Clock`。模块级 `Date.now()` 在 foundation 源码中禁止。
- BYOK 加密常量(`BYOK_ENCRYPTION_KEY` 派生、IV 处理、tag 验证)位于
  `byokCrypto.ts`,**仅**在那里。
