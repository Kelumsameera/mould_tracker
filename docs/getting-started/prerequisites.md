---
title: Prerequisites
description: What a user needs before signing in to Mould Tracker
audience: All users; support
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Prerequisites

**Goal:** be ready to sign in on your first day.

## Before you begin

| You need | Why | Evidence |
|---|---|---|
| An account (email + password) created by an Admin, Super Admin or System Administrator | There is no self-registration | `backend/routes/userRoutes.js` (`users.manage`) |
| A role chosen for you | Your role decides what you can do | `backend/lib/permissions.js` |
| The factory app address (ask your supervisor/IT) | The app runs on the factory server | `deploy/README.md` |
| Network access to that server (factory LAN) | Native shells and the PWA need the server | `native/README.md` |
| A current browser, or the Windows / Android app | Supported clients | [Product overview](../product-overview.md) |
| *Optional:* trusted HTTPS and a device with fingerprint/Face ID/PIN | Needed only for passkey sign-in | `backend/utils/passkeyConfig.js` |
| *Optional:* the factory certificate installed on the device | The LAN uses a local certificate authority | `deploy/LOCAL-HTTPS.md` |

## Passwords

- Minimum 8 characters, maximum 128 (`backend/validators/schemas.js` `password`).
- Too many sign-in attempts are throttled: 40 per 10 minutes per client (`backend/routes/authRoutes.js` `loginLimit`).

## Expected result

You have an email, a temporary password and the app address.

Related: [First login](first-login.md) · [Security and access](../administration/security-and-access.md)
