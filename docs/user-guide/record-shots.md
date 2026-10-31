---
title: Record shots
description: Add produced shots to a mounted mould and trigger service-due
audience: Production Supervisor, Mould Technician, Mould Maker, Admins
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Record shots

## Availability
Mould detail sheet → **Record shots**. Requires `moves.machine` or `workshop.work`.

## Fields
**Shots produced:** whole number from 1 to 10,000,000. The number is **added** to the running total.

## Rules and state changes
- The mould must be **on a machine** (`NOT_ON_MACHINE`).
- When `totalShots ≥ shotsToService` and the mould is Good, it becomes **Needs service** automatically. A `STATUS_CHANGED` history line says "Shot limit reached (n/limit shots)".
- After that it can only go to the Workshop. A completed service resets the count. See [Shot count and service](../workflows/shot-count-and-service.md).

## Example
Limit 100,000, total 98,000. Record 3,000 → total 101,000 → **Needs service**; the card shows **Service due**.

## Evidence
`backend/lib/workflow.js` `planShots`, `serviceDueChange`; `backend/controllers/mouldController.js` `recordShots`.
