/**
 * @file types
 * @description Shared type definitions for the agent tool loop and registry.
 *
 * Responsibilities:
 * - Define `ToolContext` (abortion + room for future fields like userId).
 * - Define `ToolDefinition` with a `ZodTypeAny` schema to avoid variance pain in the registry.
 * - Define `ParsedToolCall` and the `ToolLoopEvent` union consumed by the SSE layer.
 *
 * No runtime logic; type-only module.
 */
import type { z } from 'zod';

/** Execution context passed into a tool call (extensible: userId, abort, etc.). */
export type ToolContext = {
  signal?: AbortSignal;
};

/** Registry uses `ZodTypeAny` to avoid variance issues with concrete schema generics. */
export type ToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute: (args: never, ctx: ToolContext) => Promise<string>;
};

export type ParsedToolCall = {
  name: string;
  args: unknown;
};

export type ToolLoopEvent =
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; ok: boolean; preview?: string }
  | { type: 'thinking'; text: string }
  | { type: 'delta'; text: string };
