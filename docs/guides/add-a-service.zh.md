# 新增 service

> 语言：**简体中文** | [English](add-a-service.md)

当一个新的业务域无法表达为现有 service 内部的 port + 实现对时,它就拥有
自己的工作区。本指南详述 seams、注册步骤与边界规则。

## 何时新增 service

以下条件**全部**成立时,才新增 service:

- 该能力拥有自己的 bounded context(独立的数据模型切片、独立的生命周期、
  独立的 RBAC 切片)。
- 至少有一个其他 service 需要依赖本域暴露的 port 表面,**且**该表面无法
  表达为依赖方 service 内部的 port。
- 该能力需要自己的 `routes/`、`services/`、`lib/` 布局 —— 一个文件不够。

若任一条件不成立,**不要**新增 service。在现有 service 中新增 port,或
拆分现有 service。铁律见
[architecture/decision-register.md](../architecture/decision-register.md)。

## 布局

```
services/<domain>/
  package.json             # name: @grimoire/<domain>, private: true
  tsconfig.json            # 继承仓库根 base
  README.md                # 职责、seam 表面、依赖方向
  README.zh.md             # 简体中文镜像
  src/
    index.ts               # barrel:公共导出(port 实现 + 辅助)
    repositories.ts        # 本域拥有的任何 repositories
    serialize.ts           # 请求 / 响应 DTO mapper
    routes/
      <feature>.ts         # Express 路由模块
    services/
      <use-case>.ts        # 应用层用例
    lib/
      <helpers>.ts         # 内部辅助
  tests/
    <feature>.test.ts      # 同包单元 / 集成测试
```

## 必需的 seams

新 service 必须:

1. **暴露至少一个 port**,声明于
   [`packages/contracts/src/ports.ts`](../../packages/contracts/src/ports.ts)。
2. **实现该 port** 在 `src/index.ts`(或专用模块,并从中 re-export)。
3. **注册该实现** 于
   [`services/api/src/compose.ts`](../../services/api/src/compose.ts) 对应的
   `compose()` 步骤。
4. **为每条路由与每个 port 方法至少加一个测试**。CI 门禁
   `pnpm check:exports` 强制导出覆盖;`pnpm boundaries` 强制路由只消费
   ports。

## 边界规则(强制)

- 新 service 可依赖 `@grimoire/contracts`、`@grimoire/foundation`,以及
  `@grimoire/llm`(仅用于提示词装配)。
- 新 service **不得** import 其他 service 的源码。
- 新 service 的路由 **不得** import 组合根。
- 新 service **不得** 持有 provider 凭据;通过 `LlmKeyAccess` port 读取
  解密后的密钥。

## `package.json` 契约

```json
{
  "name": "@grimoire/<domain>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint src",
    "test": "vitest run"
  }
}
```

## 组合根更新

在 `compose()` 中新增一步:

```ts
import { createFooService } from "@grimoire/<domain>";

export function compose(...): RuntimeComponents {
  // ... 既有步骤 ...
  const foo = createFooService({ logger, prisma });
  return { /* ... */, foo };
}
```

在 `app.ts`(或调用 `mountFooRoutes(app, foo)` 的文件)中挂载,然后在
`apps/api/tests/` 加一个集成测试覆盖新路由。

## PR 检查表

- [ ] `packages/contracts` 声明新 port(或扩展既有 port)。
- [ ] `services/<domain>/` 提供实现 + 测试 + READMEs。
- [ ] `services/api/src/compose.ts` 注册实现。
- [ ] `services/api/src/app.ts` 挂载路由。
- [ ] 本地 `pnpm verify` 全绿。
- [ ] 本地 `pnpm boundaries` 全绿。
- [ ] 本地 `pnpm check:exports` 全绿。
