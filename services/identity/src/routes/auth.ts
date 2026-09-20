/**
 * @file routes/auth
 * @description Registration, login, refresh, profile, and logout endpoints for the identity service.
 *
 * Responsibilities:
 * - `POST /register`: create a `reader` user and immediately issue an access/refresh pair.
 * - `POST /login`: password verification + token issuance.
 * - `POST /refresh`: atomic rotate-and-revoke of a refresh token (prevents replay).
 * - `GET /me` / `PATCH /me`: fetch and update the caller's profile; profile edits rotate the token pair so new claims take effect immediately.
 * - `POST /logout`: revoke every active refresh for the user (or a single token when called unauthenticated).
 *
 * Invariants: refresh tokens are issued in plaintext to the client but stored hashed; error copy is
 * Chinese because the user-visible API surface is currently zh-CN.
 */
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword, generateRefreshToken, hashRefreshToken, refreshExpiresAt, signAccessToken } from '@core/foundation';
import { badRequest, conflict, unauthorized } from '@core/foundation';
import { validate, optionalAuth, requireAuth } from '@core/foundation';
import type { PrismaClient, User } from '@prisma/client';
import { toPublicUser } from '../serialize.js';
import type { AuthorTier, UserRole } from '@core/contracts';

const registerSchema = z.object({
  email: z.string().email('邮箱格式无效'),
  password: z.string().min(8, '密码至少 8 位').max(128),
  name: z.string().min(1, '请填写昵称').max(64),
});

const loginSchema = z.object({
  email: z.string().email('邮箱格式无效'),
  password: z.string().min(1, '请填写密码'),
});

const profileSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  bio: z.string().max(2000).optional(),
  headline: z.string().max(200).optional(),
  website: z.string().max(300).optional(),
  avatarUrl: z.string().max(500).optional(),
  allowAgentAnnotationReview: z.boolean().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, '缺少 refreshToken'),
});

const logoutSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .default({});

export function createAuthRouter(prisma: PrismaClient): Router {
  const authRouter = Router();

  function accessTokenFor(user: User) {
    return signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      authorTier: (user.authorTier as AuthorTier) || 'none',
      adminLevel: user.adminLevel ?? 0,
    });
  }

  /** Issue a fresh access token plus a new refresh token (returned in clear to the client, stored hashed). */
  async function issueTokenPair(user: User) {
    const accessToken = accessTokenFor(user);
    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt(),
      },
    });
    return { accessToken, refreshToken, user: toPublicUser(user) };
  }

  authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
    try {
      const { email, password, name } = req.body as z.infer<typeof registerSchema>;
      const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (exists) {
        throw conflict('该邮箱已注册');
      }
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          role: 'reader',
          authorTier: 'none',
          adminLevel: 0,
        },
      });
      const pair = await issueTokenPair(user);
      res.status(201).json(pair);
    } catch (e) {
      next(e);
    }
  });

  authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user) {
        throw unauthorized('邮箱或密码错误');
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        throw unauthorized('邮箱或密码错误');
      }
      res.json(await issueTokenPair(user));
    } catch (e) {
      next(e);
    }
  });

  authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
    try {
      const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
      const tokenHash = hashRefreshToken(refreshToken);
      const now = new Date();

      // Atomic revoke: only one concurrent /refresh wins, preventing replay.
      const revoked = await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (revoked.count === 0) {
        throw unauthorized('refresh token 无效或已过期');
      }

      const row = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!row?.user) {
        throw unauthorized('refresh token 无效或已过期');
      }

      res.json(await issueTokenPair(row.user));
    } catch (e) {
      next(e);
    }
  });

  authRouter.get('/me', requireAuth, async (req, res, next) => {
    try {
      if (!req.user) throw unauthorized();
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) throw unauthorized();
      res.json({ user: toPublicUser(user) });
    } catch (e) {
      next(e);
    }
  });

  authRouter.patch('/me', requireAuth, validate(profileSchema), async (req, res, next) => {
    try {
      if (!req.user) throw unauthorized();
      const body = req.body as z.infer<typeof profileSchema>;
      const data: Record<string, unknown> = {};
      if (body.name != null) data.name = body.name;
      if (body.bio != null) data.bio = body.bio;
      if (body.headline != null) data.headline = body.headline;
      if (body.website != null) data.website = body.website;
      if (body.avatarUrl != null) data.avatarUrl = body.avatarUrl;
      if (body.allowAgentAnnotationReview != null) {
        data.allowAgentAnnotationReview = body.allowAgentAnnotationReview;
      }
      if (!Object.keys(data).length) throw badRequest('无更新字段');
      const user = await prisma.user.update({ where: { id: req.user.id }, data });
      // Profile change: rotate the token pair so the new claims take effect immediately.
      res.json(await issueTokenPair(user));
    } catch (e) {
      next(e);
    }
  });

  authRouter.post('/logout', optionalAuth, validate(logoutSchema), async (req, res, next) => {
    try {
      const { refreshToken } = req.body as z.infer<typeof logoutSchema>;
      const now = new Date();

      if (req.user) {
        // Authenticated: revoke every active refresh token for this user.
        await prisma.refreshToken.updateMany({
          where: { userId: req.user.id, revokedAt: null },
          data: { revokedAt: now },
        });
      } else if (refreshToken) {
        // Access already expired but the client still holds the refresh: revoke only that one.
        await prisma.refreshToken.updateMany({
          where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
          data: { revokedAt: now },
        });
      }

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return authRouter;
}
