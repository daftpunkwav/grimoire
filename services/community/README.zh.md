# `@grimoire/community`

> 语言：**简体中文** | [English](README.md)

社区服务:话题论坛(话题 + 回复)。

## 职责

- **话题**(`/api/v1/topics`):读者提交的讨论。可选地通过 `articleLink`
  关联一篇文章(反规范化)。
- **话题回复**(`/api/v1/topics/:id/replies`):挂在话题下;单层回复。

## 布局

```
src/
  index.ts                barrel:公共导出
  serialize.ts            请求 / 响应 DTO mapper
  routes/
    topics.ts             topic + reply CRUD
  services/
    articleLink.ts        把 article slug 附加到 topic 的辅助
                          (不强制外键列)
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/community build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/community typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/community test` | Vitest run。 |
| `pnpm --filter @grimoire/community lint` | oxlint。 |

## 依赖

Runtime:`@grimoire/contracts`、`@grimoire/foundation`、`express`、`zod`、
`@prisma/client`。Dev:`vitest`、`oxlint`、`typescript`。

## 约定

- topic 携带可选 `articleSlug` 而不是硬外键,这样删除文章不会级联删除
  讨论。
- 回复单层。更深的嵌套需要单独的 `Reply.parentId`;不在 ADR 之前扩展
  schema。
