# `@grimoire/content`

> Language: **English** | [简体中文](README.zh.md)

Content services: articles, animations, domains, and annotations.

## Responsibilities

- **Domains** (`/api/v1/domains`): top-level taxonomy that articles
  belong to. Admin-only creation / editing.
- **Articles** (`/api/v1/articles`): the canonical Markdown body plus
  metadata (author, domain, status). Authors edit; readers view.
- **Animations** (`/api/v1/animations`): VisualKind × template mapping;
  step-parametric authoring (no free canvas). Linked to articles via
  `ArticleAnimation` join rows.
- **Annotations** (`/api/v1/annotations`): reader-submitted notes on
  articles. Visibility is gated by `AnnotationAcl`:
  `guest → approved only`; `reader → own + approved`; `author / admin →
  all`. Reviews happen via `annotationReview`.

## Layout

```
src/
  index.ts                barrel: public exports
  repositories.ts         ArticleRepository port implementation
  domain/
    slug.ts               slug normalization + uniqueness helper
  routes/
    articles.ts           article CRUD
    animations.ts         animation CRUD
    domains.ts            domain CRUD (admin-only mutations)
    annotations.ts        annotation CRUD
  services/
    articleRepository.ts  ArticleRepository port impl (typed input,
                          UncheckedUpdateInput for nullable foreign keys)
    annotationAcl.ts      visibility / moderation gating
    annotationReview.ts   review + status transitions
    viewTracking.ts       per-user / per-day view dedupe
    serialize.ts          response DTO mappers
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/content build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/content typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/content test` | Vitest run. |
| `pnpm --filter @grimoire/content lint` | oxlint. |

## Dependencies

Runtime: `@grimoire/contracts`, `@grimoire/foundation`, `express`, `zod`,
`@prisma/client`. Dev: `vitest`, `oxlint`, `typescript`.

## Conventions

- Mutations to `Article` use `UncheckedUpdateInput` for nullable foreign
  keys; `ArticleRepository` is the only file that talks to the Prisma
  model. Routes only see port methods.
- Annotation visibility **always** runs through `AnnotationAcl` before
  reaching the route. Bypassing the ACL is a gate failure (caught by
  `pnpm boundaries` + test review).
- View tracking deduplicates per `(userId | guestKey, articleId, day)`
  via `viewTracking` to keep the `LearningProgress` counter honest.
