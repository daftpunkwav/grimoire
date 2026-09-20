# `apps/web/src/i18n/`

> 语言：**简体中文** | [English](README.md)

Grimoire 前端的国际化层。

## 布局

```
i18n/
├── README.md / README.zh.md            # 本文件
├── locale.ts                           # AppLocale、SUPPORTED_LOCALES、normalizeLocale
├── catalogs/
│   ├── types.ts                        # MessageCatalog 类型、resolveMessage()
│   ├── index.ts                        # CATALOGS = { "zh-CN": zhCN, en }
│   ├── zh-CN/                          # 键的源真值(20 个 namespace)
│   │   ├── admin-applications.ts
│   │   ├── admin-domains.ts
│   │   ├── agent-cache.ts
│   │   ├── agent-hover.ts
│   │   ├── agent-panel.ts
│   │   ├── animation.ts
│   │   ├── api-errors.ts
│   │   ├── article.ts
│   │   ├── auth.ts
│   │   ├── author-editor.ts
│   │   ├── brand.ts
│   │   ├── common.ts
│   │   ├── home.ts
│   │   ├── index.ts
│   │   ├── knowledge.ts
│   │   ├── news.ts
│   │   ├── profile.ts
│   │   ├── search.ts
│   │   ├── settings.ts
│   │   ├── shell.ts
│   │   └── topic.ts
│   └── en/                             # 镜像;类型被钉到 MessageCatalog
│       └── (同样文件布局)
├── useT.ts                             # useLocale / useSetLocale / useT / useCatalog
└── (LiveI18nProvider 从 useT.ts 导出)
```

## 源真值

`zh-CN` 是键的源真值。新键先加入 `zh-CN/`,再加入 `en/`。`en` 的 barrel
将其合并导出注释为 `MessageCatalog`,所以某个 locale 加了新键而另一个
没有时,`pnpm typecheck` 失败。

## 约定

- 键使用点号分隔(`shell.nav.home`、`auth.applyAuthor.title`)。
- 插值使用 `{name}` 占位符。不使用 ICU / 复数形式;复数场景拆分为多个键。
- 缺失键在开发环境渲染 `⟦key⟧`(伴随 `console.warn`),在生产环境渲染
  原 key。绝不静默产生空字符串。
- 用户可见 UI 文案**只**能放在 `catalogs/{zh-CN,en}/` 下。组件内联字符串
  被禁止,由 `pnpm --filter @grimoire/web check:i18n` 捕获。

## 新增语言

1. 在 `locale.ts` 的 `SUPPORTED_LOCALES` 加入新 locale,在 `ENDONYMS`
   加入条目,(可选)在 `ALIASES` 加入别名。
2. 在 `catalogs/<新 locale>/<namespace>.ts` 镜像每个 namespace 文件,并
   在 `catalogs/<新 locale>/index.ts` 重新导出。
3. 在 `catalogs/index.ts` 的 `CATALOGS` 注册新 locale。

## 新增 namespace

1. 新增 `catalogs/zh-CN/<namespace>.ts` 导出 namespace 对象。
2. 在 `catalogs/en/<namespace>.ts` 增加镜像(类型被钉到
   `MessageCatalog[<namespace>]` 以强制对等)。
3. 从两个 `index.ts` barrel 重新导出。
4. 在组件中使用 `const t = useT()`,然后 `t('<namespace>.<key>')`。
