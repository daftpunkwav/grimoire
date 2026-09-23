# 贡献指南

> 语言：**简体中文** | [English](CONTRIBUTING.md)

本指南是贡献者的引导层。每条规则都指向一个单源文档;当文字与代码冲突时,
以代码与质量门禁(`scripts/check-*.mjs`)为准。

## 环境

- Node.js ≥ 20.9(根 `package.json` 的 `engines`;`.nvmrc` 钉住精确版本),
  pnpm 11(`packageManager` 字段钉住精确发布)。
- **Windows 是参考平台。** CI 运行在 `windows-latest`,因为若干测试套
  (process-runner、沙箱、文件锁抖动)仅适用于 Win32;在其他 OS 上这些与
  安全相关的用例会被跳过。在其他平台开发对多数 package 可行,但平台门控
  的测试无法在那里运行。
- 在仓库根执行 `pnpm install`,然后配置每个 workspace 自己的 `.env`
  (绝不提交)。环境键见
  [docs/reference/configuration.md](docs/reference/configuration.md);首次
  运行指南见 [docs/guides/getting-started.md](docs/guides/getting-started.md)。

## 工作流

1. 从 `main` 拉分支,命名 `<type>/<kebab-case-description>`,如
   `feat/annotation-acl`。
2. 提交遵循 Conventional Commits:`<type>: <subject>`,type 为 `feat`、
   `fix`、`docs`、`refactor`、`chore`、`test` 或 `perf`;subject 为祈使式、
   至多 50 字符,每个 commit 一个关注点。
3. 每一行 diff 都应可追溯到其改动;不顺手重构无关代码。完整约定见
   [AGENTS.md](AGENTS.md)。

## 推送前：质量门禁

```bash
pnpm verify                                # 构建 + typecheck + coverage + boundaries + check:deps + check:exports
pnpm --filter @grimoire/web lint           # web oxlint,改动 UI 代码后运行
pnpm --filter @grimoire/web check:i18n     # web i18n 门禁,改动前端文案后运行
```

各门禁的职责与失败含义见
[docs/operations/quality-gates.md](docs/operations/quality-gates.md)。CI 在
`windows-latest` 上运行同一组门禁,外加一个 `smoke` job:启动真实的 server
二进制并做 HTTP 探测。`check:i18n` 门禁在其余内联中文文案完成 catalog 抽取
前暂只做本地门禁。

## 测试

- 从仓库根运行:`pnpm test`,或带阈值门控的 `pnpm test:coverage`。测试
  策略与预算见 [docs/operations/testing.md](docs/operations/testing.md)。
- 放置规则:单 package 的测试放该 package 自己的 `tests/`;只有真正跨
  package 的流程才放根 `tests/` journey。规则见
  [tests/README.md](tests/README.md)。
- 覆盖率阈值是门禁:覆盖率红了意味着把测试补回来,而不是调低数字。

## 文档与文案

- 行为变更同步更新文档对。`docs/` 以英文与简体中文镜像代码(地图见
  [docs/README.md](docs/README.md))。
- 代码与注释仅用英文。用户可见的 UI 文案放在
  `apps/web/src/i18n/catalogs/` —— `zh-CN` 为规范、`en` 类型被钉住,
  绝不内联 —— 由 `check:i18n` 门禁强制。

## 提交

- 每个 PR 一个关注点,门禁全绿,并在正文中描述行为差异。CI(`verify` +
  `smoke`)必须通过。
- 扩展指南在 `docs/guides/`:
  [add-a-service](docs/guides/add-a-service.md)、
  [add-a-package](docs/guides/add-a-package.md)。

## 安全

漏洞不要开公开 issue。按 [SECURITY.md](SECURITY.md) 私密报告。

## 许可证

项目基于 [MIT 许可证](LICENSE)发布;提交贡献即表示同意你的贡献同样以该
许可证授权。
