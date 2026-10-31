---
title: Users
description: Create, edit, disable and delete user accounts
audience: Admin, Super Admin, System Administrator
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Users

## Availability
Route `/users`, requires `users.manage` (Super Admin, Admin, System Administrator).

## Fields
Name (max 120), Email (unique), Password (8–128, create or reset), Role (default Mould Technician), Active.

## Who can manage whom

| Actor | Can manage | Can assign roles |
|---|---|---|
| Admin | Everyone except Super Admins and System Administrators | Everything except Super Admin and System Administrator |
| Super Admin | Everyone except System Administrators | Everything except System Administrator |
| System Administrator | Everyone, but other System Administrator accounts are invisible | All roles |

## Rules
- You cannot disable yourself, change your own role or delete yourself.
- **Delete** is soft: the account is marked deleted and inactive; its history stays.
- Changes take effect on the user's **next request**; there is no need to wait for the session to expire.
- Every action is audited (`user.created`, `user.updated`, `user.deleted`).

## Evidence
`backend/controllers/userController.js`; `backend/lib/permissions.js` `canManageUser`; `frontend/src/utils/permissions.ts` `assignableRoles`; `backend/test/auth.test.js`.
