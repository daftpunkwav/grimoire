/**
 * @file llmErrors
 * @description Map raw LLM call errors to safe `AppError` instances for HTTP/SSE delivery to the client.
 *
 * Responsibilities:
 * - Pass through `AppError` instances unchanged.
 * - Map `LlmCallError` to an `AppError(502, 'LLM_ERROR', e.messageForClient)`.
 * - Wrap any other thrown value as a generic 502 LLM_ERROR with a generic client-facing message.
 *
 * No request handling here — pure error-shape mapping.
 */
import { logger, AppError } from '@grimoire/foundation';
import type { LlmGatewayPort } from '@grimoire/contracts';

/** Map an LLM call error to a client-safe `AppError`. */
export function mapLlmError(llm: Pick<LlmGatewayPort, 'isLlmCallError'>, err: unknown): AppError {
  if (err instanceof AppError) return err;
  const info = llm.isLlmCallError(err) ? err : null;
  if (info) {
    logger.error({ err: info.diagnostic, status: info.status }, 'LLM call failed');
    return new AppError(502, 'LLM_ERROR', info.messageForClient);
  }
  logger.error(
    {
      err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { raw: String(err) },
    },
    'LLM call failed',
  );
  return new AppError(502, 'LLM_ERROR', '模型调用失败，请稍后重试');
}

export function noProviderError(): AppError {
  return new AppError(
    400,
    'NO_PROVIDER',
    '未配置模型：请登录后在「设置 → BYOK」填写 Base URL、API Key、模型与 API 格式。',
  );
}
