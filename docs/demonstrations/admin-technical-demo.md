---
title: 30-minute administrator / technical demo
description: Administration, security and architecture walkthrough
audience: Presenter; audience = IT, admins, auditors
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Script derived from verified features; not rehearsed
---

# 30-minute administrator / technical demo

| Min | Topic | Show | Point out |
|---|---|---|---|
| 0–5 | Architecture | [architecture.md](../technical/architecture.md) diagram, `compose.yaml` | Mongo on an internal network; health checks |
| 5–10 | Rack management (Super Admin) | Add zone `DMC`, bulk generate A–A 1–3 with Preview, rename code | Preview counts; `rack.renamed` audit |
| 10–14 | Users | Create a Technician; as Admin try to edit a Super Admin | Refused |
| 14–18 | User access (System Administrator) | Give the Technician custom access without `workshop.work`, then Reset | Takes effect on the next request |
| 18–22 | Audit log | Filter Racks, Users | Before/after, reason, append-only |
| 22–25 | Concurrency | Edit the same mould in two windows | Second save → `STALE` |
| 25–28 | API | `GET /api/health`; `POST /api/moulds/:id/move` returning `MACHINE_OCCUPIED` JSON | Error envelope, codes |
| 28–30 | Tests | `cd backend && npm test` | 157 tests including every route × role |

## Optional interactive tour (proposal, not implemented)
| Step | Anchor (to verify) | Title | Role | Body |
|---|---|---|---|---|
| T1 | search input on `/find` | Find any mould | all | Search by Tool ID, item, machine or rack |
| T2 | first filter chip | Filter | all | Tap a chip to filter |
| T3 | first card | Open | all | Tap to see details and actions |
| T4 | Workshop link | Workshop queue | workshop roles | What needs attention |

Requirements: Next/Back/Skip, completion stored per user, keyboard accessible, respects reduced motion.
