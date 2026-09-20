/**
 * @file parseToolCall
 * @description Parses prompt-based `TOOL_CALL:` lines out of model output for the prompt-driven tool loop.
 *
 * Responsibilities:
 * - Detect a single-line `TOOL_CALL: {"name":"...","args":{...}}` payload.
 * - Return a normalized `ParsedToolCall` or null on missing/invalid JSON.
 * - Expose `hasToolCall` as a cheap predicate used by the final-answer gate.
 *
 * No prompt rendering or tool execution lives here; this module only parses raw model text.
 */
import type { ParsedToolCall } from './types.js';

const TOOL_CALL_LINE = /TOOL_CALL:\s*(\{[^\n]*\})/;

export function parseToolCall(text: string): ParsedToolCall | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  const m = raw.match(TOOL_CALL_LINE);
  if (!m?.[1]) return null;
  try {
    const obj = JSON.parse(m[1]) as { name?: unknown; args?: unknown };
    if (typeof obj.name !== 'string' || !obj.name.trim()) return null;
    return {
      name: obj.name.trim(),
      args: obj.args ?? {},
    };
  } catch {
    return null;
  }
}

/** If the model output contains a TOOL_CALL line, treat this turn as a tool round rather than the final answer. */
export function hasToolCall(text: string): boolean {
  return parseToolCall(text) != null;
}
