---
title: Operations and recovery
description: Health checks, logs, backup, restore and incident notes
audience: IT
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Health/logs verified from code; backup procedure partially verified (deploy/README.md)
---

# Operations and recovery

## Health checks
- `GET /api/health` → `database: "connected"`. Compose uses this as the backend health check (30 s interval).
- MongoDB health: `deploy/mongo-health.js`.
- The UI sync indicator shows Live / Offline per user.

## Logs
`docker compose logs --tail=100` (standalone), or the Coolify service logs. The API logs unexpected errors to stdout. There is no log shipping or monitoring integration.

## Backup (must cover both)
1. **MongoDB:** a `mongodump --archive --gzip` of the app database. A pre-Coolify backup example exists (see `deploy/README.md`).
2. **Uploads folder** (`/app/uploads` in the backend container): pictures. See risk R4 in [Security](security-and-access.md).

Take a backup before every deploy that includes a migration or an import `--apply`.

> The live database is shared with another application. **Never drop or delete existing collections or data**; restores must target only this app's database.

## Restore (outline — confirm with IT)
1. Stop the backend.
2. `mongorestore --archive --gzip` into this app's database only.
3. Restore the uploads folder.
4. Start the backend; check `/api/health`; sign in and open a mould with pictures.

## Incident quick reference
| Symptom | Check | Action |
|---|---|---|
| Everyone "Offline" | Proxy/backend container up? `/api/health` | Restart the service in Coolify |
| Health says `disconnected` | Mongo container / replica set | Check mongo logs; `rs.status()` |
| Pictures broken after redeploy | Uploads folder empty | Restore uploads; add a volume |
| Passkeys stopped working | Hostname/origin changed | `WEBAUTHN_ORIGIN`/`RP_ID` must match; re-enrol |
| One user can't do something | Role / custom access | Users or User access page |

## Disaster recovery
No documented RPO/RTO. *Requires owner confirmation* (see GAPS).
