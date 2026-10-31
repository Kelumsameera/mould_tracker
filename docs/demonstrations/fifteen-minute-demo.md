---
title: 15-minute operational demo
description: Full shop-floor cycle across roles
audience: Presenter; audience = supervisors, technicians, makers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Script derived from verified features; not rehearsed
---

# 15-minute operational demo

Use two browsers (or one normal and one private window) to switch roles quickly.

| # | Role | Action | Expected result |
|---|---|---|---|
| 1 | Maker | `DEMO100` → **To Production Floor** | Location Production Floor |
| 2 | Supervisor | Try **Put in Mould Room** | Not offered (no storage permission) |
| 3 | Technician | **Mount on a machine** → `DEMO-01` | On DEMO-01 |
| 4 | Supervisor | **Record shots** 1,200 | Auto **Needs service**; "Service due"; history "Shot limit reached (1200/1000 shots)" |
| 5 | Technician | Try **Mount** on DEMO-02 | Refused: only to the Workshop |
| 6 | Supervisor | **Report a problem** "Flash on cavity 2" + photo | Problem badge; on the Workshop queue; status unchanged |
| 7 | Technician | **Send to Workshop**, remarks "Service + flash" | At the Workshop; problem resolved |
| 8 | Maker | **Change status** → In service (remarks) | In service |
| 9 | Maker | Log work: Service, 45 min, parts "O-ring", outcome OK, done by Maker + Technician | Good, shots reset to 0, Last serviced today |
| 10 | Maker | **Put in Mould Room** → `DMB-A1` | Owner mismatch → give a reason → stored |
| 11 | Admin | **Work log report**, range Today → export XLSX | File with "Work log" + "About this export" sheets |

Business value: enforced rules, no lost moulds, service by usage, full accountability.
Reset: [demo-data-and-reset.md](demo-data-and-reset.md).
