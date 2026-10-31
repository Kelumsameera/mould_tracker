---
title: Work log
description: Record repair, service and other work on a mould, with photos and corrections
audience: Mould Technician, Mould Maker, Admins
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Work log

## Availability and role permissions
- **View** a mould's work log: `worklog.view` (everyone).
- **Log work:** `worklog.create`, held by Super Admin, Admin, Mould Technician and Mould Maker. Work can be logged **wherever the mould is**, including on a machine.

## Fields

| Field | Required | Rules |
|---|---|---|
| Type | Yes | Repair, Service, Minor fix, Inspection, Cleaning, Other |
| What was done (description) | Yes | Max 2000 |
| Parts used | No | Max 1000 |
| Time spent (minutes) | No | 0–100,000 |
| Done by | No (defaults to you) | 1–5 people, each allowed to do mould work |
| Done at | No (defaults to now) | Cannot be more than 2 minutes in the future |
| Shots (counter reading) | No | Whole number ≥ 0 |
| Outcome | No | OK, Needs repair, Needs service |
| Send to Workshop | No | Only with a Needs… outcome |
| Photos | No | Up to 3; JPEG/PNG/WebP, shrunk in the browser, max 6 MB each |

## What the outcome does

| Outcome | Effect |
|---|---|
| OK on a non-Good mould | Becomes **Good**, unless the shot limit is still reached and the type is not Service (warning `SERVICE_STILL_DUE`) |
| OK with type **Service** | Also resets shots to 0 and sets Last serviced |
| Needs repair / Needs service + Send to Workshop | Moves it to the Workshop with that status, if you may make the move (otherwise warning `WORKSHOP_MOVE_NOT_ALLOWED`) |
| Needs… without sending, on a machine or floor | Status flagged in place |
| Needs… while in storage | Entry saved, status unchanged, warning `WORKSHOP_MOVE_REQUIRED` |

The work itself never moves the mould; only **Send to Workshop** does.

## Corrections
Entries cannot be edited or deleted (append-only). To fix one, log a new entry that **corrects** it; the report marks the old one as corrected.

## Side effects
- The mould card shows **Last work** (type, names, date).
- Logging work on a mould with an open problem **resolves the problem** (audit `problem.resolved`).
- Audit `worklog.created` / `worklog.corrected`.

> Screenshot needed: Work log form with type Repair, two people and one photo.

## Evidence
`backend/lib/workLog.js` `planWorkLog`; `backend/controllers/workLogController.js` `createWorkLog`; `backend/models/WorkLog.js`; `backend/lib/images.js` `photosFromDataUrls`; `backend/test/workLog.test.js`; `frontend/src/components/WorkLogForm.tsx`.
