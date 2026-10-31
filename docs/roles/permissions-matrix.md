---
title: Permissions matrix
description: Every permission by role, and who may make each move
audience: Admins, System Administrators, auditors
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (backend/lib/permissions.js + backend/test/routes.test.js, workflow.test.js)
---

# Permissions matrix

Source of truth: `backend/lib/permissions.js` (`PERMISSIONS`, `can`). The frontend mirrors it only to show or hide buttons (`frontend/src/utils/permissions.ts`). Every API route is checked against every role by `backend/test/routes.test.js`.

Legend: ✅ allowed by role default · — not allowed. **SysA** (System Administrator) has every permission. Custom access ([user-access](../user-guide/user-access.md)) can replace a non-SysA user's defaults.

## By permission

| Permission | What it allows | Super Admin | Admin | Prod. Supervisor | Mould Technician | Mould Maker | SysA |
|---|---|---|---|---|---|---|---|
| `moulds.view` | View moulds, dies, machines, workshop queue | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `racks.view` | Rack view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `worklog.view` | View a mould's work log | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `problem.report` | Report a problem | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `moves.machine` | Mount / move on machines, to floor; record shots | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `moves.mouldRoom` | Move into/out of Mould Room / Tool Room | ✅ | ✅ | — | — | ✅ | ✅ |
| `workshop.work` | Send to Workshop, change status, record shots | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| `worklog.create` | Log work | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| `moulds.manage` | Add/edit/delete moulds, items, machines | ✅ | ✅ | — | — | — | ✅ |
| `machines.override` | Mount on a non-listed machine (with reason) | ✅ | ✅ | — | — | — | ✅ |
| `users.manage` | Manage users | ✅ | ✅ (not Super Admins) | — | — | — | ✅ |
| `worklog.report` | Work log report, summary, export | ✅ | ✅ | — | — | — | ✅ |
| `racks.manage` | Change zones and racks | ✅ | — (view only) | — | — | — | ✅ |
| `audit.view` | Audit log | ✅ | — | — | — | — | ✅ |
| `moves.outOfService` | Send out / return from Out of Service | ✅ | — | — | — | — | ✅ |
| `access.manage` | Custom user access | — | — | — | — | — | ✅ |
| `settings.manage` | *Defined, no route uses it* | ✅ | — | — | — | — | ✅ |
| `import.run` | *Defined, no route uses it (imports are CLI scripts)* | ✅ | — | — | — | — | ✅ |
| `export.run` | *Defined, no route uses it (export uses `worklog.report`)* | ✅ | — | — | — | — | ✅ |

## Move matrix

A move needs one permission from **every** group that applies (`movePermissionGroups`). The result by role:

| From → To | Super Admin | Admin | Prod. Supervisor | Mould Technician | Mould Maker |
|---|---|---|---|---|---|
| Storage → Machine | ✅ | ✅ | — | — | — |
| Storage → Production Floor | ✅ | ✅ | — | — | ✅ |
| Storage → Workshop | ✅ | ✅ | — | — | ✅ |
| Storage → other rack | ✅ | ✅ | — | — | ✅ |
| Machine/Floor → Machine | ✅ | ✅ | ✅ | ✅ | — |
| Machine → Floor | ✅ | ✅ | ✅ | ✅ | — |
| Machine/Floor → Storage | ✅ | ✅ | — | — | ✅ |
| Machine/Floor → Workshop | ✅ | ✅ | — | ✅ | ✅ |
| Workshop → Machine | ✅ | ✅ | ✅ | ✅ | — |
| Workshop → Floor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workshop → Storage | ✅ | ✅ | — | — | ✅ |
| Any ↔ Out of Service | ✅ | — | — | — | — |

"Storage" means the Mould Room (moulds) or the Tool Room (dies). Location rules (status Good, free machine, …) apply on top; see [Move a mould](../user-guide/move-a-mould.md).

## Enforcement
- Backend: `requirePermission` on every route (`backend/routes/table.js`), plus `canMove` / `can` inside the workflow functions.
- Each request reloads the user from the database, so role and active changes apply at once (`backend/middleware/authMiddleware.js`).
- Unauthorized: HTTP 403 "You do not have permission to do this" / `FORBIDDEN_MOVE`.
