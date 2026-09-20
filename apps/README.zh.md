# apps/

> 语言：**简体中文** | [English](README.md)

本目录存放 Grimoire monorepo 中可运行的应用。

应用不是能力叶子 —— 它们消费 `@grimoire/*` 包,而自身不被消费。组合根仅位于
`apps/api/`;前端位于 `apps/web/`,仅依赖 `@grimoire/contracts` 与
`@grimoire/foundation`。

| 应用 | Workspace | 角色 |
|---|---|---|
| [`api`](api/) | `@grimoire/api` | Express 5 组合根 + Swagger UI + Docker 镜像。唯一构造 port 实现并装配服务的位置。 |
| [`web`](web/) | `@grimoire/web` | Vite 8 + React 19 + React Router 7 SPA。拥有 i18n provider 与开发服务器。 |

## 规则

- `apps/api/` 是组合根。所有跨服务装配集中在 `services/api/src/compose.ts`。
  其他服务文件只能从 `@grimoire/contracts`(port 接口)导入,绝不从另一个
  服务的源码导入。
- `apps/web/` 仅依赖 `@grimoire/contracts` 与 `@grimoire/foundation`。
  其他服务端流量由前端 API client 转发。
- 仅当新增一个真正可运行的进程(server、CLI、worker)时才在这里新增应用。
  内部能力包放在 [`packages/`](../packages/) 或 [`services/`](../services/)。

完整工作区目录见根 [README](../README.md),组合根契约见
[docs/architecture/composition-root.md](../docs/architecture/composition-root.md)。
