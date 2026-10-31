---
title: Architecture
description: Components, boundaries and request flow
audience: Developers, architects
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified
---

# Architecture

```mermaid
flowchart LR
    subgraph Client
      B[Next.js pages - client components]
      SW[Service worker]
    end
    subgraph Server [Docker Compose]
      NG[Nginx proxy :80]
      FE[frontend: next start]
      API[backend: Express]
      DB[(mongo:7 replica set rs0)]
      UP[(/app/uploads folder)]
    end
    B --> NG
    NG --> FE
    NG -->|/api| API
    API --> DB
    API --> UP
```

## Backend layering
| Layer | Folder | Responsibility |
|---|---|---|
| Routes | `routes/` | Route tables `[method, path, permissions, handler, bodySchema, querySchema]`, built by `routerFrom` (auth → permission → validation → privacy → handler) |
| Validation | `validators/schemas.js` | Zod schemas |
| Controllers | `controllers/` | Load documents, call pure rules, save in a transaction with Movement + AuditLog |
| Rules (pure) | `lib/workflow.js`, `lib/workLog.js`, `lib/mouldState.js`, `lib/permissions.js` | All business decisions; unit-tested without a DB |
| Models | `models/` | Mongoose schemas, invariants, indexes, immutability plugin |
| Privacy | `middleware/accountPrivacy.js`, `lib/accountPrivacy.js` | Replaces protected users with "Private user" in every JSON response |

## Frontend
Next.js App Router. Route group `(tracker)` shares `AppLayout` (session check, sidebar, 60 s permission refresh). Data via `utils/api.ts` (fetch with credentials). Permissions mirrored in `utils/permissions.ts` for display only. i18n in `utils/i18n.ts` (en, si). The PWA service worker is `public/sw.js`.

## Authentication flow
```mermaid
sequenceDiagram
    Browser->>API: POST /api/auth/login {email,password}
    API->>DB: find user, bcrypt compare
    API-->>Browser: Set-Cookie access_token (JWT sub=userId, HttpOnly, SameSite=lax)
    Browser->>API: any /api call (cookie)
    API->>DB: load user (active, not deleted) each request
    API->>API: can(user, permission)
```

## Key design decisions (from code comments)
- Rules are pure functions so they can be tested exhaustively (`backend/test/workflow.test.js`).
- History stores text snapshots (machine code, rack ID, person name) so renames never rewrite the past.
- Pictures are content-hashed WebP files, cached immutably.
