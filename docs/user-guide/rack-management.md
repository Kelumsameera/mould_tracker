---
title: Rack management
description: Create and maintain Mould Room zones and racks
audience: Super Admin (Admin view-only)
last_verified: 2026-11-07
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Rack management

## Availability and role permissions
Route `/rack-admin`. Changes require `racks.manage`, which can be assigned through role or user access. Users with only `moulds.manage` see it read-only.

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
| Add one position | Zone, Rack (1–3 letters), Pallet/level (1–99), Position (1–999), Note (300). Location ID = `ZONE-RACK-PLEVEL-POSITION`, e.g. `FLK-A-P1-1`. Capacity is one mould. |
| Bulk generate positions | Rack letters, pallet range and position range. **Preview** shows new, restored and existing positions before creation. The default is A–C, P1–P3, positions 1–4 (36 per zone); at most 2000 can be generated in one request. |
| Edit position | Rack, pallet, position, in use and note. A code change is audited as `rack.renamed`. Capacity stays one. |
| Delete rack | Refused while it holds moulds: move them or disable the rack. |
| Delete row | Refused while any rack in the row holds moulds. |

Racks are soft-deleted; creating the same code again revives it.

## Evidence
`backend/controllers/rackController.js`; `backend/models/Rack.js`, `Zone.js`; `backend/lib/racks.js`; `frontend/src/app/(tracker)/rack-admin/page.tsx`.

> Screenshot needed: Bulk generate preview for zone FLK rows A–B, numbers 1–5.
