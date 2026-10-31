---
title: Install, language, theme and offline
description: Install the PWA or native app, switch language and theme, behaviour when offline
audience: All users
last_verified: 2026-10-29
app_version: "web/API 2.0.0; native 2.2.0"
status: Verified (static code review + tests)
---

# Install, language, theme and offline

## Language
**EN / සිං** toggle (sign-in card and sidebar). It is saved to your account, so it follows you to other devices. Sinhala uses the Noto Sans Sinhala font.

## Theme
Light / dark toggle. The choice is stored on the device (`mould-tracker-theme`); otherwise the system preference is used.

## Install
- **Install app** button (PWA). On iPhone/iPad: "In Safari, choose Share → Add to Home Screen…"
- Windows installer and Android APK: built by IT from `native/` (see [Deployment](../technical/deployment.md)).

## Offline
The service worker shows an offline page when the server cannot be reached, and the sync indicator shows "Offline — cannot reach server". **Changes cannot be made offline**; there is no offline queue.

## Old links
Bookmarks or QR links in the old `#/page/m/<id>` format are redirected to the new pages (`getLegacyDestination`).

## Evidence
`frontend/src/utils/i18n.ts`; `frontend/src/utils/helpers.ts`; `frontend/public/sw.js`, `offline.html`; `frontend/src/providers/PwaProvider.tsx`; `frontend/test/service-worker.test.mjs`, `theme.test.mjs`.
