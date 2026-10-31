---
title: Rack management
description: Create and maintain Mould Room zones and racks
audience: Super Admin (Admin view-only)
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Rack management

## Availability and role permissions
Route `/rack-admin`. Changes require `racks.manage` (Super Admin). Admins (`moulds.manage`) see it read-only: "View only — only a Super Admin can change zones and racks."

## Zones
| Action | Rules |
|---|---|
| Add zone | Code: letters and digits, max 10, unique; Name required; Order |
| Rename / Change code | Changing the code renames every rack location ID in that zone |
| Disable / Enable | A disabled zone's racks cannot receive moulds |
| Delete | Refused while any rack in the zone holds moulds (`RACK_OCCUPIED`) |

## Racks
| Action | Rules |
|---|---|
| Add one rack | Zone, Row (1–3 letters), Number (1–999), Capacity (empty = unlimited), Note (300). Location ID = `ZONE-ROWNUMBER`, e.g. `FLK-A3`. |
| Bulk generate racks | Rows from…to, numbers from…to, capacity. **Preview** first shows "n new / n restored / n already exist", then **Create n racks**. |
| Edit rack | Row, number, capacity, in use, note. A code change is audited as `rack.renamed`. |
| Delete rack | Refused while it holds moulds: move them or disable the rack. |
| Delete row | Refused while any rack in the row holds moulds. |

Racks are soft-deleted; creating the same code again revives it.

## Evidence
`backend/controllers/rackController.js`; `backend/models/Rack.js`, `Zone.js`; `backend/lib/racks.js`; `frontend/src/app/(tracker)/rack-admin/page.tsx`.

> Screenshot needed: Bulk generate preview for zone FLK rows A–B, numbers 1–5.
