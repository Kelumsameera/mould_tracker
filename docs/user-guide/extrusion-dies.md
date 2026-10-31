---
title: Extrusion dies
description: How extrusion dies differ from injection moulds
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Extrusion dies

## Availability
Route `/extrusion`, requires `moulds.view`. The screen is the same search screen as [Find a mould](find-a-mould.md), filtered to `toolType = EXTRUSION_DIE`.

## Rules that differ

| Rule | Injection mould | Extrusion die |
|---|---|---|
| Storage location | Mould Room (on a rack) | **Tool Room** (no rack) |
| Moving to the wrong store | Refused: "Use the Tool Room for extrusion dies and the Mould Room for injection moulds" | Same |
| Workshop, machine, floor, shots, work log | Same rules | Same rules |

Moving into or out of the Tool Room needs `moves.mouldRoom`, the same as the Mould Room.

## Evidence
`backend/lib/mouldState.js` (`storageLocation`, `isStorage`); `backend/migrations/moveExtrusionToToolRoom.mjs`; `backend/test/toolRoom.test.js`; `frontend/src/app/(tracker)/extrusion/page.tsx`.
