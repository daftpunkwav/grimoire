/**
 * @file errors
 * @description Typed application errors and factory helpers.
 *
 * Responsibilities:
 * - AppError class with status, code, and message
 * - Factory helpers: badRequest, unauthorized, forbidden, notFound, conflict
 *
 * No external dependencies. No business package may depend on this file beyond the published surface area.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return new AppError(400, code, message);
}

export function unauthorized(message = '未登录或登录已过期') {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = '没有权限执行此操作') {
  return new AppError(403, 'FORBIDDEN', message);
}

export function notFound(message = '资源不存在') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(message: string) {
  return new AppError(409, 'CONFLICT', message);
}
