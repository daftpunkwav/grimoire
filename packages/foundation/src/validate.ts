/**
 * @file validate
 * @description Express request-validation middleware wrapping Zod schemas.
 *
 * Responsibilities:
 * - validate(schema, target?) → RequestHandler that parses req[target] with Zod and assigns the typed result back
 * - On failure, forwards the ZodError to the error pipeline (handled by errorHandler)
 */
import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Target = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: Target = 'body'): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    // Explicitly cast to an "index-assignable" shape to avoid losing type protection via `any`.
    (req as unknown as Record<Target, unknown>)[target] = parsed.data;
    next();
  };
}
