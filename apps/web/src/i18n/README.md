# `apps/web/src/i18n/`

> Language: **English** | [简体中文](README.zh.md)

The Grimoire web app's internationalization layer.

## Layout

```
i18n/
├── README.md / README.zh.md            # this file
├── locale.ts                           # AppLocale, SUPPORTED_LOCALES, normalizeLocale
├── catalogs/
│   ├── types.ts                        # MessageCatalog type, resolveMessage()
│   ├── index.ts                        # CATALOGS = { "zh-CN": zhCN, en }
│   ├── zh-CN/                          # source-of-truth for keys (13 namespaces)
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
│   └── en/                             # mirror; type-pinned to MessageCatalog
│       └── (same file layout)
├── useT.ts                             # useLocale / useSetLocale / useT / useCatalog
└── (LiveI18nProvider is exported from useT.ts)
```

## Source of truth

`zh-CN` is the source of truth for keys. New keys land in `zh-CN/` first,
then in `en/`. The `en` barrel annotates its merged export as
`MessageCatalog`, so `pnpm typecheck` fails if a key is added to one locale
and not the other.

## Conventions

- Keys are dot-separated (`shell.nav.home`, `auth.applyAuthor.title`).
- Interpolation uses `{name}` placeholders. No ICU / plurals; split keys
  for plurals instead.
- Missing keys render `⟦key⟧` in dev (with a `console.warn`) and the raw
  key in production. Empty strings are never silently produced.
- User-visible UI copy lives **only** under `catalogs/{zh-CN,en}/`. Inline
  strings in components are forbidden and caught by
  `pnpm --filter @grimoire/web check:i18n`.

## Adding a language

1. Add the locale to `SUPPORTED_LOCALES` in `locale.ts`, plus an entry in
   `ENDONYMS` and (optionally) `ALIASES`.
2. Mirror every namespace file under `catalogs/<new-locale>/<namespace>.ts`,
   re-exporting from `catalogs/<new-locale>/index.ts`.
3. Register the new locale in `CATALOGS` in `catalogs/index.ts`.

## Adding a namespace

1. Add `catalogs/zh-CN/<namespace>.ts` exporting the namespace object.
2. Add the mirror in `catalogs/en/<namespace>.ts` (type-pinned to
   `MessageCatalog[<namespace>]` for parity enforcement).
3. Re-export both from their `index.ts` barrels.
4. Use `const t = useT()` inside a component, then `t('<namespace>.<key>')`.
