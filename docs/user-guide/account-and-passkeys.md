---
title: Account details and passkeys
description: Change your name, email and password; add and remove passkeys
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Account details and passkeys

## Account details (`/account`)
- Change **Name**, **Email** and optionally **New password (min 8 characters)** (repeat it).
- **Current password** is always required. Leave the new password blank to keep the current one.
- Errors: "Current password is incorrect", "The two new passwords do not match", "Email already in use".

## Passkeys (`/passkeys`)
- **Add a passkey:** give a **Device name** and your **Current password**, then follow the device prompt (fingerprint, Face ID or PIN).
- **Remove:** requires your current password.
- Only the public key is stored on the server; biometric data stays on the device.
- Requires the server to be configured with a trusted HTTPS origin. Otherwise the page shows "Passkeys need a trusted HTTPS address and a supported browser." Password sign-in always remains available.
- Not available in the Android/Windows shells (`native/README.md`).

## Evidence
`backend/controllers/authController.js` `updateProfile`; `backend/controllers/passkeyController.js`; `backend/utils/passkeyConfig.js`; `frontend/src/app/(tracker)/account/page.tsx`, `passkeys/page.tsx`; `backend/test/profile.test.js`, `auth.test.js`.
