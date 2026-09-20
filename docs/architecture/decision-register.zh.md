# 决策登记簿

> 语言：**简体中文** | [English](decision-register.md)

关键架构决策,带理由与强制机制。新决策**追加**到这里,不在原地修改。要
取代某个决策,请新增一行链接到旧的并说明变更。

| ID | 决策 | 理由 | 强制机制 |
|---|---|---|---|
| DR-001 | `packages/contracts` 是其他所有工作区的依赖根,不依赖任何业务包。 | 让公共 port 表面可发现;防止传递性依赖环。 | `pnpm boundaries`(拒绝任何非 contracts 包 import service)。 |
| DR-002 | 组合根仅位于 `apps/api/src/compose.ts`。 | port 实现的装配只有一处;其余代码可以按 port 中的数据流推理。 | 代码审查 + `pnpm boundaries`(拒绝 `compose.ts` 出现在其他文件中)。 |
| DR-003 | `services/llm` 是唯一持有 provider 凭据的工作区。 | 尊重每用户 BYOK 隔离;限定密钥爆炸半径。 | `pnpm check:deps` + CI 密钥扫描。 |
| DR-004 | hover sanitize 在 port 边界执行,绝不放在提示词模板内。 | 受信任边界可审计;放在模板内随提示词修改容易回退。 | `packages/contracts/src/hoverSanitize.test.ts` 钉住拒绝模式。 |
| DR-005 | 前端仅依赖 `@grimoire/contracts` 与 `@grimoire/foundation`;所有服务端流量走 API client。 | 让前端构建更快,并让契约表面显式。 | `pnpm boundaries` + 前端 import 白名单。 |
| DR-006 | BYOK R-04(BYOK 失败回落服务端 provider)**默认关闭**。 | 保持每用户配额隔离诚实;开启是显式的、有文档的 opt-in。 | `services/llm/src/resilience.ts` + 测试。 |
| DR-007 | refresh token 以 sha256 哈希存储;明文仅返回一次,绝不持久化。 | 让服务端吊销无需保留明文;保护 DB 单点泄漏。 | `services/identity/src/services/auth.ts` + 测试。 |
| DR-008 | 文章写操作对可空外键使用 `UncheckedUpdateInput`;`ArticleRepository` 是唯一与 Prisma 模型对话的文件。 | 让 port 表面端到端有类型,防止路由意外直接访问模型。 | `pnpm boundaries` + 测试。 |
| DR-009 | 批注可见性始终经过 `AnnotationAcl`;绕过是门禁失败。 | 不论走哪个路由,guest 都只能看到 `approved` 批注。 | `pnpm boundaries` + 每路由测试审查。 |
| DR-010 | 阅读跟踪通过 `viewTracking` 按 `(userId \| guestKey、articleId、day)` 去重。 | 让 `LearningProgress` 计数诚实。 | `services/content/src/services/viewTracking.test.ts`。 |
| DR-011 | 熔断通过注入持有时间源(`Clock`)。 | 测试可以快进而无需 sleep。 | `packages/foundation/src/clock.ts` + 每熔断测试。 |
| DR-012 | 所有用户可见 UI 文案位于 `apps/web/src/i18n/catalogs/{en,zh-CN}/`;内联字符串是门禁失败。 | 让 locale 边界可审计;支持 catalog 级覆盖。 | `pnpm --filter @grimoire/web check:i18n`。 |
| DR-013 | 双 Agent 表面(hover / panel)共用 `streamConsumers.ts` 与 `agentSseHelpers.ts`;SSE 事件形态不得分裂。 | 前端 Agent 面板与悬停气泡消费同一形态;分裂会同时破坏两者。 | `services/agent/src/lib/streamConsumers.test.ts`。 |
| DR-014 | 动画创作表面是模板 + 步骤参数化,绝非自由画布。 | 有边界的创作表面让审核与无障碍更可控。 | `apps/web/src/components/anim/registry.ts` + 动画测试。 |
| DR-015 | `docker-compose.yml` 默认把两个端口都保留在回环;生产部署必须移除 host 映射。 | 减小公网暴露面;反向代理 + TLS 是推荐路径。 | `docs/operations/deployment.md` + 部署审查。 |
| DR-016 | 测试文件遵循与生产源码相同的 `@file` / `@description` JSDoc 文件头约定。 | 测试文件是代码库的一部分;其契约值得同等文档化。 | 代码审查。 |
| DR-017 | 质量门禁在 CI 的 `windows-latest` 上运行。若干套件(process-runner、沙箱、文件锁抖动)仅适用于 Win32。 | 避免平台门控测试的抖动;`CONTRIBUTING.md` 中已说明。 | `.github/workflows/ci.yml`。 |
| DR-018 | 覆盖率阈值是 CI 门禁;红了意味着补测试,而不是调低数字。 | 防止测试质量逐渐被侵蚀。 | `vitest.config.ts` 阈值 + `pnpm test:coverage`。 |

## 已取代的决策

| ID | 被谁取代 | 原因 |
|---|---|---|
| (暂无) | | |

## 新增决策

1. 在主表追加一行。使用下一个空闲的 `DR-NNN` ID。
2. 填入理由与强制机制;强制机制字段必须指明门禁(或「代码审查」)如何
   保证决策被遵守。
3. 若新决策取代旧的,在「已取代的决策」表中追加一行,写明旧 ID 与新 ID。
4. 开一个标题为 `docs: register DR-NNN <short title>` 的 PR,带上能证明
   决策可强制执行的代码改动。
