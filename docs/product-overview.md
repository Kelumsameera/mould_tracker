---
title: Product overview
description: Users, platforms, architecture, requirements and the end-to-end process
audience: Everyone; managers; IT
last_verified: 2026-10-29
app_version: "web/API 2.0.0; native shells 2.2.0"
status: Verified (static code review)
---

# Product overview

## Who uses it

Six roles (see [Roles](roles/overview.md)): Super Admin, Admin, Production Supervisor, Mould Technician, Mould Maker, and the protected System Administrator.

## Platforms

| Platform | Status | Evidence |
|---|---|---|
| Web browser (desktop and phone), responsive layout | Verified | `frontend/` (Next.js app) |
| Installable PWA with an offline page | Verified | `frontend/src/app/manifest.ts`, `public/sw.js`, `public/offline.html` |
| Windows desktop shell (Electron, unsigned installer) | Verified (source) | `native/desktop/`, `native/README.md` |
| Android shell (WebView APK, Android 8+) | Verified (source) | `native/android/` |
| Apple shell | Source only, no release | `native/apple/`, `native/README.md` |

Native shells only open the server URL; they hold no data. Passkeys are not supported inside the native WebViews (`native/README.md`).

## Architecture

```mermaid
flowchart LR
    U[Browser / PWA / native shell] -->|HTTPS| N[Nginx proxy]
    N -->|pages| F[Next.js frontend]
    N -->|/api| B[Express API]
    B --> M[(MongoDB replica set)]
    B --> D[(Uploads folder - WebP pictures)]
```

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, TypeScript.
- **Backend:** Node.js, Express 5, Mongoose 8, Zod validation, JWT session in an HttpOnly cookie, WebAuthn passkeys, Sharp image processing, ExcelJS export.
- **Database:** MongoDB with multi-document transactions, so a replica set is required. Docker Compose stack in `compose.yaml`.

Details: [technical/architecture.md](technical/architecture.md).

## End-to-end process

```mermaid
flowchart TD
    A[Admin adds mould and items] --> B[Mould on a rack in the Mould Room]
    B -->|Technician mounts| C[On a machine]
    C -->|Record shots| C
    C -->|shots reach limit| D[Flagged Needs service]
    C -->|Anyone reports a problem| C
    D -->|Send to Workshop| E[Workshop]
    E -->|In service / In repair, work logged| E
    E -->|Mark Good| F{Where next?}
    F --> B
    F --> C
    G[Admin: work log report and export] -.reads.-> E
```

## System requirements

- **Server:** Docker with Compose, or Node.js plus a MongoDB replica set. See [Deployment](technical/deployment.md).
- **Client:** a current browser. Passkeys need a trusted HTTPS address.

## Known limitations

See [support/known-limitations.md](support/known-limitations.md).
