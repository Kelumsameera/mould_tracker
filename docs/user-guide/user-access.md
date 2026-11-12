---
title: User access (custom permissions)
description: Replace a user's role defaults with a custom permission set
audience: System Administrator
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# User access

## Availability
Route `/access`, requires `access.manage`. Only the System Administrator role has it, and it can never be granted.

## Steps
1. Select **Role access**, choose a role, tick permissions, and save. These permissions apply to existing and future users inheriting that role.
2. **Reset to built-in defaults** restores the original permissions for that role.
3. For an individual exception, select **User access**, find a user, choose permissions, and save.
4. **Reset to role defaults** removes that user's custom set so they inherit the configured role permissions.

## Rules
- A custom set **replaces** the role defaults entirely. An empty set allows only sign-in and managing your own account.
- Individual custom access takes priority over configured role access, which takes priority over built-in defaults.
- `moves.outOfService` can only be given to Super Admins.
- System Administrator accounts cannot be restricted.
- Effective immediately on the server; the UI refreshes permissions on focus and every minute.
- Audited as `user.access.updated`.
- Role changes are audited as `role.access.updated` and can only be made by a System Administrator.

## Evidence
`backend/controllers/userController.js` `listUserAccess`, `updateUserAccess`; `backend/lib/permissions.js` `can`; `frontend/src/app/(tracker)/access/page.tsx`; `frontend/src/components/AppLayout.tsx` (60 s refresh); root `README.md`.
