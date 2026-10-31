---
title: Out of Service (external repair)
description: Send a mould outside the factory and return it to the Workshop
audience: Super Admin
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Out of Service

**Actor:** Super Admin only (`moves.outOfService` cannot be granted to anyone else).

## Send out
1. Open the mould → **Send out of service**.
2. Enter **Recipient / Company name** (max 150), **Address** (max 500) and **Repair details** (max 2000; also used as remarks).
3. Confirm. The details are stored with `sentAt`, both on the mould and in the movement history.

## Return
1. Open the mould → **Return to Workshop**. Remarks are required.
2. `returnedAt` is stamped. The mould arrives at the **Workshop**; from there the normal [repair cycle](workshop-repair-cycle.md) applies.

## Rules
- The status cannot be changed while Out of Service (`OUT_OF_SERVICE_STATUS`): return it first.
- The dispatch details are a snapshot. Later dispatches never rewrite earlier history.

Evidence: `backend/lib/workflow.js` `planMove`; `backend/models/DispatchDetails.js`; `backend/lib/outOfService.js`; `frontend/src/components/DispatchDetails.tsx`.
