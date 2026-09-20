/**
 * @file serialize
 * @description DTO mapper from Prisma `User` rows to the `PublicUser` wire contract.
 *
 * Responsibilities:
 * - `toPublicUser`: project a Prisma user into the `PublicUser` DTO, casting enums and normalizing nullable profile fields.
 *
 * Boundary: only the identity-owned `User` table is touched.
 */
import type { User } from '@prisma/client';
import type { PublicUser, AuthorTier, UserRole } from '@grimoire/contracts';

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    authorTier: (u.authorTier as AuthorTier) || 'none',
    adminLevel: u.adminLevel ?? 0,
    bio: u.bio || undefined,
    avatarUrl: u.avatarUrl || undefined,
    headline: u.headline || undefined,
    website: u.website || undefined,
    createdAt: u.createdAt.toISOString(),
  };
}
