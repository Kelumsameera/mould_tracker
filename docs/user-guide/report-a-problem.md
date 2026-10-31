---
title: Report a problem
description: Flag an issue on a mould without changing its status or location
audience: Everyone (especially Production Supervisors)
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Report a problem

## Availability
Mould detail sheet → **Report a problem**. Requires `problem.report`, which every role has.

## Steps
1. Open the mould.
2. Select **Report a problem**, describe it (required, max 2000), and optionally add up to 3 photos and the time it happened.
3. Submit.

## Expected result
- The mould gets a problem badge and appears under problem reports on the [Workshop queue](workshop-queue.md).
- **Status and location do not change.**
- A work-log entry (type Inspection, marked "problem reported") is stored with you as reporter.

## How a problem is closed
Automatically, when someone **logs work** on the mould or **sends it to the Workshop**. Both write an audit entry `problem.resolved`.

## Evidence
`backend/lib/workLog.js` `planProblemReport`; `backend/controllers/workLogController.js` `reportProblem`, `resolveProblem`; `backend/controllers/mouldController.js` `moveMould`; `frontend/src/components/ProblemForm.tsx`.
