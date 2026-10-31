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
1. Find a user by name or email and select them.
2. The page shows **Role defaults**. Switch to **Custom access** and tick permissions (labels such as "Record work", "View and export work reports").
3. Save. **Reset to role defaults** removes the custom set.

## Rules
- A custom set **replaces** the role defaults entirely. An empty set allows only sign-in and managing your own account.
- `moves.outOfService` can only be given to Super Admins.
- System Administrator accounts cannot be restricted.
- Effective immediately on the server; the UI refreshes permissions on focus and every minute.
- Audited as `user.access.updated`.

## Evidence
`backend/controllers/userController.js` `listUserAccess`, `updateUserAccess`; `backend/lib/permissions.js` `can`; `frontend/src/app/(tracker)/access/page.tsx`; `frontend/src/components/AppLayout.tsx` (60 s refresh); root `README.md`.
