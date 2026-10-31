---
title: Problem to repair
description: From a problem report to a resolved, repaired mould
audience: All roles
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified
---

# Problem to repair

```mermaid
sequenceDiagram
    actor PS as Anyone (e.g. Supervisor)
    actor MT as Technician / Maker
    participant M as Mould
    PS->>M: Report a problem (text, photos)
    Note over M: openProblem set, status/location unchanged, shown on Workshop queue
    alt Fix in place
        MT->>M: Log work (e.g. Minor fix, outcome OK)
    else Needs workshop
        MT->>M: Send to Workshop (remarks) or log work with Needs repair + Send to Workshop
    end
    Note over M: openProblem cleared, audit problem.resolved
```

**Failure paths:** a Supervisor cannot move to the Workshop; they hand over to a Technician/Maker. When a Needs… outcome is logged while the mould is in storage, the entry is saved with warning `WORKSHOP_MOVE_REQUIRED`.

Related: [Report a problem](../user-guide/report-a-problem.md) · [Work log](../user-guide/work-log.md)
