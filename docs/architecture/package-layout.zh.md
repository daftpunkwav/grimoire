# Package 布局

> 语言：**简体中文** | [English](package-layout.md)

Grimoire 是 pnpm-workspace monorepo,三个 workspace 族,每个工作区形态统一。

## Workspace 族

| 族 | 路径 | Workspace 名 | 角色 |
|---|---|---|---|
| App | `apps/<name>/` | `@grimoire/<name>` | 可运行进程(组合根、SPA)。 |
| Package | `packages/<name>/` | `@grimoire/<name>` | 框架无关的能力积木。 |
| Service | `services/<domain>/` | `@grimoire/<domain>` | 一个业务域对应一个 bounded context。 |

`pnpm-workspace.yaml` 声明三个 glob:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

Workspace 是任何目录,只要它带 `package.json`(`name` 字段为
`@grimoire/<name>`),且被任一 glob 命中。

## 每个工作区的形态

每个工作区都包含:

```
<workspace>/
  package.json             # name、private、exports、files、scripts、deps
  tsconfig.json            # 继承仓库根 base(或 web / node 预设)
  README.md                # 职责、seam 表面、依赖方向
  README.zh.md             # 简体中文镜像
  src/                     # 源码
  tests/                   # 该工作区自己的测试
```

组合根(`apps/api/`)额外包含:

```
apps/api/
  Dockerfile               # 生产镜像来源
  prisma/
    schema.prisma
    seed.ts
    seed-content.ts
  scripts/                 # 一次性脚本(例如悬停抽取调优)
```

## 依赖方向

```
apps/api          ──▶  每个 service、packages/foundation、packages/contracts
apps/web          ──▶  packages/contracts、packages/foundation
services/<x>      ──▶  packages/contracts、packages/foundation、services/llm(仅提示词)
packages/foundation ─▶  packages/contracts、bcryptjs、express、jsonwebtoken、pino、zod、@prisma/client
packages/contracts  ─▶  (本仓库无)
```

由 `scripts/check-boundaries.mjs` 强制,通过 `pnpm boundaries` 暴露。
跨 service 源码 import 会被拒绝。

## 名字解析

根 [`vitest.config.ts`](../../vitest.config.ts) 把 `@grimoire/*` 映射到各
工作区的 `src/index.ts`,供测试使用。生产构建通过 pnpm 的 `workspace:*`
协议解析 workspace 名,具体见每个工作区 `package.json` 的声明。

TypeScript 路径别名位于 [`tsconfig.tests.json`](../../tsconfig.tests.json),
与 vitest 别名一一对应。生产构建使用 Node 模块解析与 pnpm 的 symlink
workspace 包。

## 新增工作区

见 [`../guides/add-a-package.md`](../guides/add-a-package.md) 与
[`../guides/add-a-service.md`](../guides/add-a-service.md)。两份指南都
详述 README 契约、导出契约与边界规则。
