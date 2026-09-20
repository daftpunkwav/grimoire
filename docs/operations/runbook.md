# Runbook

> Language: **English** | [简体中文](runbook.zh.md)

Operations map: ports, run modes, data layout, shutdown semantics,
failure modes.

## Ports

| Port | Service | Bind address (default) | Notes |
|---|---|---|---|
| `8180` | `apps/web` | `127.0.0.1` | Vite dev server, strict port. |
| `8181` | `services/api` | `127.0.0.1` | Express API. `/docs` Swagger UI in dev. |
| `5432` | `postgres` (compose) | `127.0.0.1` | Loopback only; production removes this mapping. |

Port rule: web `8180` · api `8181`; new services follow `8182`,
`8183`, `8184` … in order. The dev launcher does **not** auto-shift.

## Run modes

| Mode | Start | Notes |
|---|---|---|
| Development | `pnpm dev` | web + api together; Swagger UI live. |
| Web only | `pnpm dev:web` | Vite dev server. |
| API only | `pnpm dev:api` | `tsx watch services/api`. |
| Build | `pnpm -r build` | TypeScript → dist for every workspace. |
| API start (built) | `pnpm --filter @grimoire/api start` | `node dist/index.js`. |
| Docker | `docker compose up -d` | postgres + api; web is hosted separately. |
| Smoke | `pnpm smoke` | `scripts/smoke.mjs`; post-deploy probe. |

## Data layout

```
repo-root/
  .env                                  # gitignored; loadSettings()
  .env.example                          # committed template

services/api/
  .env                                  # gitignored; per-workspace override
  prisma/
    schema.prisma                       # 15 models
    migrations/                         # generated; committed
    dev.db                              # SQLite dev only; gitignored
    seed.ts                             # admin seed
    seed-content.ts                     # system content seed
```

`docker-compose.yml` mounts a named volume (`grimoire_pg_data`) for the
postgres data directory. Remove the volume to reset the database:

```bash
docker compose down -v
```

## Shutdown semantics

The API installs `SIGINT` and `SIGTERM` handlers. On signal:

1. Stop accepting new connections (close the listener).
2. Wait up to **5 seconds** for in-flight requests to finish.
3. Disconnect Prisma.
4. Exit 0.

If the 5-second grace expires, the process exits 1 and the OS reaps it.

`pnpm dev` (the combined launcher) installs the same handlers on each
child process. Killing the launcher kills both children.

## Failure modes

| Symptom | First check |
|---|---|
| `SettingsLoadError` | Confirm `.env` (or per-workspace `.env`) has every required key (see [`../reference/configuration.md`](../reference/configuration.md)). |
| `PortInUseError` | Identify the process holding the port; kill it or pick a new port (do not auto-shift). |
| `PrismaClientInitializationError` | Confirm `DATABASE_URL` matches the database you intend (SQLite vs Postgres), the file path exists for SQLite, the compose stack is healthy for Postgres. |
| `breaker_open` (503) | Provider breaker cooldown. See `LLM_CIRCUIT_*`; wait or lower the threshold only with an ADR. |
| `provider_error` (502) | Check the provider's status page and `providerSecret` decryption logs (request id, never the key itself). |
| `unauthenticated` (401) on BYOK route | The user has not saved a BYOK key, or it failed to decrypt. Check `BYOK_ENCRYPTION_KEY` derivation; never log the key itself. |
| High memory growth | Check `viewTracking` cache eviction (in-process LRU; default cap is set in `services/content/src/services/viewTracking.ts`). |
| SSE drops mid-turn | Check reverse proxy idle timeouts; nginx defaults to 60 s; the agent routes emit a keep-alive comment every 15 s. |

## Logs

- API logs are JSON via `pino`. Production pretty-print is off.
- Every request carries `requestId`; `errorHandler` emits it on every
  error response and every error log line.
- Front-end logs (`apps/web`) ship to the browser console; dev mode also
  surfaces them in the Vite overlay.

## Backups

For SQLite dev DB, snapshot `services/api/prisma/dev.db`. For
Postgres, use `pg_dump` against the named volume or run a sidecar
backup. Encryption-at-rest is delegated to the host platform.

## Upgrade

The repo does not yet tag releases. To upgrade in place:

1. `pnpm install` (respects `pnpm-lock.yaml`).
2. `pnpm -r build` (catches TS drift).
3. `pnpm --filter @grimoire/api db:migrate` (idempotent; safe to re-run).
4. `pnpm verify` (full gate).
5. Restart the API; reload the web app.
