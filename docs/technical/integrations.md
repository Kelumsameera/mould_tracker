---
title: Integrations
description: External systems the app talks to
audience: Developers, IT
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (absence confirmed by dependency and code review)
---

# Integrations

| Integration | Present? | Notes |
|---|---|---|
| MongoDB | Yes | Only data store |
| WebAuthn (browser platform authenticators) | Yes | `@simplewebauthn/server` / `browser` |
| File export (CSV / XLSX) | Yes | Download only, work log report |
| Excel workbook import | Yes, CLI | `scripts/import-moulds.mjs` (ExcelJS) |
| Email / SMS / push notifications | Not found | |
| ERP / MES / external API | Not found | |
| Webhooks, message queues, scheduled jobs | Not found | |
| QR / barcode | Not found | Old hash links (`#/page/m/<id>`) are redirected and may have been used in QR codes; unconfirmed |
| Old Supabase store | Historic | `migrateSupabase.js` |
