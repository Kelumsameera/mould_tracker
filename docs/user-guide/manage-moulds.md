---
title: Manage moulds and items
description: Add, edit, delete and restore moulds; manage items and item pictures
audience: Admin, Super Admin
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Manage moulds and items

## Availability and role permissions
Requires `moulds.manage`, held by Super Admin, Admin and System Administrator. Other roles do not see these buttons, and the API returns 403.

## Navigation
- **Add mould:** on Find a mould / Extrusion die.
- **Edit mould / Delete mould / Restore mould:** in the mould detail sheet.

## Fields — mould

| Field | Required | Rules |
|---|---|---|
| Tool ID | Yes | Max 100, stored uppercase, unique. A duplicate that differs only in spacing is refused (`DUPLICATE_TOOL_ID`). |
| Tool type | No | Injection mould (default) or extrusion die |
| Tool set count, Size | No | Max 50 characters each |
| Owner (zone) | No | Zone code, letters and digits, max 10 |
| Capable machines | No | Comma separated, max 50; codes are normalised |
| Shots to service | No | Whole number ≥ 0; empty means no limit |
| Notes | No | Max 2000 |
| Starts at | Create only | Mould Room (default), Tool Room, Production Floor or Workshop. Never a machine. Mould Room needs a rack. |
| Items | No | Up to 100 at creation |

## Fields — item

Item ID (required, uppercase, unique within the mould), Description (500), Cavities (whole number), QAS, Material ID and description, Masterbatch ID and description, Notes (1000), Sort order, and a **picture** (edit only; JPEG/PNG/WebP, saved as an 800 px WebP plus a 200 px thumbnail).

## Actions

1. **Add:** fill the form, choose **Starts at** (and a rack for the Mould Room), add items, then save. The status is always **Good**.
2. **Edit:** change fields and save. The form sends the mould's `version`; if someone else changed it first you see "…was changed by someone else. Refresh and try again."
3. **Delete:** enter an optional reason and confirm. This is a soft delete: history and items are kept.
4. **Restore:** open a deleted mould and select **Restore mould**.

## Rules and state changes
- A mould **on a machine cannot be deleted**: "Take … off the machine before deleting it".
- Restore fails if another mould has since taken the Tool ID.
- Changing Shots to service can immediately flag the mould **Needs service** (rule 8) when it is outside storage.
- Every change writes a History line (`CREATED`, `EDITED`, `DELETED`, `RESTORED`) and an Audit log entry.

## Errors

| Code | Meaning |
|---|---|
| `DUPLICATE_TOOL_ID` | Tool ID exists (or exists deleted: restore it instead) |
| `STALE` | Someone else saved first |
| `NO_CHANGE` | Nothing changed |
| `UNMOUNT_FIRST` | Mould is on a machine |
| `INVALID_PHOTO` / `TOO_LARGE` | Picture unreadable or too big |

> Screenshot needed: Add mould form with one item filled in.

## Evidence
`backend/controllers/mouldController.js` (`createMould`, `updateMould`, `deleteMould`, `restoreMould`, `addItem`, `updateItem`, `deleteItem`); `backend/validators/schemas.js`; `backend/lib/images.js`; `frontend/src/components/MouldFormSheet.tsx`; `backend/test/itemPhoto.test.js`, `mouldModel.test.js`.
