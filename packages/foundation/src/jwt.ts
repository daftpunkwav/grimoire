/**
 * @file jwt
 * @description JWT access-token and refresh-token helpers.
 *
 * Responsibilities:
 * - signAccessToken / verifyAccessToken: short-lived JWT (default 15m)
 * - generateRefreshToken / hashRefreshToken / refreshExpiresAt: refresh-token lifecycle
 * - parseDurationMs: turn "15m" / "7d" strings into milliseconds (used by expires-in parsing)
 *
 * Invariants:
 * - JWT_SECRET must be at least 16 characters.
 * - Refresh tokens are random 32 bytes (base64url); only the SHA-256 hex is stored server-side.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AuthorTier, UserRole } from '@core/contracts';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  authorTier?: AuthorTier;
  adminLevel?: number;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET 未配置或过短（至少 16 字符）');
  }
  return s;
}

/** Parse durations like `15m` / `7d` into milliseconds; throws on invalid input. */
export function parseDurationMs(raw: string): number {
  const m = /^(\d+)([smhd])$/i.exec(raw.trim());
  if (!m) {
    throw new Error(`无效过期时长: ${raw}`);
  }
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * mult[unit]!;
}

export function signAccessToken(payload: JwtPayload): string {
  // Short-lived access: prefer JWT_ACCESS_EXPIRES_IN; fall back to legacy JWT_EXPIRES_IN; default 15m.
  const expiresIn =
    process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(payload, secret(), { expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, secret());
  if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded)) {
    throw new Error('无效 token');
  }
  return decoded as JwtPayload;
}

/** Generate a high-entropy refresh-token plaintext (issued to the client once). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** refresh-token plaintext → SHA-256 hex (stored server-side). */
export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Compute the refresh-token expiry timestamp (default 7d). */
export function refreshExpiresAt(now = Date.now()): Date {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return new Date(now + parseDurationMs(raw));
}
