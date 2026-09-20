# `@grimoire/foundation`

> Language: **English** | [简体中文](README.zh.md)

Infrastructure: errors, logger, JWT, hashing, BYOK crypto, SSE helpers,
and shared Express middleware. The only package allowed to depend on
every other package except `apps/`.

## Responsibilities

- **Error mapping**: a single `errorHandler` translates known thrown
  errors into HTTP responses (4xx / 5xx + JSON body), and surfaces
  unknown errors as `InternalServerError` with a request id.
- **JWT**: access token issuance + verification, refresh-token rotation
  helpers, and revocation store contract.
- **Hashing**: `bcryptjs` wrapper used by `services/identity`.
- **BYOK crypto**: AES-GCM encryption of user-supplied provider keys,
  key derivation from `BYOK_ENCRYPTION_KEY` or `JWT_SECRET`, and
  authentication-tag validation. The only file allowed to see a
  plaintext BYOK key outside the request scope.
- **BYOK URL policy**: outbound URL allow / deny list applied by
  `services/llm` before any provider request.
- **SSE helpers**: stream chunking + keep-alive shared by the hover and
  panel Agent routes.
- **Logger**: `pino` configuration, request id propagation, dev-mode
  pretty-print.
- **Middleware**: CORS, helmet, request id, body limits, rate-limit
  presets.
- **Clock**: swappable time source injected into the breaker and the
  cache TTLs.
- **LLM answer extraction**: helpers used by the hover and panel paths
  to extract the final answer from a streamed turn.

## Layout

```
src/
  index.ts                barrel: public exports
  auth.ts                 auth middleware factory
  byokCrypto.ts           AES-GCM encrypt / decrypt
  byokUrlPolicy.ts        outbound URL allow / deny list
  errors.ts               typed error classes
  errorHandler.ts         Express error middleware
  hash.ts                 bcryptjs wrapper
  jwt.ts                  access + refresh helpers
  llmAnswerExtract.ts     streamed-turn answer extractor
  logger.ts               pino configuration
  params.ts               numeric / range validation helpers
  prefs.ts                user-preference merge helpers
  sse.ts                  SSE chunking + keep-alive
  validate.ts             Zod-based request validator
  attachUserRefs.ts       user-reference attach helper for responses
```

## Scripts

| Command | Description |
|---|---|
| `pnpm --filter @grimoire/foundation build` | `tsc -p tsconfig.json`. |
| `pnpm --filter @grimoire/foundation typecheck` | `tsc --noEmit`. |
| `pnpm --filter @grimoire/foundation test` | Vitest run. |
| `pnpm --filter @grimoire/foundation lint` | oxlint. |

## Dependencies

Runtime: `@grimoire/contracts`, `bcryptjs`, `express`, `jsonwebtoken`,
`pino`, `zod`, `@prisma/client`. Dev: `vitest`, `oxlint`, `typescript`.

## Conventions

- Every exported error class extends a common base so the global
  `errorHandler` can map it without a per-class `instanceof` chain.
- `Clock` is injected wherever wall-clock time is used (`breakers`,
  `cache TTL`, `JWT expiry checks`). Module-level `Date.now()` is
  forbidden in foundation source.
- BYOK crypto constants (`BYOK_ENCRYPTION_KEY` derivation, IV handling,
  tag verification) live in `byokCrypto.ts` and **only** there.
