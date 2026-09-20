# tests/

> 语言：**简体中文** | [English](README.md)

Grimoire monorepo 的跨域 journey 测试。

本目录仅收纳需要**两个或更多**工作区、且仅通过它们**公共导出**组合的
测试。能被单个工作区覆盖的内容放在该工作区自己的
`packages/*/tests/`、`services/*/tests/` 或 `apps/*/tests/`。

## 放置规则

| 测试类型 | 位置 | 允许 import |
|---|---|---|
| 单包单元 / 集成 | `packages/<name>/tests/`、`services/<name>/tests/`、`apps/<name>/tests/` | 仅该包自己的 `../src/` 与公共 barrel。 |
| 跨域 journey | `tests/<journey>/` | 仅 `@grimoire/*` 公共导出。禁止跨包深路径 import。 |
| 前端应用测试 | `apps/web/tests/` | 前端源码 + `@grimoire/contracts`。 |
| API 宿主测试 | `apps/api/tests/` | API 源码 + `@grimoire/contracts`。 |

能放进单个包的 journey 测试**不属于**这里。把它移到对应的包旁边。

## 约定

- 一个测试文件 = 一个关注点。共享脚手架 > ~25 行时,放在同目录的
  `mock-deps.ts` 或 `fixtures.ts`(不要 `.test` 后缀,这样 runner 会跳过)。
- 测试从仓库根运行 `pnpm test`。完整覆盖率门禁用 `pnpm test:coverage`。
- journey 测试不得写文件系统、启动服务或打开网络端口。在 port 边界打桩;
  组合根由 `apps/api/tests/` 覆盖,不在此处。
- 测试文件遵循与生产源码相同的 `@file` / `@description` 文件头约定。
  见 [../AGENTS.md](../AGENTS.md)。
- runner 通过 [`../vitest.config.ts`](../vitest.config.ts) 解析 `@grimoire/*`
  别名。

## 发现机制

根 [`vitest.config.ts`](../vitest.config.ts) 通过以下 glob 把本目录接入
runner:

```
tests/**/*.test.ts
```

在 `tests/` 下新增一个 journey 目录即可,无需额外注册。

运维地图与覆盖率阈值见
[../docs/operations/testing.md](../docs/operations/testing.md)。
