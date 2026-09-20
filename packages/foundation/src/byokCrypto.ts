/**
 * @file byokCrypto
 * @description AES-256-GCM encryption helpers for BYOK apiKeys at rest (A-03).
 *
 * Responsibilities:
 * - isEncryptedByokKey / encryptByokKey / decryptByokKey: low-level envelope (iv + tag + ciphertext)
 * - decryptByokConfig: shallow-copy a ByokConfig with the apiKey decrypted
 * - resolveByokApiKeyToStore: derive the plaintext that should be persisted when the user submits a (possibly empty) form
 *
 * Invariants:
 * - Storage format: `${PREFIX}${ivB64}.${tagB64}.${dataB64}` (PREFIX = "enc:v1:").
 * - Key derivation: SHA-256 of `byok-encryption-v1:<secret>`, where secret is BYOK_ENCRYPTION_KEY or
 *   JWT_SECRET fallback. At least 16 source chars required.
 * - Legacy plaintext (no PREFIX) is returned as-is on read; next write upgrades it to ciphertext.
 * - On decrypt failure the function returns '' and never leaks ciphertext as plaintext.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { ByokConfig } from '@core/contracts';
import { logger } from './logger.js';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function key(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error('BYOK_ENCRYPTION_KEY 或 JWT_SECRET 未配置（至少 16 字符）');
  }
  // Derive key: fixed context string avoids reusing the JWT secret directly.
  return createHash('sha256').update(`byok-encryption-v1:${raw}`).digest();
}

/** Whether the stored value uses the A-03 envelope (used by callers to decide if re-encryption is required). */
export function isEncryptedByokKey(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function encryptByokKey(plain: string): string {
  if (!plain) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptByokKey(stored: string): string {
  if (!stored) return stored;
  // Legacy plaintext (un-encrypted): return as-is; only the next write upgrades to ciphertext.
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const parts = stored.slice(PREFIX.length).split('.');
    if (parts.length !== 3) return '';
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (e) {
    // Decrypt failure (e.g. key rotation): treat as no key — never leak ciphertext as plaintext.
    logger.warn({ err: String(e) }, 'BYOK key decrypt failed');
    return '';
  }
}

/** Decrypt the apiKey field of a ByokConfig (shallow copy; original object is not mutated). */
export function decryptByokConfig(byok?: ByokConfig | null): ByokConfig | null {
  if (!byok || !byok.apiKey) return byok ?? null;
  return { ...byok, apiKey: decryptByokKey(byok.apiKey) };
}

/**
 * Derive the plaintext key that should be persisted on a settings-save submission:
 * the previous value may be ciphertext (post A-03) or legacy plaintext.
 *
 * On a second save (form left blank) the old ciphertext must be decrypted first —
 * otherwise encrypting ciphertext again silently breaks BYOK. On decrypt failure
 * (key rotation / corruption) we keep the ciphertext rather than blanking it, because
 * an empty submission must never destroy recoverable data. Only an explicit
 * clearByokKey call (decided by the caller) may blank it.
 */
export function resolveByokApiKeyToStore(prevApiKey: string | undefined, submitted: string): string {
  const prev = prevApiKey || '';
  // New key submitted (not the mask placeholder): use it directly. The mask "••••" is purely defensive —
  // match it exactly so we never clobber a real key that happens to contain "••••".
  if (submitted && submitted !== '••••') return submitted;
  // No new key: try decrypting the old value; on failure keep the ciphertext (wait for key rollback or user re-entry).
  if (prev.startsWith(PREFIX)) {
    const plain = decryptByokKey(prev);
    if (!plain) {
      logger.warn({ event: 'byok_key_decrypt_failed_kept' }, 'BYOK key decrypt failed; ciphertext kept');
      return prev;
    }
    return plain;
  }
  return prev;
}
