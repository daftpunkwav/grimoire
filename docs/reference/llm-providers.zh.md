# LLM providers

> 语言：**简体中文** | [English](llm-providers.md)

LLM 网关参考:provider 调用、adapter 目录、熔断语义、BYOK 解密。实现位于
[`services/llm`](../../services/llm/)。

## Provider 目录

每个 provider 是
[`services/llm/src/adapters/`](../../services/llm/src/adapters/) 下的一个文件,
在模块加载时通过 `providerEnv.ts` 注册自身。内置 adapter:

| Adapter | `API_FORMAT` | 说明 |
|---|---|---|
| `anthropicMessages` | `anthropic_messages` | StepFun 默认。Anthropic 兼容;base URL 是 `/step_plan`(自动 `/v1/messages`)。 |
| `openaiChat` | `openai_chat` | OpenAI Chat Completions。 |
| `openaiResponses` | `openai_responses` | OpenAI Responses API。 |

新 adapter 是 `src/adapters/` 下的新文件,按名字注册。`providers.ts` 中
没有 `if/else` 分支;选择是数据驱动的。

## 解析顺序

当一次请求需要 LLM 调用时,`providers.ts` 按以下顺序解析凭据:

1. **每请求 BYOK**(`LlmKeyAccess` port)。密钥在请求开始时解密,在那次
   出站调用的闭包内持有。明文绝不持久化超过那次调用。
2. **服务端 env 密钥**。进程启动时读取一次;持有在熔断上下文内。
3. **拒绝**。无可用密钥 → agent 路由返回 401 `unauthenticated`。

`LLM_BYOK_FALLBACK_TO_SERVER`(R-04)**默认关闭**;设为 `1` 后,步骤 1
失败时回落到步骤 2。开启前要在面向用户的设置中说明。

## 熔断语义

每 provider 一个熔断:

- **失败阈值**:`LLM_CIRCUIT_FAILURES` 次连续失败。
- **开放冷却**:`LLM_CIRCUIT_OPEN_MS`;冷却期间每次调用快速失败为
  `breaker_open`(HTTP 503,`Retry-After` 设为剩余冷却)。
- **半开**:冷却后允许一次探针调用;成功关闭熔断,失败重置冷却。

熔断通过注入持有时间源(`@grimoire/foundation` 的 `Clock`),测试可快进而
无需 sleep。模块级 `Date.now()` 在 foundation 与 llm 源码中禁用。

## 并发上限

`LLM_MAX_CONCURRENT` 限制每 provider 的并发出站调用。满员时调用方在队列
中等候,最长 `LLM_QUEUE_WAIT_MS`;超时则返回 503。

## 出站 URL 策略

在任何 provider 调用之前,解析后的 base URL + 路径会与
`packages/foundation/src/byokUrlPolicy.ts` 校验:

- **Allow**:配置的 provider 主机白名单。
- **Deny**:任何不在白名单中的主机(SSRF 防护)。

违规返回 502 `provider_error`,并带 request id 记录。

## Adapter 契约

每个 adapter 导出同一形态:

```ts
export interface ProviderAdapter {
  readonly id: string;                                  // 例如 "anthropic_messages"
  invoke(args: InvokeArgs, ctx: InvokeContext): Promise<InvokeResult>;
}
```

- `InvokeArgs` 是 provider 无关输入(messages、tools、temperature、
  max tokens、stream 标志)。
- `InvokeContext` 携带解析后的凭据、熔断、request id 与 `Clock`。
- `InvokeResult` 是 provider 无关输出(text delta 流、usage token、
  finish reason)。

`services/agent` 的 orchestrator 消费无关形态;adapter 负责 provider 特定
的翻译。

## 新增 provider

1. 在 `services/llm/src/adapters/<provider>.ts` 添加文件。
2. 在 `services/llm/src/providerEnv.ts` 与 `services/llm/src/config.ts`
   注册 adapter。
3. 在 `.env.example` 中添加 env 变量,并在 [`configuration.md`](./configuration.md#llm-providers)
   文档化。
4. 添加一个针对 mock HTTP server 驱动 adapter 的测试。
5. 更新前端 provider 列表(`apps/web`),让用户能在设置中选择新 provider。
