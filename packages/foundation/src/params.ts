/**
 * @file params
 * @description Express request parameter accessor that handles string | string[] types.
 *
 * Responsibilities:
 * - param(req, name) → always returns a single string, taking the first element when an array
 *
 * In Express 5 params may be `string | string[]`; this helper normalizes to a string.
 */
import type { Request } from 'express';

/** Express 5 params may be `string | string[]`. */
export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (Array.isArray(v)) return v[0] || '';
  return v || '';
}
