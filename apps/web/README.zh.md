# `@grimoire/web`

> 语言：**简体中文** | [English](README.md)

Grimoire 前端:Vite 8 + React 19 + React Router 7 SPA。唯一从 i18n catalog
加载用户可见文案的可运行应用。

## 职责

- 读者端(首页、知识、LLM、领域、资讯、话题、搜索)。
- 作者端(工作台、Markdown 编辑器、动画编辑器、作者申请审批)。
- 管理端(领域管理)。
- 站内 Agent(悬停快讲 + 面板 ReAct)。
- i18n provider:locale bootstrap、catalog 加载、`<html lang>` 同步、
  cookie / localStorage 持久化。

前端仅依赖 `@grimoire/contracts` 与 `@grimoire/foundation`;其他全部经
API client 转发。

## 布局

```
src/
  app/                  路由、懒加载路由表、品牌
  pages/                路由页面:读者、作者、管理
  components/
    agent/              AgentFloat、AgentPanel、HoverTipBubble、hooks
    anim/               动画引擎 + VisualKind × 模板注册表
    article/            ArticleLayout、ArticleBody、TableOfContents
    domain/             DomainSection
    home/               HomeHeroAnim、HomeFeedColumn、homeDomains
    layout/             AppShell、ErrorBoundary
    ui/                 Button、Input、Tag
  hooks/                useAuth、useTheme、useAnimationPlayer、
                        useAgentPanel、useAgentStyle
  lib/                  api client + 域 client、agentStream、
                        hoverExplainCache(L1)、markdown、settingsCache
  i18n/                 catalogs/{en,zh-CN}、adapters、useT、
                        I18nProvider、content/{guide,learn}
  styles/               tokens.css、global.css
  assets/               静态图片
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/web dev` | Vite 开发服务器,8180 strict port,`/api` 代理到 8181。 |
| `pnpm --filter @grimoire/web build` | `tsc -b` + `vite build`。 |
| `pnpm --filter @grimoire/web typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/web lint` | oxlint。 |
| `pnpm --filter @grimoire/web check:i18n` | catalog key 对等 + 对 `src/app`、`src/components`、`src/i18n` 做 CJK 扫描。 |
| `pnpm --filter @grimoire/web test` | 同包组件 / hook 测试的 Vitest run。 |

## 依赖

Runtime:`react`、`react-dom`、`react-router-dom`、`marked`、`dompurify`、
`@grimoire/contracts`。Dev:`vite`、`@vitejs/plugin-react`、`vitest`、
`oxlint`、`typescript`。

## 约定

- 所有用户可见文案位于 `src/i18n/catalogs/{en,zh-CN}/`。组件内联字符串
  被禁止,由 `pnpm --filter @grimoire/web check:i18n` 捕获。
- 组件文件以 `@file` / `@description` JSDoc 文件头开头。源码文件头
  约定见 [`../../AGENTS.md`](../../AGENTS.md)。
- 前端信任 API 做所有授权决策,绝不重新实现 ACL。
