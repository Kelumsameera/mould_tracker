---
title: API reference
description: Every REST endpoint with permissions, inputs, side effects and errors
audience: Developers, integrators, testers
last_verified: 2026-10-29
app_version: "API 2.0.0"
status: Verified against backend/routes/*.js and backend/validators/schemas.js
---

# API reference

Base path `/api`. JSON only. Authentication uses the HttpOnly cookie `access_token` set by login. All routes built with `routerFrom` require sign-in, then **any one** of the listed permissions (`backend/routes/table.js`).

## Response envelope

```json
{ "success": true, "...": "..." }
{ "success": false, "message": "Human readable", "code": "MACHINE_OCCUPIED", "details": { "occupant": "FLK19066" } }
```

| HTTP | When |
|---|---|
| 400 | Validation (Zod), `NO_CHANGE`, `REMARKS_REQUIRED`, bad id, invalid JSON |
| 401 | No / invalid / expired session; user inactive or deleted |
| 403 | Missing permission, `FORBIDDEN_MOVE` |
| 404 | Not found / route not found |
| 409 | Business-rule conflict (`STALE`, `NOT_GOOD`, `MACHINE_OCCUPIED`, `DUPLICATE`, …) |
| 410 | `/api/tools` (old API, replaced) |
| 413 | `TOO_LARGE` body (1 MB; 8 MB on work log / problem routes) |
| 429 | Rate limit on auth / passkey routes |
| 500 | Unexpected; message hidden in production |

## Health

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/health` | none | `{ service, database: "connected"\|"disconnected", timestamp }` |

## Auth — `/api/auth` (`backend/routes/authRoutes.js`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/login` | rate-limited 40/10 min | `{ email, password }` | Sets cookie (7 days) |
| POST | `/logout` | — | — | Clears cookie |
| GET | `/me` | signed in | — | User + `permissions[]` |
| PATCH | `/me` | signed in, rate-limited | `{ name, email, currentPassword, newPassword? }` | Profile |
| PATCH | `/me/language` | signed in | `{ language: "en"\|"si" }` | |
| POST | `/password` | signed in | `{ currentPassword, newPassword }` | |
| GET | `/passkeys/capabilities` | — | — | Whether passkeys are configured |
| GET | `/passkeys` | signed in | — | Your passkeys |
| POST | `/passkeys/register/options` | signed in, 20/10 min, origin check | `{ currentPassword, name }` | WebAuthn options |
| POST | `/passkeys/register/verify` | signed in, origin check | `{ response }` | |
| POST | `/passkeys/login/options` | 40/10 min, origin check | — | |
| POST | `/passkeys/login/verify` | 40/10 min, origin check | `{ response }` | Sets cookie |
| DELETE | `/passkeys/:id` | signed in, origin check | `{ currentPassword }` | |

## Moulds — `/api/moulds` (`backend/routes/mouldRoutes.js`)

| Method | Path | Permission (any) | Body / query | Side effects |
|---|---|---|---|---|
| GET | `/` | moulds.view | `toolType, q, location, status, owner, zone, rackId, machineId, awaitingRack, needsService, problem, deleted` | — |
| GET | `/stats` | moulds.view | `toolType` | — |
| GET | `/:id` | moulds.view | — | Deleted only for moulds.manage |
| GET | `/:id/history` | moulds.view | — | — |
| POST | `/` | moulds.manage | `toolId, toolType?, toolSetCount?, size?, owner?, capableMachines?, shotsToService?, notes?, location, rackId?, overrideReason, items[]` | CREATED + audit |
| PATCH | `/:id` | moulds.manage | mould fields + `remarks, version` | EDITED + audit |
| DELETE | `/:id` | moulds.manage | `{ reason }` | Soft delete |
| POST | `/:id/restore` | moulds.manage | — | RESTORED |
| POST | `/:id/move` | moves.outOfService, moves.machine, moves.mouldRoom, workshop.work (exact check in `planMove`) | `to, machineId?/machineCode?, rackId?, status?, remarks, overrideReason, outOfServiceDetails?, version` | MOVED + audit; may resolve problem |
| POST | `/:id/status` | workshop.work | `status, remarks, version` | STATUS_CHANGED |
| POST | `/:id/shots` | moves.machine, workshop.work | `shots (1–10,000,000), version` | May auto-flag NEEDS_SERVICE |
| POST | `/:id/items` | moulds.manage | item fields | item.created |
| PATCH | `/:id/items/:itemId` | moulds.manage | item fields + `photo` (data URL) | item.updated |
| DELETE | `/:id/items/:itemId` | moulds.manage | `{ reason }` | item.deleted |
| GET | `/:id/worklogs` | worklog.view | — | — |
| POST | `/:id/worklogs` | worklog.create | see [work log](../user-guide/work-log.md) | WorkLog + audit; may move / change status |
| POST | `/:id/problems` | problem.report | `description, doneAt?, photos[≤3], version` | openProblem |

Example move:

```http
POST /api/moulds/6650c0ffee0000000000abcd/move
Content-Type: application/json

{ "to": "MACHINE", "machineCode": "INJ-03", "remarks": "", "version": 7 }
```

## Racks — `/api/racks`

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/` | racks.view | — (zones, racks, occupancy) |
| GET | `/:id` | racks.view | — |
| POST | `/zones` | racks.manage | `{ code, name, sortOrder }` |
| PATCH | `/zones/:id` | racks.manage | `{ code?, name?, active?, sortOrder? }` |
| DELETE | `/zones/:id` | racks.manage | — |
| POST | `/` | racks.manage | `{ zone, row, number, capacity, note }` |
| PATCH | `/:id` | racks.manage | `{ row?, number?, capacity?, active?, note? }` |
| DELETE | `/:id` | racks.manage | — |
| POST | `/bulk` | racks.manage | `{ zone, rowFrom, rowTo, from, to, capacity, preview=true }` |
| POST | `/remove-row` | racks.manage | `{ zone, row }` |

## Machines — `/api/machines`

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/` | moulds.view | — |
| POST | `/` | moulds.manage | `{ code, name }` |
| PATCH | `/:id` | moulds.manage | `{ name?, active? }` |

## Users — `/api/users`

| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/` | users.manage | — |
| POST | `/` | users.manage | `{ name, email, password, role }` |
| PATCH | `/:id` | users.manage | `{ email?, name?, role?, active?, password? }` |
| DELETE | `/:id` | users.manage | `{ reason }` |
| GET | `/access` | access.manage | — |
| PATCH | `/:id/access` | access.manage | `{ permissions: string[] \| null }` |

## Work logs — `/api/worklogs`

| Method | Path | Permission | Query |
|---|---|---|---|
| GET | `/workers` | worklog.create | — (people who may be named) |
| GET | `/` | worklog.report | `q, toolId, userId, type, machine, outcome, status, problem, range, from, to, page, limit≤100` |
| GET | `/summary` | worklog.report | same filters |
| GET | `/export` | worklog.report | same + `format=csv\|xlsx` (cap 5,000) |

## Audit — `/api/audit`

| Method | Path | Permission | Query |
|---|---|---|---|
| GET | `/` | audit.view | `entityType, entityId, action, actorId, from, to, page, limit≤200` |

## Uploads

`GET /api/uploads/<path>`: signed-in users only; immutable cache for 365 days (file names are content hashes).

## Error codes (business)
`NOT_FOUND, STALE, NO_CHANGE, MOULD_DELETED, INVALID_LOCATION, FORBIDDEN_MOVE, FORBIDDEN, STATUS_ONLY_AT_WORKSHOP, INVALID_STATUS, OUT_OF_SERVICE_STATUS, REMARKS_REQUIRED, DISPATCH_DETAILS_REQUIRED, INVALID_DISPATCH_DETAILS, NOT_GOOD, MACHINE_REQUIRED, MACHINE_INACTIVE, SERVICE_DUE, MACHINE_OCCUPIED, NOT_CAPABLE, OVERRIDE_REASON_REQUIRED, RACK_REQUIRED, RACK_INACTIVE, RACK_FULL, OWNER_MISMATCH, NOT_AT_WORKSHOP, NOT_ON_MACHINE, INVALID_SHOTS, DUPLICATE, DUPLICATE_TOOL_ID, UNMOUNT_FIRST, RACK_OCCUPIED, INVALID_RANGE, INVALID_PHOTO, TOO_LARGE, DESCRIPTION_REQUIRED, DONE_AT_FUTURE, INVALID_DATE, TOO_MANY_WORKERS, INVALID_WORKER, INVALID_CORRECTION, EXPORT_TOO_LARGE, GONE`. Warnings (successful response): `CAPABILITY_OVERRIDDEN, OWNER_ZONE_OVERRIDDEN, SERVICE_STILL_DUE, WORKSHOP_MOVE_NOT_ALLOWED, WORKSHOP_MOVE_REQUIRED`.

Total: **55 routed endpoints** (1 health + 13 auth + 17 moulds + 10 racks + 3 machines + 6 users + 4 work logs + 1 audit), plus the `/api/uploads` static files and the `/api/tools` 410 stub.
