---
title: Demo data and reset
description: Safe, fictional dataset and environment for demonstrations
audience: Presenters, IT
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Planned / proposed (dataset spec); seed script exists but its contents were not reviewed for demo fitness
---

# Demo data and reset

> **Never demo on production.** The production database is shared with another app and holds real data.

## Environment
A disposable local stack ([local development](../technical/local-development.md)) or a separate Compose project with its own volumes and its own `MONGODB_URI`.

## Accounts (create via Users; fictional)
| Email | Role |
|---|---|
| super@demo.local | Super Admin |
| admin@demo.local | Admin |
| supervisor@demo.local | Production Supervisor |
| tech@demo.local | Mould Technician |
| maker@demo.local | Mould Maker |

Use demo-only passwords; do not reuse real ones.

## Dataset (proposed)
| Kind | Values |
|---|---|
| Zones | `DMA` (Demo A), `DMB` (Demo B) |
| Racks | Bulk generate `DMA` rows A–B, numbers 1–4, capacity 2 |
| Machines | `DEMO-01`, `DEMO-02` (create via API `POST /api/machines`, or the seed) |
| Moulds | `DEMO100` (rack DMA-A1, owner DMA, capable DEMO-01, shots to service 1000), `DEMO200` (Workshop, Needs repair), `DEMO300` (DEMO-02), die `DIE900` (Tool Room) |
| Items | `DEMO100` → item `ITM-100` "Demo cup", 4 cavities |

## Reset
Drop the **demo** database only (or `docker compose -p demo down -v`), then recreate. Because history is append-only, resetting means a fresh database, not undoing actions.
