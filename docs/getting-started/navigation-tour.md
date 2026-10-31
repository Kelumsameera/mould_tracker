---
title: Navigation tour
description: The sidebar, pages, search, mould cards and the mould detail sheet
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Navigation tour

## Sidebar

The sidebar collapses on desktop (**Expand menu / Collapse menu**) and becomes a menu on phones. Links only appear when you hold the permission (`frontend/src/components/Sidebar.tsx`, `frontend/src/utils/permissions.ts` `canVisitPage`).

| Link | Route | Shown when you have | Purpose |
|---|---|---|---|
| Find a mould | `/find` | `moulds.view` | Search and browse injection moulds |
| Extrusion die | `/extrusion` | `moulds.view` | The same screen for extrusion dies |
| Rack view | `/racks` | `racks.view` | Mould Room map by zone and row |
| Workshop queue | `/workshop` | `moulds.view` | Moulds at the Workshop or flagged elsewhere |
| User access | `/access` | `access.manage` (System Administrator) | Custom permissions per user |
| Machines | `/machines` | `moulds.manage` | Machine list, add, rename, enable/disable |
| Users | `/users` | `users.manage` | Create, edit, disable, delete users |
| Work log report | `/work-report` | `worklog.report` | Search, summarise and export work |
| Rack management | `/rack-admin` | `racks.manage`, or `moulds.manage` (view only) | Zones and racks |
| Audit log | `/audit` | `audit.view` | Every change with before/after |
| Account details | `/account` | everyone | Name, email, password |
| Passkeys / Biometric login | `/passkeys` | everyone | Manage passkeys |
| Sign out | — | everyone | End the session |

Opening a page without permission shows nothing useful, and the API refuses the data with HTTP 403.

## Find a mould

- **Search box:** "Tool ID, Item ID, description, machine or rack". Spacing is ignored (`FLK 19066` finds `FLK19066`); a rack like `FLK A3` finds rack `FLK-A3`.
- **Filter chips** show counts (All, Service / repair, No rack yet, by location and status) from `GET /api/moulds/stats`.
- **Cards** show Tool ID, status badge, location line, item count, picture thumbnail, last work and "Service due".
- The list refreshes **every 10 seconds**. The sync indicator shows "Live — synced with server" or "Offline — cannot reach server".

## Mould detail sheet

Tap a card to open the sheet (`?mould=<id>` in the URL, so it can be bookmarked). It shows:

- Items made by this mould (pictures open in a lightbox), capable machines, shots, last serviced, owner (zone), tool set, size, notes, latest remarks.
- **Move or update** actions you are allowed to take (others are hidden; if none: "You can view this mould but not move it.").
- Work log, **Report a problem**, and **History**.
- For Admins: **Edit mould**, **Delete mould**, **Restore mould**.

> Screenshot needed: Find page on a phone with filter chips and two cards.
> Screenshot needed: Mould detail sheet showing actions and history.

Related: [User guide](../user-guide/README.md)
