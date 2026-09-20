# `@grimoire/llm`

> 语言：**简体中文** | [English](README.md)

LLM 网关:providers、adapters、熔断、BYOK 解密。**唯一**持有 provider 凭据
的工作区。

## 职责

- **Provider 调用**(`LlmProvider` port):根据配置的 `LLM_PROVIDER_ID` 与每
  密钥的 `API_FORMAT`,分发到三个 adapter 之一 —— `anthropicMessages`、
  `openaiChat`、`openaiResponses`。
- **BYOK 解密**(`LlmKeyAccess` port):解密每用户 BYOK blob(由
  `services/identity` 写入),仅在一次出站请求期间暴露。绝不记录、缓存或
  把解密后的密钥返回给调用方。
- **韧性**(`resilience.ts`):每 provider 的进程内熔断
  (`LLM_CIRCUIT_FAILURES`、`LLM_CIRCUIT_OPEN_MS`)、每 provider 并发上限
  (`LLM_MAX_CONCURRENT`、`LLM_QUEUE_WAIT_MS`),以及对出站 URL 应用的
  deny-list 策略(来自 `@grimoire/foundation` 的 `byokUrlPolicy`)。
- **Adapter 目录**:每个 adapter 是 `src/adapters/` 下的一个 `*.ts` 文件,
  通过 `providerEnv.ts` 注册。

## 布局

```
src/
  index.ts                barrel:公共导出
  config.ts               provider 目录 + adapter 选择
  providers.ts            LlmProvider port 实现
  providerEnv.ts          加载 provider env(key、base URL、model)
  providerHttp.ts         带 retry / 熔断钩子的共享 HTTP client
  providerSecret.ts       单次请求的 BYOK 解密
  resilience.ts           熔断 + 并发上限 + 队列
  types.ts                LLM 请求 / 响应类型
  adapters/
    anthropicMessages.ts  Anthropic Messages API
    openaiChat.ts         OpenAI Chat Completions
    openaiResponses.ts    OpenAI Responses API
```

## 脚本

| 命令 | 说明 |
|---|---|
| `pnpm --filter @grimoire/llm build` | `tsc -p tsconfig.json`。 |
| `pnpm --filter @grimoire/llm typecheck` | `tsc --noEmit`。 |
| `pnpm --filter @grimoire/llm test` | Vitest run。 |
| `pnpm --filter @grimoire/llm lint` | oxlint。 |

## 依赖

Runtime:`@grimoire/contracts`、`@grimoire/foundation`。Dev:`vitest`、
`oxlint`、`typescript`。

## 约定

- Provider 凭据在进程启动时通过 `providerEnv.ts` 加载一次。启动后它们
  只存在于熔断上下文内,绝不放在模块级常量中。
- adapter 选择是数据驱动的:新 provider 是 `src/adapters/` 下的新文件,
  按名字注册。`providers.ts` 内部不写 `if/else`。
- 熔断通过注入持有时间源(`@grimoire/foundation` 的 `Clock`),以便测试
  快进。
- R-04(BYOK 失败回落服务端 provider)**默认关闭**,以保证每用户配额隔离。
