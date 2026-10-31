---
title: Repository structure
description: Map of folders and key files
audience: Developers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified
---

# Repository structure

```text
tool-tracker/
├── backend/                 Express API (package tool-tracker-backend 2.0.0)
│   ├── index.js             server entry, middleware, route mounting, /api/health
│   ├── config/db.js         Mongo connection + withTransaction
│   ├── routes/              route tables (table.js builds routers)
│   ├── controllers/         auth, passkey, mould, workLog, rack, machine, user, audit
│   ├── lib/                 pure rules: workflow, workLog, mouldState, permissions, racks, images, audit…
│   ├── middleware/          auth, validate, errors, accountPrivacy
│   ├── models/              Mongoose schemas
│   ├── validators/          Zod schemas
│   ├── migrations/          one-time data migrations
│   ├── scripts/             import-moulds, attach-cleaned-pictures, create-system-admin
│   ├── test/                node:test suites (157 tests)
│   └── Dockerfile
├── frontend/                Next.js 16 app (tool-tracker-frontend 2.0.0)
│   ├── src/app/             login, (tracker)/<page>/page.tsx, manifest
│   ├── src/components/      AppLayout, Sidebar, MouldSearch, MouldSheet, MouldActions, forms…
│   ├── src/utils/           api, i18n, permissions, helpers, imageUpload
│   ├── public/              sw.js, offline.html, install.html, icons
│   ├── test/                node:test suites (29 tests)
│   └── Dockerfile
├── native/                  desktop (Electron), android (WebView), apple (source only)
├── deploy/                  nginx configs, mongo init/health, deployment and HTTPS guides
├── compose.yaml             production stack
├── .env.production.example  root env template (no values)
├── archive/, output/, outputs/  previous versions, build outputs
└── docs/                    this documentation
```

The root `README.md` still describes the pre-upgrade Tool model in places; see [GAPS](../analysis/GAPS-AND-QUESTIONS.md).
