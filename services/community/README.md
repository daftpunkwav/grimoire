# `@grimoire/community`

> Language: **English** | [简体中文](README.zh.md)

Community services: the topic forum (topics + replies).

## Responsibilities

- **Topics** (`/api/v1/topics`): reader-submitted discussions. Topics
  can attach an article via `articleLink` (optional, denormalized).
- **Topic replies** (`/api/v1/topics/:id/replies`): nested under a
  topic; one-level threading.

## Layout

```
src/
  index.ts                barrel: public exports
  serialize.ts            request / response DTO mappers
  routes/
    topics.ts             topic + reply CRUD
  services/
    articleLink.ts        helper to attach an article slug to a topic
                          without forcing a foreign-key column
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/community build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/community typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/community test` | Vitest run. |
| `pnpm --filter @grimoire/community lint` | oxlint. |

## Dependencies

Runtime: `@grimoire/contracts`, `@grimoire/foundation`, `express`, `zod`,
`@prisma/client`. Dev: `vitest`, `oxlint`, `typescript`.

## Conventions

- Topics carry an optional `articleSlug` rather than a hard foreign key,
  so a deleted article does not cascade-delete a discussion.
- Replies are one level deep. Deeper threading would require a separate
  `Reply.parentId`; do not extend the schema without an ADR.
