---
title: Evidence matrix
description: Traceability of documented claims to source code and tests
audience: Auditors, maintainers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified
---

# Evidence matrix

Verification methods: **S** = static code review · **T** = covered by an automated test that passed on 2026-10-29 · **D** = from repository documentation · **R** = runtime (not performed in this pass).

| # | Claim | Status | Source | Route / endpoint | Method | Notes |
|---|---|---|---|---|---|---|
| 1 | 6 roles exist | Verified | `backend/lib/permissions.js` `ROLES` | — | S,T | Legacy operator/viewer aliased |
| 2 | 19 permissions and role mapping | Verified | `permissions.js` `PERMISSIONS` | all | S,T | `routes.test.js` |
| 3 | System Administrator has all permissions and is hidden | Verified | `permissions.js` `can`, `canViewUser`; `lib/accountPrivacy.js` | `/api/users` | S,T | `auth.test.js` |
| 4 | `access.manage` cannot be delegated | Verified | `permissions.js` `can` | `/api/users/access` | S | |
| 5 | Out of Service only for Super Admin | Verified | `permissions.js` `can`; `userController.updateUserAccess` | move | S | |
| 6 | Each route requires sign-in + a permission | Verified | `routes/table.js` | all | S,T | |
| 7 | User reloaded on every request | Verified | `middleware/authMiddleware.js` | all | S | |
| 8 | Session = JWT in an HttpOnly cookie, 7 days | Verified | `utils/session.js` | `/api/auth/login` | S | |
| 9 | Login rate limit 40/10 min | Verified | `routes/authRoutes.js` | `/api/auth/login` | S | |
| 10 | Passkeys (WebAuthn) with password confirmation | Verified | `controllers/passkeyController.js`, `validators/schemas.js` | `/api/auth/passkeys/*` | S,T | |
| 11 | Locations and statuses (enums) | Verified | `lib/mouldState.js` | — | S,T | |
| 12 | Non-Good never in storage; In service/repair only at the Workshop/OOS | Verified | `mouldState.js` `mouldStateError` | — | S,T | `mouldModel.test.js` |
| 13 | Move permission groups | Verified | `lib/workflow.js` `movePermissionGroups` | `POST /moulds/:id/move` | S,T | `workflow.test.js` "who may move what" |
| 14 | One mould per machine (DB index) | Verified | `models/Mould.js` partial unique index | move | S,T | |
| 15 | Capable machine override for Admins with reason | Verified | `workflow.js` `planMove` | move | S,T | |
| 16 | Rack capacity / inactive / owner-zone reason | Verified | `planMove` | move | S,T | |
| 17 | Remarks required to Workshop / OOS / status change | Verified | `planMove`, `planStatus` | move, status | S,T | |
| 18 | Shot limit auto-flags Needs service | Verified | `planShots`, `serviceDueChange` | `POST /:id/shots` | S,T | |
| 19 | In service → Good resets shots | Verified | `planStatus` | status | S,T | |
| 20 | Extrusion dies stored in the Tool Room | Verified | `mouldState.js` `storageLocation` | — | S,T | `toolRoom.test.js` |
| 21 | Optimistic locking `STALE` | Verified | `mouldController.js` `loadForUpdate` | PATCH/move/status | S | |
| 22 | Changes + history + audit in one transaction | Verified | `config/db.js` `withTransaction`; controllers | — | S | |
| 23 | Soft delete / restore moulds; can't delete when mounted | Verified | `deleteMould`, `restoreMould` | DELETE/restore | S | |
| 24 | Search fields and spacing-insensitive Tool ID | Verified | `listMoulds` | `GET /moulds` | S | |
| 25 | Stats counts | Verified | `mouldStats` | `GET /moulds/stats` | S | |
| 26 | Work-log fields, 1–5 people, ≤3 photos | Verified | `models/WorkLog.js`, `schemas.js` | `POST /:id/worklogs` | S,T | |
| 27 | Outcome effects and warnings | Verified | `lib/workLog.js` `planWorkLog` | worklogs | S,T | `workLog.test.js` |
| 28 | Work log append-only; corrections via `correctsId` | Verified | `lib/immutable.js`, `WorkLog.js` | — | S,T | |
| 29 | Problem report never changes status/location | Verified | `planProblemReport` | `POST /:id/problems` | S,T | |
| 30 | Problem resolved by work log or Workshop move | Verified | `workLogController.resolveProblem`, `moveMould` | — | S | |
| 31 | Report filters, Asia/Colombo days, paging | Verified | `schemas.js` `workLogQuery`, `lib/dateRange.js` | `GET /worklogs` | S,T | `workLogReport.test.js` |
| 32 | Export CSV/XLSX, cap 5,000, audited | Verified | `exportWorkLogs`, `lib/workLogFilter.js` | `GET /worklogs/export` | S,T | |
| 33 | Zones/racks CRUD, bulk preview, occupied guards | Verified | `rackController.js` | `/api/racks/*` | S | |
| 34 | Machines: no disable while occupied; code fixed in UI | Verified | `machineController.js`; `machines/page.tsx` | `/api/machines` | S | |
| 35 | No add-machine UI | Verified | `machines/page.tsx` (only list/update calls) | — | S | |
| 36 | User management rules | Verified | `userController.js`, `canManageUser` | `/api/users` | S,T | |
| 37 | Custom access replaces role defaults | Verified | `can` (`permissionOverrides`) | `/api/users/:id/access` | S | |
| 38 | Audit log append-only, filters, ≤200/page | Verified | `AuditLog.js`, `schemas.js` `auditQuery` | `GET /audit` | S | |
| 39 | Uploads: JPEG/PNG/WebP → WebP 800 px + 200 px thumbnail | Verified | `lib/images.js` | uploads | S,T | `itemPhoto.test.js` |
| 40 | Uploads served to signed-in users only | Verified | `index.js` | `/api/uploads` | S | |
| 41 | 10 s list refresh; 60 s permission refresh | Verified | `MouldSearch.tsx`, `AppLayout.tsx` | — | S | |
| 42 | English + Sinhala UI | Verified | `utils/i18n.ts` | — | S | |
| 43 | PWA + offline page | Verified | `public/sw.js`, `manifest.ts` | — | S,T | `service-worker.test.mjs` |
| 44 | Legacy hash links redirect | Verified | `utils/helpers.ts` `getLegacyDestination` | `/` | S | |
| 45 | Native shells (Windows, Android), Apple source only | Verified | `native/README.md` | — | D,S | |
| 46 | Compose stack, Mongo replica set | Verified | `compose.yaml` | — | S | |
| 47 | Production on Coolify | Partially verified | `deploy/README.md` | — | D | Server not inspected |
| 48 | No uploads volume in Compose | Verified | `compose.yaml`, `backend/Dockerfile` | — | S | Coolify config not inspected |
| 49 | `settings.manage`, `import.run`, `export.run` unused | Verified | grep of `backend/` | — | S | |
| 50 | No notifications / QR / scheduler / integrations | Not found | dependencies, code search | — | S | |
| 51 | Import scripts dry-run by default, nothing deleted | Verified | script headers | CLI | S,T | |
| 52 | UI walkthrough steps and button labels | Partially verified | `i18n.ts`, components | pages | S | Not exercised at runtime (R) |

## Coverage summary
| | Count |
|---|---|
| Verified | 49 |
| Partially verified | 2 (#47, #52) |
| Not found (confirmed absent) | 1 (#50) |
