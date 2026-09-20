# `@grimoire/identity`

> Language: **English** | [简体中文](README.zh.md)

Identity services: authentication, users, author applications, and
settings (BYOK encrypted).

## Responsibilities

- **Auth** (`/api/v1/auth/{register,login,logout,refresh,me}`):
  password + email registration, JWT access token issuance (15 m by
  default), refresh token rotation with sha256-hashed server storage
  and revocation list.
- **Author applications** (`/api/v1/author-applications`): readers apply,
  admins review. Promotions grant `author` + `authorTier`; admins have
  `adminLevel` grading.
- **Settings** (`/api/v1/settings`): per-user settings, including BYOK
  provider keys encrypted at rest via `@grimoire/foundation/byokCrypto`.
  Settings also expose a test-LLM endpoint used by the front-end to
  validate a newly entered BYOK key without committing it.

## Layout

```
src/
  index.ts                barrel: public exports
  repositories.ts         UserRepository + RefreshTokenStore port impls
  serialize.ts            request / response DTO mappers
  routes/
    auth.ts               register / login / logout / refresh / me
    applications.ts       author application CRUD + review
    settings.ts           per-user settings (BYOK encrypted)
    settingsTestLlm.ts    validate a BYOK key against a real provider
  services/
    applicationReview.ts  application review + promotion logic
    settingsHelpers.ts    BYOK encrypt / decrypt helpers for routes
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/identity build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/identity typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/identity test` | Vitest run. |
| `pnpm --filter @grimoire/identity lint` | oxlint. |

## Dependencies

Runtime: `@grimoire/contracts`, `@grimoire/foundation`, `express`,
`express-rate-limit`, `zod`, `@prisma/client`. Dev: `vitest`, `oxlint`,
`typescript`.

## Conventions

- Password hashing uses `bcryptjs` via `@grimoire/foundation/hash`.
  Plaintext passwords never leave this service.
- Refresh tokens are stored as sha256 hashes; the plaintext is returned
  to the client exactly once and never persisted in cleartext.
- BYOK keys are encrypted at rest using `@grimoire/foundation/byokCrypto`
  and decrypted on demand by `services/llm` through the `LlmKeyAccess`
  port. The decrypted key never crosses the boundary into another
  service's source.
