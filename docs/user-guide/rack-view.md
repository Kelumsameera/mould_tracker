---
title: Rack view
description: Visual map of the Mould Room by zone, row and rack
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Rack view

## Availability
Route `/racks`, requires `racks.view` (every role).

## What you see
- Zone filter: **All zones** or one zone ("FLK side").
- Rows ("Row A") of racks, coloured: **empty rack**, **in use**, **full** (at capacity). Inactive racks show "Not in use".
- **Waiting for a rack:** moulds in the Mould Room with no rack yet (from import). Open one and choose a rack.
- Select a rack to see "Moulds on FLK-A3".

## Evidence
`frontend/src/app/(tracker)/racks/page.tsx`; `frontend/src/utils/helpers.ts` `rackTone`; `backend/controllers/rackController.js` `listRacks`.

> Screenshot needed: `/racks` with one zone, mixed empty / in use / full racks.
