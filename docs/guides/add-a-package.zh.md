# 新增 package

> 语言：**简体中文** | [English](add-a-package.md)

当一个能力被两个或更多 service 复用,**且**无法表达为现有 service 内部
的 port 时,它就拥有自己的 package。本指南详述 package 形态、注册步骤与
边界规则。

## 何时新增 package

以下条件**同时**成立时,才新增 package:

- 至少两个消费者(service 或其他 package)需要同一能力。
- 该能力无法表达为跨服务 port 表面(见 [add-a-service.md](./add-a-service.md))。

若该能力只被一个消费者使用,**不要**新增 package。把它放进消费者内部。

若该能力是真正的跨服务但表面是 port,**不要**新增 package。在
`@grimoire/contracts` 中声明 port。

## 布局

```
packages/<name>/
  package.json             # name: @grimoire/<name>, private: true
  tsconfig.json            # 继承仓库根 base
  README.md                # 职责、seam 表面、依赖方向
  README.zh.md             # 简体中文镜像
  src/
    index.ts               # barrel:公共导出
    <module>.ts            # 每个内聚能力一个文件
  tests/
    <module>.test.ts       # 同包单元测试
```

## `package.json` 契约

与 service 形态相同(见 [add-a-service.md](./add-a-service.md))。区别:

- `name` 遵循 `@grimoire/<name>`(单数、小写、允许 kebab-case)。
- `dependencies` 仅限:
  - `@grimoire/contracts`(始终允许)。
  - `bcryptjs`、`express`、`jsonwebtoken`、`pino`、`zod`、
    `@prisma/client`(仅 `packages/foundation`;其他包不得依赖这些)。
  - 仅当 package 真正需要时才引入第一方 LLM / auth 库。

CI 门禁 `pnpm check:deps` 强制声明 vs 实际 import 的诚实性,并拒绝
value / dynamic 依赖环。

## 边界规则(强制)

- package 不得 import 自 `apps/`。
- package 不得 import 自另一个 service 的源码 —— 只能从该 service 的
  `src/index.ts` import,且仅当该 package 的 `package.json` 声明了该
  依赖。
- `packages/contracts` 不依赖本仓库的任何东西。任何 import service 的
  package 都会被 `pnpm boundaries` 拒绝。

## 新增 port 表面

若新 package 暴露新的 port 接口,在 `packages/contracts/src/ports.ts`
中声明(不要在新 package 自身中定义)。实现位于新 package;接口位于
contracts。

## PR 检查表

- [ ] `packages/<name>/` 提供实现 + 测试 + READMEs。
- [ ] `packages/<name>/package.json` 声明它 import 的每个依赖。
- [ ] 每个消费者的 `package.json` 在 `dependencies`(或仅类型使用时为
      `devDependencies`)下声明 `@grimoire/<name>`。
- [ ] 本地 `pnpm verify` 全绿。
- [ ] 本地 `pnpm boundaries` 全绿。
- [ ] 本地 `pnpm check:deps` 全绿。
- [ ] 本地 `pnpm check:exports` 全绿。
