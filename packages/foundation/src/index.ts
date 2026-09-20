/**
 * @file index
 * @description Public exports for the @core/foundation package.
 *
 * Responsibilities:
 * - Re-export error types and constructors (AppError, badRequest, unauthorized, forbidden, notFound, conflict)
 * - Re-export infrastructure helpers (logger, password hash, JWT, SSE, prefs, params)
 * - Re-export BYOK crypto and URL-policy helpers
 * - Re-export LLM answer extraction and attachUserRefs helper
 * - Re-export HTTP middleware (validate, optionalAuth, requireAuth, requireRole, requirePermission, requireAdminLevel, errorHandler)
 *
 * Pure infrastructure (no business contracts); shared library for every service and host.
 */

export { AppError, badRequest, unauthorized, forbidden, notFound, conflict } from './errors.js';
export { logger } from './logger.js';
export { hashPassword, verifyPassword } from './hash.js';
export {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiresAt,
  parseDurationMs,
} from './jwt.js';
export type { JwtPayload } from './jwt.js';
export { param } from './params.js';
export { parsePrefs } from './prefs.js';
export {
  initSse,
  sseWrite,
  startSseHeartbeat,
  createSseSession,
  endSseSession,
  softStreamHoverAnswer,
} from './sse.js';
export type { SseSession } from './sse.js';
export {
  isEncryptedByokKey,
  encryptByokKey,
  decryptByokKey,
  decryptByokConfig,
  resolveByokApiKeyToStore,
} from './byokCrypto.js';
export { assertSafeByokBaseUrl, isSafeByokBaseUrl, isPrivateOrSpecialIpv4 } from './byokUrlPolicy.js';
export { extractVisibleAnswer } from './llmAnswerExtract.js';
export { attachUserRefs } from './attachUserRefs.js';

// HTTP middleware and request validation
export { validate } from './validate.js';
export {
  optionalAuth,
  requireAuth,
  requireRole,
  requirePermission,
  requireAdminLevel,
} from './auth.js';
export type { AuthUser } from './auth.js';
export { errorHandler } from './errorHandler.js';
