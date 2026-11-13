---
title: Rack view
description: Visual map of the Mould Room by zone, row and rack
audience: All users
last_verified: 2026-11-07
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Rack view

## Availability
Route `/racks`, requires `racks.view` (every role).

## What you see
- Zone filter: **All zones** or one zone ("FLK side").
- Blue rack frames (A, B, C), orange pallet shelves (P1, P2, P3), and numbered mould positions. Each physical position holds one mould. Inactive positions are dimmed.
- **Waiting for a rack:** moulds in the Mould Room with no rack yet (from import). Open one and choose a rack.
- Select a position to filter the location table. Search by mould ID, product ID, description or location.
- The table shows product IDs, descriptions, cavities and machine/size details from the stored records.

## Location format
`FLK-A-P1-1` means zone FLK, rack A, pallet/level P1, position 1. The initial layout has three racks, three pallets per rack and four positions per pallet: 36 positions per zone.

Existing locations were converted without changing their database IDs: A1 through A4 become A-P1-1 through A-P1-4; A5 becomes A-P2-1. Historical movement records retain their original location labels.

## Evidence
`frontend/src/app/(tracker)/racks/page.tsx`; `frontend/src/utils/helpers.ts` `rackTone`; `backend/controllers/rackController.js` `listRacks`.

> Screenshot needed: `/racks` with one zone, mixed empty / in use / full racks.
