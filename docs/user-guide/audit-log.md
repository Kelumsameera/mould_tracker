---
title: Audit log
description: Review every change with actor, before/after and reason
audience: Super Admin, System Administrator, auditors
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Audit log

## Availability
Route `/audit`, requires `audit.view` (Super Admin; System Administrator).

## What you see
Entries newest first, filterable by **Type** (Moulds, Items, Racks, Zones, Machines, Users, Imports, Migration). Each shows actor, action, label (Tool ID / rack location / email), **Before**, **After**, **Reason**. **Load more** pages through them ("n of total"); the API also supports action, actor, entity and date filters, with up to 200 per page.

## Recorded actions (verified)
`mould.created/updated/moved/status_changed/shots_recorded/deleted/restored`, `item.created/updated/deleted`, `machine.created/updated`, `zone.created/updated/deleted`, `rack.created/updated/renamed/deleted/bulk_generated/row_removed`, `user.created/updated/deleted`, `user.access.updated`, `worklog.created/corrected/exported`, `problem.resolved`, plus import and migration runs.

## Guarantees
Audit, movement and work-log records are **append-only**: the model plugin blocks updates and deletes through the application. Entries involving a protected System Administrator are hidden from other users.

## Evidence
`backend/models/AuditLog.js`; `backend/lib/immutable.js`; `backend/lib/audit.js`; `backend/controllers/auditController.js`; `frontend/src/app/(tracker)/audit/page.tsx`.
