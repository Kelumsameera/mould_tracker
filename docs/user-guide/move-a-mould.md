---
title: Move a mould
description: Mount on a machine, move to the floor, put on a rack, send to the Workshop
audience: Production Supervisor, Mould Technician, Mould Maker, Admins
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Move a mould

## Availability
Mould detail sheet → **Move or update**. Only the actions you may take are shown (`frontend/src/utils/permissions.ts` `canMoveTo`); the server checks again.

## Actions

| Button | Destination | Permission needed |
|---|---|---|
| Mount on a machine / Move to another machine | Machine | `moves.machine` (+ `moves.mouldRoom` if it is coming from storage) |
| To Production Floor | Production Floor | `moves.machine` (from the Workshop: `moves.machine` **or** `workshop.work`; from storage: `moves.mouldRoom`) |
| Put in Mould Room / Change rack | Mould Room rack | `moves.mouldRoom` |
| Put in Tool Room | Tool Room (dies) | `moves.mouldRoom` |
| Send to Workshop | Workshop | `workshop.work` (+ `moves.mouldRoom` if from storage) |
| Send out of service / Return to Workshop | Out of Service | `moves.outOfService` (Super Admin only) — see [Out of Service](../workflows/out-of-service.md) |

## Fields
- **Machine:** listed machines first ("Listed for this mould"), then "Other machines". Each shows "free" or "has X".
- **Rack:** shows occupancy `n/capacity`.
- **New status:** only when sending to the Workshop ("Keep current status" or choose one).
- **Remarks:** required when sending to the Workshop or Out of Service.
- **Reason for override:** required for a non-listed machine (Admins only) or another zone's rack.

## Rules
1. Only **Good** moulds may go anywhere except the Workshop/Out of Service (`NOT_GOOD`).
2. One mould per machine (`MACHINE_OCCUPIED`); take the other one off first.
3. Machine must be active (`MACHINE_INACTIVE`).
4. A mould at its shot limit cannot be mounted (`SERVICE_DUE`).
5. Non-listed machine: refused for non-Admins (`NOT_CAPABLE`); Admins must give a reason.
6. Rack must be active and not full (`RACK_INACTIVE`, `RACK_FULL`). A mould whose owner differs from the rack's zone needs a reason (`OWNER_MISMATCH`).
7. Same place again is refused (`NO_CHANGE`).
8. Sending to the Workshop with remarks also **closes an open problem report**.

## State changes
Location, machine and rack are updated; `lastMovedAt`/`lastMovedBy` are set; a `MOVED` history line and an `mould.moved` audit entry are written in one transaction. Overrides are stored with the reason.

## Example
Technician mounts `FLK19066` on `INJ-03`: Mould Room rack `FLK-A3` → Machine `INJ-03`. Needs both `moves.mouldRoom` and `moves.machine`; the Technician role has only `moves.machine`, so a **Mould Maker or Admin** must first take it to the floor, or an Admin mounts it. See [roles](../roles/permissions-matrix.md#move-matrix).

> Screenshot needed: Move sheet with the machine list showing "Listed for this mould" and "has X".

## Evidence
`backend/lib/workflow.js` (`movePermissionGroups`, `planMove`); `backend/controllers/mouldController.js` `moveMould`; `backend/test/workflow.test.js` ("who may move what"); `frontend/src/components/MouldActions.tsx`.
