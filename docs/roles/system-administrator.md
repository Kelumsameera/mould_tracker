---
title: System Administrator
description: The protected all-permission role for IT
audience: IT / System Administrators
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# System Administrator (`system_admin`)

## Properties
- Holds every permission, including `access.manage` (User access).
- **Protected:** the account is visible only to its owner, even to other System Administrators. Super Admins and Admins cannot list, edit, delete or assign this role.
- In history, reports and exports seen by others, the person appears as **Private user**. Audit entries involving the account are excluded from other users' results.

## Provisioning
No default credentials exist. Set `SYSTEM_ADMIN_NAME`, `SYSTEM_ADMIN_EMAIL` and `SYSTEM_ADMIN_PASSWORD` in the backend's local environment, then run `npm run create:system-admin` in `backend/`. The command only creates a new account; it never promotes or overwrites an existing one.

## Evidence
`backend/lib/permissions.js` (`canViewUser`, `canManageUser`); `backend/lib/accountPrivacy.js`; `backend/middleware/accountPrivacy.js`; `backend/scripts/create-system-admin.mjs`; root `README.md`.
