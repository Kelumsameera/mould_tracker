---
title: 5-minute tour
description: Scripted short demo for managers and new users
audience: Presenter; audience = managers, new staff
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Script derived from verified features; not rehearsed on a running instance
---

# 5-minute tour

Prerequisites: [demo data](demo-data-and-reset.md), signed in as **admin@demo.local**, on a phone or a narrow window.

| # | Screen | Narrator script | Clicks | Expected result | Value |
|---|---|---|---|---|---|
| 1 | `/find` | "Every mould, where it is and its condition, live." | Type `DEMO` | 3 cards, status badges, locations | One source of truth |
| 2 | Detail sheet | "Here's what this mould makes and its full history." | Tap `DEMO100` | Items, shots, history | Traceability |
| 3 | Move | "Moving is guarded by rules." | **Mount on a machine** → `DEMO-02` (not listed) | Admin override reason requested | Prevents wrong machine |
| 4 | Move | — | Choose `DEMO-01` → Confirm | Card shows the machine; history line added | Audit trail |
| 5 | `/workshop` | "What needs attention right now." | Open Workshop queue | `DEMO200` at the Workshop | Maintenance visibility |
| 6 | `/racks` | "The Mould Room at a glance." | Rack view, zone DMA | Empty / in use / full colours | Find space fast |

Cleanup: none needed (demo DB), or move `DEMO100` back to `DMA-A1`.
