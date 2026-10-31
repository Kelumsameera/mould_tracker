---
title: Workshop queue and status changes
description: See what needs workshop attention and change a mould's condition at the Workshop
audience: Mould Maker, Mould Technician, Admins
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Workshop queue and status changes

## Availability
- Page `/workshop` (**Workshop queue**) requires `moulds.view`, so everyone can see it.
- **Change status** requires `workshop.work`: Super Admin, Admin, Mould Technician, Mould Maker.

## What the queue shows
The page makes three requests and shows:

| Section | Source |
|---|---|
| Problem reports (count badge) | moulds with an open problem (`problem=true`) |
| **At the Workshop** | `location = WORKSHOP`, with "since …" |
| **Flagged elsewhere (send to Workshop)** | Needs/In service or repair but not at the Workshop |

If all are empty: "Nothing waiting. 👍"

## Change status — steps
1. Open a mould **at the Workshop**.
2. Select **Change status**, choose the **New status** and enter **Remarks** (required).
3. Select **Confirm**.

## Rules
- Only at the Workshop (`NOT_AT_WORKSHOP`); the status must differ (`NO_CHANGE`).
- **In service → Good** resets `totalShots` to 0 and sets **Last serviced**.
- Any other status → **Good** while the shot limit is reached is refused (`SERVICE_DUE`): service it first.
- Writes a `STATUS_CHANGED` history line and an audit entry.

## Statuses

| Status | Meaning | Allowed locations |
|---|---|---|
| Good | Ready to use | Anywhere |
| Needs service / Needs repair | Flagged | Machine, Production Floor, Workshop, Out of Service (never storage) |
| In service / In repair | Being worked on | Workshop or Out of Service only |

> Screenshot needed: `/workshop` with moulds in both sections.

## Evidence
`frontend/src/app/(tracker)/workshop/page.tsx`; `backend/lib/workflow.js` `planStatus`; `backend/lib/mouldState.js` `mouldStateError`.
