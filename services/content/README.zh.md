# `@grimoire/content`

> 语言：**简体中文** | [English](README.md)

内容服务:文章、动画、领域、批注。

## 职责

- **领域**(`/api/v1/domains`):文章归属的顶层分类。仅管理员可创建 / 编辑。
- **文章**(`/api/v1/articles`):规范的 Markdown 正文加元数据(作者、领域、
  状态)。作者编辑,读者查看。
- **动画**(`/api/v1/animations`):VisualKind × 模板映射;步骤参数化创作
  (非自由画布)。通过 `ArticleAnimation` 关联表链接到文章。
- **批注**(`/api/v1/annotations`):读者对文章的提交。`AnnotationAcl`
  控制可见性:`guest → 仅 approved`;`reader → 自己 + approved`;
  `author / admin → 全部`。审批经 `annotationReview`。

## 布局

```
src/
  index.ts                barrel:公共导出
  repositories.ts         ArticleRepository port 实现
  domain/
    slug.ts               slug 规范化 + 唯一性辅助
  routes/
    articles.ts           article CRUD
    animations.ts         animation CRUD
    domains.ts            domain CRUD(仅管理员可写)
    annotations.ts        annotation CRUD
  services/
    articleRepository.ts  ArticleRepository port 实现(类型化输入,
                          可空外键用 UncheckedUpdateInput)
    annotationAcl.ts      可见性 / 审核门禁
    annotationReview.ts   审批 + 状态转换
    viewTracking.ts       每用户 / 每天阅读去重
    serialize.ts          响应 DTO mapper
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/content build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/content typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/content test` | Vitest run。 |
| `pnpm --filter @grimoire/content lint` | oxlint。 |

## 依赖

Runtime:`@grimoire/contracts`、`@grimoire/foundation`、`express`、`zod`、
`@prisma/client`。Dev:`vitest`、`oxlint`、`typescript`。

## 约定

- 对 `Article` 的写操作对可空外键使用 `UncheckedUpdateInput`;
  `ArticleRepository` 是唯一与 Prisma 模型对话的文件。路由只看到 port
  方法。
- 批注可见性**始终**经过 `AnnotationAcl` 才到达路由。绕过 ACL 是门禁失败
  (由 `pnpm boundaries` + 审查捕获)。
- 阅读跟踪通过 `viewTracking` 按 `(userId | guestKey, articleId, day)`
  去重,保持 `LearningProgress` 计数诚实。
