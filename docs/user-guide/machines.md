---
title: Machines
description: View machines and their mounted moulds; rename and enable/disable machines
audience: Admin, Super Admin
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Machines

## Availability
Page `/machines` requires `moulds.manage`. The API list (`GET /api/machines`) only needs `moulds.view`, because the move sheet uses it.

## Actions in the UI
- Search by machine code, name or mounted mould.
- **View / edit details:** change **Machine name** and **Active / Inactive**.
- The machine code is fixed: "Machine code is fixed to preserve mould compatibility records."

## Rules
- A machine with a mounted mould cannot be disabled (`MACHINE_OCCUPIED`): "Take the mould off this machine before disabling it."
- Inactive machines cannot receive moulds.

## Not in the UI
Creating a machine is supported by the API (`POST /api/machines`, `moulds.manage`), but the `/machines` page has no add button. Machines are otherwise created by the seed and import scripts. See [GAPS](../analysis/GAPS-AND-QUESTIONS.md).

## Evidence
`frontend/src/app/(tracker)/machines/page.tsx`; `backend/controllers/machineController.js`; `backend/routes/machineRoutes.js`.
