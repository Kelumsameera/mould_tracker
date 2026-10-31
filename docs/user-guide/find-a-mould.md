---
title: Find a mould
description: Search, filter and open injection moulds
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Find a mould

## Availability
Route `/find` (also the default page). Requires `moulds.view`, which every role has by default.

## Navigation
Sidebar → **Find a mould**.

## Fields and controls

| Control | Behaviour |
|---|---|
| Search ("Tool ID, Item ID, description, machine or rack") | Case-insensitive. Matches Tool ID (ignoring spaces), mould notes, Item ID, item description, machine code or name, rack location (for example `FLK A3` → `FLK-A3`) and capable machines. |
| Filter chips | Counts by location, **Service / repair** (Needs/In service/repair), **No rack yet**. Select a chip to filter; **Show all** clears it. |
| Cards | Tool ID, status badge, location, number of items, first picture, last work and **Service due** marker. |
| Sorting | Tool ID in natural numeric order (`FLK2` before `FLK10`). |
| Refresh | Automatically every 10 s; sync indicator shows Live / Offline. |

There is no pagination: all matching moulds are returned.

## Actions
Select a card to open the [mould detail sheet](../getting-started/navigation-tour.md#mould-detail-sheet). Admins also see **Add mould** ([Manage moulds](manage-moulds.md)).

## Rules
- Deleted moulds are hidden. Admins can list them with the API filter `deleted=true`.
- `/find` shows injection moulds only; extrusion dies are on [`/extrusion`](extrusion-dies.md).

## Examples
- `19066` → finds `FLK19066`.
- `INJ-03` → moulds on, or listed for, machine INJ-03.

## Errors
"No mould matches your search." means no results. "Offline — cannot reach server" means a network problem; see [troubleshooting](../support/troubleshooting.md).

> Screenshot needed: `/find` with search text `FLK` and the Service / repair chip selected.

## Evidence
`backend/controllers/mouldController.js` `listMoulds`, `mouldStats`; `frontend/src/components/MouldSearch.tsx`; `frontend/src/utils/i18n.ts` (`search`, `dash`).
