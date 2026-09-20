# scripts/

> 语言：**简体中文** | [English](README.md)

仓库根级脚本:质量门禁、开发启动器与上线后的 smoke 探测。每个脚本都是纯
Node(`*.mjs`),无构建步骤,因此可直接 `node` 调用,或通过对应的 `pnpm` 别名
调用。

## 清单

| 脚本 | pnpm 别名 | 用途 |
|---|---|---|
| `dev.mjs` | `pnpm dev` | 组合开发启动器:预检端口 8180 / 8181,然后拉起 `@grimoire/api` + `@grimoire/web` 并转发环境变量;SIGTERM / SIGINT 优雅关闭,10 秒后强制 kill。 |
| `smoke.mjs` | `pnpm smoke` | 上线后探测:对运行中的 server 做只读 HTTP 探测(health / readiness / sessions / agent meta)。有界超时;不写。CI 在 `smoke` job 中、`apps/api` 启动后调用。 |
| `check-boundaries.mjs` | `pnpm boundaries` | import 方向门禁:在 `services/api` 之外拒绝 `import '@grimoire/<其他 service>'`,并拒绝跨域 Prisma 模型访问。`check-package-deps` 的搭档。 |
| `check-package-deps.mjs` | `pnpm check:deps` | 依赖诚实门禁:拒绝 value / dynamic import 未声明的 `@grimoire/*`;拒绝 type-only import 未声明的工作区依赖;拒绝声明却未使用的 runtime 依赖;拒绝 value / dynamic 依赖环;对仅在测试中使用的 runtime 依赖发警告(降级为 `devDependencies`)。 |
| `check-export-tests.mjs` | `pnpm check:exports` | 导出覆盖门禁:每个可调用的公共导出都必须被测试文件引用。常量 / schemas / enums 忽略。维护一份 `PENDING` 白名单(无测试的符号);该列表只能缩减。 |
| `check-i18n.mjs` | `pnpm --filter @grimoire/web check:i18n` | apps/web i18n 门禁:`en` 与 `zh-CN` 的 catalog key 对等,并对 `src/app`、`src/components`、`src/i18n` 做 CJK 扫描,确保用户可见文案绝不绕过 catalog。 |

## 约定

- 脚本位于本目录,无外部构建步骤。可通过 `node scripts/<name>.mjs` 直接
  调用,或通过根 `package.json` 声明的对应 `pnpm` 别名。
- 当 `process.exitCode` 在失败时非零时,该脚本是**门禁**;所有门禁在 CI 上
  于 `windows-latest` 运行。
- 新增脚本必须包含与源码相同的 JSDoc `@file` / `@description` 文件头。
  见 [../AGENTS.md](../AGENTS.md)。

完整门禁目录与失败语义见
[../docs/operations/quality-gates.md](../docs/operations/quality-gates.md)。
