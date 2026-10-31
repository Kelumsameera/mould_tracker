---
title: Local development
description: Run, test and build the app on a developer machine
audience: Developers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (tests run 2026-10-29); dev servers not started in this pass
---

# Local development

## Prerequisites
Node.js (a version supporting `node --test` and Next 16), a MongoDB **replica set** (Atlas or local `--replSet`), Git.

## Backend
```sh
cd backend
cp .env.example .env      # fill MONGODB_URI, JWT_SECRET (≥32 chars), CORS_ORIGIN
npm install
npm run seed              # development data only - never against production
npm run dev               # nodemon, http://localhost:4000/api/health
npm test                  # node --test  -> 157 tests
```
The server refuses to start without a `JWT_SECRET` of at least 32 characters.

## Frontend
```sh
cd frontend
cp .env.local.example .env.local
npm install
npm run dev               # http://localhost:3000
npm run typecheck
npm test                  # 29 tests (confirm, imageUpload, service worker, theme)
npm run build
```

## Passkeys locally
`WEBAUTHN_ORIGIN=http://localhost:3000`, `WEBAUTHN_RP_ID=localhost` (development only).

## Test results at documentation time
| Suite | Result |
|---|---|
| backend `npm test` | 157 pass, 0 fail (19 suites) |
| frontend `npm test` | 29 pass, 0 fail |

## Contribution rules (observed conventions)
- Business rules go in pure `lib/` functions with tests; controllers only load and save.
- New routes go in a route table with explicit permissions; `routes.test.js` checks every role.
- Every change writes Movement and/or AuditLog in the same transaction.
- Update `docs/` and `DOCUMENTATION-CHANGELOG.md` with any behaviour change.
