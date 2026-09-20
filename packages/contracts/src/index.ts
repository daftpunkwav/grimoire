/**
 * @file index
 * @description Public exports for the contracts package.
 *
 * Responsibilities:
 * - Re-export hover-card sanitization helpers consumed by web and agent
 * - Re-export the permission matrix (role, tier, can, role labels)
 * - Re-export domain DTOs, LLM types, and cross-service ports
 *
 * Brand-neutral shared contracts; the single public surface for downstream packages.
 */
export {
  HOVER_CARD_MAX_SENTENCES,
  HOVER_CARD_MAX_CHARS,
  stripSelfRevisionDraft,
  isLikelyHoverTeaching,
  finalizeHoverCardText,
  progressiveHoverAnswer,
  extractHoverAnswer,
  isCompleteHoverAnswer,
  looksLikeHoverPlanning,
  isSystemEcho,
  isSafeHoverPublicAnswer,
  sanitizeHoverDisplay,
  // Frontend aliases (point to backend implementations)
  stripSelfRevisionClient,
  isSafeHoverDisplay,
  isLikelyHoverTeachingClient,
} from './hoverSanitize.js';

// Permission matrix
export type { UserRole, AuthorTier, RuntimeIdentity, Permission, Principal } from './permissions.js';
export { can, isAuthorLike, isAdminLike, roleLabel } from './permissions.js';

// Domain DTOs / LLM types / port contracts (split by concern, aggregated here)
export * from './dto.js';
export * from './llm-types.js';
export * from './ports.js';
