/**
 * @file errorHandler
 * @description Centralized Express error-mapping middleware.
 *
 * Responsibilities:
 * - Map AppError → JSON body with status/code/message
 * - Map ZodError → 400 VALIDATION_ERROR (joined messages)
 * - Map known Prisma errors (P2002, P2003, P2025) → 409 / 400 / 404
 * - Catch-all: log structured error and return 500 INTERNAL_ERROR
 */
import type { ErrorRequestHandler } from 'express';
import { AppError } from './errors.js';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors.map((e) => e.message).join('; ') || '参数校验失败',
      },
    });
    return;
  }

  // Unified mapping for known Prisma errors: P2002 unique conflict, P2003 missing FK reference, P2025 record not found.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: '唯一约束冲突：相同记录已存在' },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: '引用的关联记录不存在' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: '记录不存在' },
      });
      return;
    }
  }

  logger.error(
    {
      err: err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { raw: String(err) },
      method: _req.method,
      url: _req.originalUrl,
      requestId: res.locals.requestId,
    },
    'unhandled error',
  );
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? '服务器内部错误' : String(err?.message || err),
    },
  });
};
