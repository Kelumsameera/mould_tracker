---
title: Install, language, theme and offline
description: Install the PWA or native app, switch language and theme, behaviour when offline
audience: All users
last_verified: 2026-11-13
app_version: "web/API 2.0.0; Windows 2.3.1; Android 2.3.0"
status: Verified (static code review + tests)
---

# Install, language, theme and offline

## Language
**EN / සිං** toggle (sign-in card and sidebar). It is saved to your account, so it follows you to other devices. Sinhala uses the Noto Sans Sinhala font.

## Theme
Light / dark toggle. The choice is stored on the device (`mould-tracker-theme`); otherwise the system preference is used.

## Install
- **Install app** button (PWA). On iPhone/iPad: "In Safari, choose Share → Add to Home Screen…"
- Windows installer and Android APK are available through the installation page. Windows 2.3.1 includes factory certificate setup for the current Windows user. Accept the Windows trust prompt during installation. Android embeds the factory CA in the APK.
- Connect to the workplace network. If the HTTPS installation link fails, use the HTTP installation link supplied by IT.
- Follow the complete [English and Sinhala installation guide](../public/user-guide/app-settings-and-install.md) for downloads, certificates, updates and connection help.
- IT build instructions are in [Deployment](../technical/deployment.md).

## සිංහල installation උපදෙස්

Workplace network එකට සම්බන්ධ වී installation පිටුවෙන් Windows installer එක හෝ Android APK එක download කරන්න. HTTPS installation link එක විවෘත නොවේ නම් IT අංශයෙන් ලබාදුන් HTTP installation link එක භාවිත කරන්න.

Windows 2.3.1 installer එකට factory certificate setup එක ඇතුළත්. Install කරන විට Windows trust prompt එක accept කරන්න. Certificate එක දැනට භාවිත කරන Windows user account එකට install වේ. Android APK එකට factory certificate එක ඇතුළත් නිසා වෙනම certificate setup කිරීම අවශ්‍ය නැත.

Download කිරීම, device එකට අදාළ installation පියවර සහ updates සඳහා [English සහ සිංහල installation guide එක](../public/user-guide/app-settings-and-install.md) බලන්න.

## Offline
The service worker shows an offline page when the server cannot be reached, and the sync indicator shows "Offline — cannot reach server". **Changes cannot be made offline**; there is no offline queue.

## Old links
Bookmarks or QR links in the old `#/page/m/<id>` format are redirected to the new pages (`getLegacyDestination`).

## Evidence
`frontend/src/utils/i18n.ts`; `frontend/src/utils/helpers.ts`; `frontend/public/sw.js`, `offline.html`; `frontend/src/providers/PwaProvider.tsx`; `frontend/test/service-worker.test.mjs`, `theme.test.mjs`.
