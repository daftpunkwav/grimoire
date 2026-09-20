# 测试

> 语言：**简体中文** | [English](testing.md)

测试布局的运维地图。真相源位于 [`../../tests/README.md`](../../tests/README.md);
本页是部署视角(`vitest` 如何找到测试、超时如何调优、覆盖率阈值如何
强制)。

## 测试层级

| 层级 | 位置 | 允许 import | 所属 |
|---|---|---|---|
| 单元 / 集成 | `packages/<name>/tests/`、`services/<name>/tests/`、`apps/<name>/tests/` | 该工作区自己的 `../src/` 与公共 barrel。 | 每个工作区。 |
| 跨域 journey | `tests/<journey>/` | 仅 `@grimoire/*` 公共导出。 | 根 `tests/`。 |
| 应用级 | `apps/api/tests/`、`apps/web/tests/` | 应用自己的源码 + `@grimoire/contracts`(仅 web)。 | 每个应用。 |
| Smoke(上线后) | `scripts/smoke.mjs` | 仅 HTTP;无进程内状态。 | CI。 |

## Runner 配置

[`../../vitest.config.ts`](../../vitest.config.ts) 在仓库根装配一切:

- **别名**:`@grimoire/contracts`、`@grimoire/foundation`、
  `@grimoire/llm`、`@grimoire/identity`、`@grimoire/content`、
  `@grimoire/community`、`@grimoire/agent`、`@grimoire/api`、
  `@grimoire/web`。
- **Include glob**:
  - `tests/**/*.test.ts`
  - `packages/*/tests/**/*.test.ts`
  - `services/*/tests/**/*.test.ts`
  - `apps/*/tests/**/*.test.{ts,tsx}`
- **`testTimeout`**:`30_000` ms。
- **`retry`**:`1`(Windows 上 PowerShell 冷启动 + 文件锁释放抖动)。
- **Coverage provider**:`v8`,scope 与 runner 同源 glob,排除 `**/*.test.*`、
  `**/*.d.ts`、`**/index.ts`(barrel)、`**/types.ts`、`**/tests/**`、
  `**/dist/**`。

## 覆盖率阈值

在 [`../../vitest.config.ts`](../../vitest.config.ts) 的
`coverage.thresholds` 块中设置。红了意味着补测试,**不要**调低数字。
调低阈值需 ADR 条目。

| 指标 | 阈值 |
|---|---|
| Statements | 70 |
| Branches | 60 |
| Functions | 70 |
| Lines | 70 |

代码库年轻时这些数字故意宽松;方向是**向上**。每个门禁失败的修复都应该
伴随提升门槛的新测试。

## 测试类型规则

- **一个测试文件 = 一个关注点。** 共享脚手架 > ~25 行时,放在同目录的
  `mock-deps.ts` / `fixtures.ts`(不要 `.test` 后缀,这样 runner 会跳过)。
- **Journey 测试不得写文件系统、启动服务或打开网络端口。** 在 port 边界
  打桩;组合根由 `apps/api/tests/` 覆盖,不在此处。
- **测试文件遵循与生产源码相同的 `@file` / `@description` JSDoc 文件头
  约定。** 见 [`../../AGENTS.md`](../../AGENTS.md)。

## 本地命令

```bash
pnpm test                  # vitest run(无覆盖率)
pnpm test:coverage         # vitest run --coverage(CI 阈值)
pnpm --filter @grimoire/web test     # 单工作区
pnpm --filter @grimoire/api test     # 单工作区
```

调试单个测试:

```bash
pnpm test -- -t "should reject malformed payload"
```

(替换为实际的测试名。)

## CI

`pnpm verify` 跑完整链。CI 工作流 `.github/workflows/ci.yml` 在
`windows-latest` 上跑同一链,外加 `smoke` job。`smoke` job 是 CI 中唯一
启动 server 进程的位置;其余流水线仅跑单元测试。

覆盖率即使失败也总是作为 `cov-report/` 上传,让 artifact 可被审查。

## 新增 journey 测试

1. 创建 `tests/<journey>/<area>.test.ts`。
2. 仅从 `@grimoire/*` 公共 barrel import。禁止深路径 import。
3. 在 port 边界 stub 运行时;不要启动 server。
4. 仅当与现有 `tests/**/*.test.ts` 不匹配时,才把该 journey 加入
   `vitest.config.ts` 的 discovery glob(应该匹配)。
5. 在 `tests/README.md` 中添加一行摘要。
