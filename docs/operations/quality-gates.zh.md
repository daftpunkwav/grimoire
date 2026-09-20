# 质量门禁

> 语言：**简体中文** | [English](quality-gates.md)

CI 在 `windows-latest` 上运行的七大门禁。每个门禁负责一件事;失败意味着
修代码或补测试,**不要**降低阈值。

`pnpm verify` 按顺序运行所有门禁。任一失败即非零退出。

| 门禁 | 脚本 | 负责 | 失败含义 |
|---|---|---|---|
| `pnpm -r build` | (每工作区 `tsc -p tsconfig.json`) | 每个工作区的 TypeScript 编译通过。 | 工作区偏离了声明的依赖或类型。修工作区。 |
| `pnpm -r typecheck` | (每工作区 `tsc --noEmit`) | 同上,无输出。 | 同上。 |
| `pnpm typecheck:tests` | `tsc -p tsconfig.tests.json --noEmit` | 测试基于仓库 base 通过 typecheck。 | 测试引用了 runner 无法解析的路径。 |
| `pnpm test:coverage` | `vitest run --coverage` | 单元测试通过且覆盖率阈值达标。 | 补测试,不是降低阈值(见 `vitest.config.ts`)。 |
| `pnpm boundaries` | `scripts/check-boundaries.mjs` | import 方向:无跨 service 源码 import;仅 `services/api/src/compose.ts` 可以 import 每个 service。 | 把违规 import 移到 port 后面,或移到组合根。 |
| `pnpm check:deps` | `scripts/check-package-deps.mjs` | 声明 vs 实际 import;无 value / dynamic 环;仅在测试中用的 runtime 依赖 → 降级。 | 改 `package.json` 以匹配代码实际 import 的内容。 |
| `pnpm check:exports` | `scripts/check-export-tests.mjs` | 每个可调用的公共导出都被测试引用(常量 / schemas / enums 忽略)。 | 给该导出加测试,或加入 `PENDING` 白名单(该列表只能缩减)。 |
| `pnpm --filter @grimoire/web check:i18n` | `apps/web/scripts/check-i18n.mjs` | `en` 与 `zh-CN` 的 catalog key 对等;对 `src/app`、`src/components`、`src/i18n` 做 CJK 扫描(带白名单)。 | 补缺失翻译,或移除内联字符串。 |
| `pnpm --filter @grimoire/web lint` | `apps/web` oxlint | Web 专属 lint 规则(React hooks、only-export-components)。 | 修代码。 |

## 门禁失败对照表

### `pnpm boundaries`

脚本扫描组合根之外的每个 `.ts`/`.tsx`,拒绝:

- `import '@grimoire/<其他 service>'`(跨 service 源码 import)。
- `import { prisma.<model> }`(跨域 Prisma 模型访问)。

允许的例外列在脚本头部。

**修复**:在 `@grimoire/contracts` 中引入 port,在所属 service 中实现,
在 [`services/api/src/compose.ts`](../../services/api/src/compose.ts) 中注册,让消费方
只 import port。

### `pnpm check:deps`

脚本遍历每个 `package.json` 与其 `src/` 中的 import:

- 拒绝 value / dynamic import 未声明的 `@grimoire/*`。
- 拒绝 type-only import 未声明的 `@grimoire/*`。
- 拒绝运行时从 `devDependencies` 导入 value。
- 拒绝声明却未使用的 runtime / dev 依赖。
- 拒绝 value / dynamic 依赖环(忽略 type-only 边)。
- 警告仅在测试中使用的声明 runtime 依赖 → 降级为 `devDependencies`。

**修复**:编辑 `package.json` 以匹配代码实际 import 的内容。不要静默门禁。

### `pnpm check:exports`

脚本顺着每个工作区的 `src/index.ts` re-export 链,把没有任何测试引用的
可调用公共导出(函数、类、箭头)标记出来。常量、Zod schemas、enum 值忽略。

`scripts/check-export-tests.mjs` 中维护一份 `PENDING` 白名单(无测试的
符号)。该列表在运行时**只读**;要添加符号,必须编辑该文件并在条目上方
注释里说明理由。每次发布时审查该列表;它只能缩减。

**修复**:补缺失测试。如果一个符号确实是内部的但被意外 re-export,缩小
公共表面。

### `pnpm --filter @grimoire/web check:i18n`

两步:

1. **Catalog 对等**:加载 `apps/web/src/i18n/catalogs/en` 与
   `apps/web/src/i18n/catalogs/zh-CN`,断言 `zh-CN` 中每个键在 `en` 中也存在
   (反之亦然),在 `tsc` 时也有类型级强制。
2. **CJK 扫描**:遍历 `apps/web/src/app`、`apps/web/src/components`、
   `apps/web/src/i18n`,查找 `zh-CN` catalog 之外的硬编码中文字符串。注释
   与 `console.*` 调用豁免。`apps/web/scripts/check-i18n.mjs` 中的白名单
   覆盖已知非用户可见 CJK(例如 token payload 哨兵)。

**修复**:把缺失键加入两个 catalog,或把内联字符串抽取到 `zh-CN` catalog,
通过 `useT()` 读取。

## 新增门禁

1. 在 `scripts/<name>.mjs` 下新增脚本。
2. 在 `package.json` 中加 `pnpm <name>` 别名。
3. 按依赖顺序把门禁加入 `pnpm verify` 链(boundaries → deps → exports →
   i18n → tests → typecheck → build)。
4. 在本页加一行,写明它负责什么以及失败意味着什么。
5. 在 [CONTRIBUTING.md](../../CONTRIBUTING.md) 文档化新门禁。

## CI

`.github/workflows/ci.yml` 在 `windows-latest` 上运行同一组门禁,外加一个
`smoke` job:启动 `services/api` 并用 `pnpm smoke` 探测。`smoke` job 是 CI
中唯一启动 server 进程的位置;其余流水线仅跑单元测试。
