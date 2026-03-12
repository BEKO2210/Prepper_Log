# PrepTrack Sync Backend

Minimal LAN-first sync backend for PrepTrack.

## Run with Docker Compose

From repo root:

```bash
docker compose -f docker-compose.sync.yml up -d --build
```

Health check:

```bash
curl http://localhost:8787/health
```

## Environment Variables

- `PORT` (default `8787`)
- `DB_PATH` (default `/data/sync.db`)
- `CORS_ORIGINS` optional comma-separated allowlist (if unset, all origins are allowed)

## API

- `POST /v1/pair` `{ syncCode, deviceName }`
- `POST /v1/sync/push` (auth required via `Authorization: Bearer <token>` + `x-household-id`)
- `GET /v1/sync/pull?cursor=<n>` (same auth headers)

## Tests

```bash
npm run test
```
