---
title: Configuration
description: Environment variables for backend, frontend and the Compose stack
audience: IT, developers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (.env examples, index.js, compose.yaml); values intentionally omitted
---

# Configuration

No real values are shown. Keep secrets out of Git (in production they are in Coolify's environment settings).

## Backend (`backend/.env`, see `backend/.env.example`)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | This app's database (replica set) |
| `SOURCE_MONGODB_URI` | Migration only | Old database, read-only, for `upgradeMouldModel.mjs` |
| `PORT` | No (4000) | API port |
| `JWT_SECRET` | Yes, ≥32 chars | Signs session tokens; startup fails otherwise |
| `JWT_EXPIRES_IN` | No (`7d`) | Token lifetime. The cookie `maxAge` is fixed at 7 days. |
| `CORS_ORIGIN` | Yes | Comma-separated allowed frontend origins |
| `NODE_ENV` | No | `production` hides internal error messages |
| `COOKIE_SECURE` | No (`false`) | `true` when served over HTTPS |
| `COOKIE_SAME_SITE` | No (`lax`) | Cookie SameSite |
| `WEBAUTHN_ORIGIN` | No | Exact HTTPS origin; blank disables passkeys |
| `WEBAUTHN_RP_ID` | No | Hostname of `WEBAUTHN_ORIGIN` |
| `UPLOAD_DIR` | No (`backend/uploads`) | Picture storage |
| `SYSTEM_ADMIN_NAME` / `_EMAIL` / `_PASSWORD` | For `create:system-admin` only | Provision the first System Administrator |

## Root `.env` for Compose (`.env.production.example`)
`MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD`, `JWT_SECRET` (generate each with `openssl rand -hex 32`), `APP_ORIGIN` (exact browser URL; becomes `CORS_ORIGIN`), `HTTP_PORT` (default 8081), `COOKIE_SECURE`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_ID`, optional `NPM_REGISTRY`.

## Frontend
`frontend/.env.local.example`: the API base used by the browser in development.

## In-app configuration
| Setting | Where | Who |
|---|---|---|
| Zones and racks | Rack management | Super Admin |
| Machines (name, active) | Machines | Admin |
| Users, roles | Users | Admin / Super Admin |
| Custom permissions | User access | System Administrator |
| Language, theme | Per user / device | Everyone |

There is no settings screen; `settings.manage` is defined but unused.
