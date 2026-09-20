/**
 * @file index
 * @description Public exports for the @grimoire/agent tools subpackage.
 *
 * Responsibilities:
 * - Re-export the prompt-based tool-call parser (`parseToolCall`, `hasToolCall`).
 * - Re-export the tool registry factory and its type (`createToolRegistry`, `ToolRegistry`).
 * - Re-export the ReAct tool-loop factory and types (`createToolLoop`, `RunToolLoopOpts`, `ToolLoopResult`, `ToolLoop`).
 * - Re-export tool-definition types (`ParsedToolCall`, `ToolLoopEvent`, `ToolDefinition`).
 * - Re-export article-tool factories (`createGetArticleTool`, `GET_ARTICLE_MAX_CHARS`, `createSearchArticlesTool`).
 *
 * All tool factories take port dependencies; the composition root (`runtime.ts`) wires them.
 */
export { parseToolCall, hasToolCall } from './parseToolCall.js';
export { createToolRegistry } from './registry.js';
export type { ToolRegistry } from './registry.js';
export { createToolLoop } from './toolLoop.js';
export type { RunToolLoopOpts, ToolLoopResult, ToolLoop } from './toolLoop.js';
export type { ParsedToolCall, ToolLoopEvent, ToolDefinition } from './types.js';
export { createGetArticleTool, GET_ARTICLE_MAX_CHARS } from './getArticle.js';
export { createSearchArticlesTool } from './searchArticles.js';
