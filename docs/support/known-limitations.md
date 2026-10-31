---
title: Known limitations
description: Current behaviour limits, separated from recommendations and roadmap
audience: Everyone; product owner
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified
---

# Known limitations

## Current behaviour
- No offline editing or queued changes.
- No notifications (email, push, SMS) for service-due moulds or problems.
- No QR/barcode scanning or label printing.
- No scheduled/preventive maintenance by date; service is driven by shot count only.
- Shots are entered manually (no machine counter integration).
- The mould list is not paginated; all matches load (fine at the current size, may slow with thousands).
- No UI to add a machine (API only).
- No import screen; imports are CLI scripts.
- `settings.manage`, `import.run` and `export.run` permissions exist but do nothing.
- Passkeys don't work in the native shells.
- Windows installer unsigned; no iOS/macOS release.
- Work-log date ranges use the Asia/Colombo time zone.
- Work-log export capped at 5,000 rows.

## Recommended improvements
See [security-and-access.md](../administration/security-and-access.md#recommended-improvements-not-implemented) and [GAPS](../analysis/GAPS-AND-QUESTIONS.md).

## Future roadmap
Not defined in the repository. *Requires product-owner input.*
