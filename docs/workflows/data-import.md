---
title: Data import and migration
description: Command-line scripts that load and upgrade data
audience: IT, developers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (script headers + tests); not run in this documentation pass
---

# Data import and migration

There is **no import screen**; imports are CLI scripts run from `backend/`. All are **dry runs unless `--apply`** is given.

| Script | Purpose | Key behaviour |
|---|---|---|
| `node scripts/import-moulds.mjs --file <xlsx> [--sheet …] [--apply] [--match "SHEET=DB"]` | Import moulds, items and pictures from the tools-list workbook | Tool ID match ignoring spaces → sheet values win, history stays. Near matches held back unless `--match`. **Nothing is deleted.** |
| `node scripts/attach-cleaned-pictures.mjs --dir <folder> [--apply]` | Point items at background-removed pictures | Originals kept for rollback |
| `node migrations/upgradeMouldModel.mjs [--apply]` | One-time copy from the old shared DB (`SOURCE_MONGODB_URI`, read-only) into this app's DB, upgrading Tool → Mould/Item/Movement and roles | Run once; recorded in `MigrationRun` |
| `node migrations/moveExtrusionToToolRoom.mjs [--apply]` | Move the 20 imported extrusion dies to the Tool Room | Only eligible dies |
| `migrations/importLegacy.mjs` | Legacy import (used by the upgrade) | Tested in `legacyMigration.test.js` |
| `npm run seed` | Development seed data | **Do not run against production** |
| `npm run migrate:supabase` | Old Supabase migration | Historic |

> Production safety: the live database is shared with another app. Never delete existing data; take a backup before any `--apply`. See [Operations](../administration/operations-and-recovery.md).

Evidence: script header comments; `backend/test/importMoulds.test.js`, `attachCleaned.test.js`, `legacyMigration.test.js`.
