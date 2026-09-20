# `@grimoire/web`

> Language: **English** | [简体中文](README.zh.md)

Grimoire front-end: Vite 8 + React 19 + React Router 7 SPA. The only
runnable application that loads user-visible copy from i18n catalogs.

## Responsibilities

- Reader surface (home, knowledge, LLM, domains, news, topics, search).
- Author surface (dashboard, Markdown editor, animation editor,
  applications admin).
- Admin surface (domain management).
- In-product Agent (hover quick-explain + panel ReAct).
- i18n provider: locale bootstrap, catalog hydration, `<html lang>`
  sync, persistence to cookie / localStorage.

The web app depends only on `@grimoire/contracts` and
`@grimoire/foundation`; everything else goes through the API client.

## Layout

```
src/
  app/                  router, lazy route map, brand
  pages/                route pages: reader, author, admin
  components/
    agent/              AgentFloat, AgentPanel, HoverTipBubble, hooks
    anim/               animation engine + VisualKind × template registry
    article/            ArticleLayout, ArticleBody, TableOfContents
    domain/             DomainSection
    home/               HomeHeroAnim, HomeFeedColumn, homeDomains
    layout/             AppShell, ErrorBoundary
    ui/                 Button, Input, Tag
  hooks/                useAuth, useTheme, useAnimationPlayer,
                        useAgentPanel, useAgentStyle
  lib/                  api client + domain clients, agentStream,
                        hoverExplainCache (L1), markdown, settingsCache
  i18n/                 catalogs/{en,zh-CN}, adapters, useT,
                        I18nProvider, content/{guide,learn}
  styles/               tokens.css, global.css
  assets/               static images
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/web dev` | Vite dev server on 8180 with strict port and `/api` proxy to 8181. |
| `pnpm --filter @grimoire/web build` | `tsc -b` + `vite build`. |
| `pnpm --filter @grimoire/web typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/web lint` | oxlint. |
| `pnpm --filter @grimoire/web check:i18n` | Catalog key parity + CJK sweep over `src/app`, `src/components`, `src/i18n`. |
| `pnpm --filter @grimoire/web test` | Vitest run for co-located component / hook tests. |

## Dependencies

Runtime: `react`, `react-dom`, `react-router-dom`, `marked`, `dompurify`,
`@grimoire/contracts`. Dev: `vite`, `@vitejs/plugin-react`, `vitest`,
`oxlint`, `typescript`.

## Conventions

- All user-visible copy lives under `src/i18n/catalogs/{en,zh-CN}/`.
  Inline strings inside components are forbidden and caught by
  `pnpm --filter @grimoire/web check:i18n`.
- Component files open with a `@file` / `@description` JSDoc block. See
  the source-file convention in [`../../AGENTS.md`](../../AGENTS.md).
- The web app trusts the API for every authorization decision. It never
  re-implements ACL.
