---
title: First login
description: Sign in, set your language and theme, change your password and optionally add a passkey
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review); not walked through on a running instance
---

# First login

**Goal:** sign in, secure your account and land on **Find a mould**.

## Before you begin

See [Prerequisites](prerequisites.md).

## Steps

1. Open the app address. Signed-out users see the sign-in card ("Sign in to see where every mould is.").
2. *(Optional)* Choose **EN** or **සිං** at the top of the card, and the light/dark theme toggle.
3. Enter **Email** and **Password**, then select **Sign in**.
4. You arrive on **Find a mould** (`/find`), the default page.
5. Open **Account details** from the sidebar. Enter your **Current password**, a **New password (min 8 characters)**, repeat it, and select **Save changes**.
6. *(Optional, HTTPS only)* Open **Passkeys / Biometric login** in the sidebar. Enter a device name and your current password, then select **Add a passkey**. Next time you can use **Sign in with fingerprint / Face ID**.

> Screenshot needed: sign-in card in light theme, English, with the passkey button visible (`/login`).
> Screenshot needed: Account details page (`/account`) with the password fields.

## Expected result

- You are signed in. The session is an HttpOnly cookie valid for 7 days (`backend/utils/session.js`).
- Your language choice is saved to your account and follows you to other devices (`PATCH /api/auth/me/language`).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Invalid email or password" | Wrong credentials, or the account is disabled | Retry; ask an Admin to check the account is active |
| "Too many authentication attempts…" | Rate limit (40 per 10 min) | Wait 10 minutes |
| Passkey button disabled; note says passkeys need trusted HTTPS | Server not configured for passkeys, or plain HTTP | Use password; IT sets `WEBAUTHN_ORIGIN` / `WEBAUTHN_RP_ID` |
| "Passkey request was cancelled or timed out." | Prompt dismissed | Try again |
| Signed out unexpectedly | Account disabled/deleted, or session expired | Sign in again; contact an Admin |

Related: [Navigation tour](navigation-tour.md) · [Quick start](quick-start.md) · [Account and passkeys](../user-guide/account-and-passkeys.md)
