---
title: Shot count and service
description: How shots accumulate, when a mould becomes service-due, and how the count resets
audience: Supervisors, Technicians, Admins
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (backend/lib/workflow.js rule 8)
---

# Shot count and service

```mermaid
flowchart TD
    A[Mounted, Good] -->|Record shots| B{totalShots >= shotsToService?}
    B -->|No| A
    B -->|Yes| C[Auto: Needs service + history line]
    C --> D[Send to Workshop]
    D --> E[Change status: In service]
    E --> F[Change status: Good]
    F --> G[totalShots = 0, Last serviced = now]
    H[Work log: type Service, outcome OK] --> G
```

## Rules
- Only applies when **Shots to service** is set (> 0).
- Auto-flag happens only for **Good** moulds **outside storage**. In storage the status stays Good, but mounting is refused with `SERVICE_DUE`.
- Setting **Good** directly from Needs/In repair while still over the limit is refused; it must go through **In service**.
- A work-log entry of type **Service** with outcome **OK** also resets the count, wherever the mould is.
- The stats endpoint counts `serviceDueNotFlagged` (over the limit but still Good, for example in storage).

Evidence: `planShots`, `serviceDueChange`, `planStatus` in `backend/lib/workflow.js`; `planWorkLog` in `backend/lib/workLog.js`; `mouldStats` in `backend/controllers/mouldController.js`.
