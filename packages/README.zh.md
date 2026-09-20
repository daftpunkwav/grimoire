# packages/

> 语言：**简体中文** | [English](README.md)

本目录存放 Grimoire monorepo 的能力包。

每个 package 是 workspace 成员 `@grimoire/<name>`,包含 `src/`、`tests/`、
`README.md`、`package.json`、`tsconfig.json`。包是唯一允许发布可复用、框架
无关的积木的位置 —— 其他工作区(apps、services、packages)可依赖这些积木。

| 包 | Workspace | 角色 |
|---|---|---|
| [`contracts`](contracts/) | `@grimoire/contracts` | 零依赖叶子:共享 DTO、权限矩阵、悬停净化、LLM 类型、port 接口。其他所有 package 可依赖它,它不依赖任何业务包。 |
| [`foundation`](foundation/) | `@grimoire/foundation` | 基础设施:errors、logger、JWT、哈希、BYOK 加密、SSE 辅助、中间件。唯一允许依赖除 `apps/` 之外所有其他包的位置。 |

## 规则

- `packages/contracts` 是其他所有工作区的依赖根。任何想要共享类型或接口
  的包/服务都在那里声明。
- 只有当**至少两个消费者**需要同一能力,**且**该能力无法表达为跨服务 port
  时,才新增 package(见 [services/](services/))。完整决策标准见
  [docs/guides/add-a-package.md](../docs/guides/add-a-package.md)。
- package README 是必需的。它们说明职责、seam 表面与依赖方向。根 CI
  门禁校验每个公共导出都被测试引用(`pnpm check:exports`)。
- 任何 package 不得 import 自 `apps/`。不得 import 自另一个 service 的源
  码 —— 只能从 `services/<name>/src/index.ts` import,且仅当该 service
  的 package.json 显式声明了该依赖。

完整工作区目录见根 [README](../README.md)。
