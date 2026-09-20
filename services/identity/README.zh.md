# `@grimoire/identity`

> 语言：**简体中文** | [English](README.md)

身份服务:认证、用户、作者申请、设置(BYOK 加密)。

## 职责

- **认证**(`/api/v1/auth/{register,login,logout,refresh,me}`):密码 + 邮箱
  注册、JWT access token 签发(默认 15 分钟)、refresh token 轮换
  (服务端存 sha256 哈希 + 吊销表)。
- **作者申请**(`/api/v1/author-applications`):读者申请,管理员审批。
  通过后授予 `author` + `authorTier`;管理员拥有 `adminLevel` 分级。
- **设置**(`/api/v1/settings`):每用户设置,包括 BYOK provider 密钥
  (经 `@grimoire/foundation/byokCrypto` 静态加密)。设置还提供一个
  test-LLM 端点,供前端在不提交新 BYOK 密钥的情况下校验其有效性。

## 布局

```
src/
  index.ts                barrel:公共导出
  repositories.ts         UserRepository + RefreshTokenStore port 实现
  serialize.ts            请求 / 响应 DTO mapper
  routes/
    auth.ts               register / login / logout / refresh / me
    applications.ts       作者申请 CRUD + 审批
    settings.ts           每用户设置(BYOK 加密)
    settingsTestLlm.ts    用真实 provider 校验 BYOK 密钥
  services/
    applicationReview.ts  申请审批 + 提权逻辑
    settingsHelpers.ts    给 routes 用的 BYOK 加 / 解密辅助
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/identity build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/identity typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/identity test` | Vitest run。 |
| `pnpm --filter @grimoire/identity lint` | oxlint。 |

## 依赖

Runtime:`@grimoire/contracts`、`@grimoire/foundation`、`express`、
`express-rate-limit`、`zod`、`@prisma/client`。Dev:`vitest`、`oxlint`、
`typescript`。

## 约定

- 密码哈希通过 `@grimoire/foundation/hash` 使用 `bcryptjs`。明文密码
  绝不离开本 service。
- refresh token 以 sha256 哈希存储;明文仅返回客户端一次,绝不持久化为
  明文。
- BYOK 密钥经 `@grimoire/foundation/byokCrypto` 静态加密,按需由
  `services/llm` 经 `LlmKeyAccess` port 解密。解密后的密钥绝不跨越
  service 源码边界。
