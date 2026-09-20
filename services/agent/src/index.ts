/**
 * @file index
 * @description Public exports for the @grimoire/agent package.
 *
 * Responsibilities:
 * - Re-export the agent runtime factory (`createAgentRuntime`) and its type (`AgentRuntime`).
 * - Re-export the HTTP router factory (`createAgentRouter`) for the agent domain.
 * - Re-export the agent dependency-port types (`AgentDeps`, `ArticleQueryPort`, `UserQueryPort`, `LlmGatewayPort`).
 *
 * The agent workspace is composed in-process by `services/api` by default;
 * a future microservice split can call `createAgentRuntime` standalone with HTTP port implementations.
 */
export { createAgentRuntime } from './runtime.js';
export type { AgentRuntime } from './runtime.js';
export { createAgentRouter } from './routes/agent.js';
export type { AgentDeps, ArticleQueryPort, UserQueryPort, LlmGatewayPort } from './ports.js';
