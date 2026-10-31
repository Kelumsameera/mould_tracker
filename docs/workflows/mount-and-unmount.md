---
title: Mount and unmount
description: Get a mould from storage onto a machine and back again
audience: Mould Maker, Mould Technician, Production Supervisor, Admin
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (backend/test/workflow.test.js)
---

# Mount and unmount

**Trigger:** production needs a mould on a machine.

## Who does which step

Only Admins and Super Admins hold both `moves.mouldRoom` and `moves.machine`, so only they can go rack → machine directly. On the shop floor the move is a **two-person handoff**:

```mermaid
sequenceDiagram
    actor MM as Mould Maker
    actor MT as Technician / Supervisor
    participant API
    MM->>API: move to PRODUCTION_FLOOR (from rack)
    API-->>MM: OK, history MOVED
    MT->>API: move to MACHINE (machineId)
    alt machine occupied
        API-->>MT: 409 MACHINE_OCCUPIED
    else not listed for machine
        API-->>MT: 409 NOT_CAPABLE (Admin may override with reason)
    else shot limit reached
        API-->>MT: 409 SERVICE_DUE
    else
        API-->>MT: OK
    end
    Note over MT: ...production, Record shots...
    MT->>API: move to PRODUCTION_FLOOR
    MM->>API: move to MOULD_ROOM (rackId)
```

## Decision points
- Status must be **Good** (`NOT_GOOD`).
- The machine must be active and free; the mould must be listed for it or overridden.
- When going back to a rack: the rack must be active and not full; if the owner zone differs, a reason is required.

## Audit implications
Every move: `Movement` (from/to location, machine code, rack location ID, override reason) + `AuditLog` `mould.moved`.

Steps per screen: [Move a mould](../user-guide/move-a-mould.md).
