/**
 * @file hash
 * @description Bcrypt password hashing helpers.
 *
 * Responsibilities:
 * - hashPassword(plain) → bcrypt hash with fixed work factor
 * - verifyPassword(plain, hash) → constant-time compare
 *
 * No external dependencies beyond bcryptjs.
 */
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
