---
title: Security and access
description: Existing security controls, privacy, auditability, risks and recommendations
audience: IT, auditors, System Administrators
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified controls (static review); recommendations clearly separated
---

# Security and access

## Existing controls (verified)

| Control | Implementation | Evidence |
|---|---|---|
| Password hashing | bcrypt, cost 12 | `authController.js` |
| Session | JWT in an HttpOnly cookie; SameSite lax; Secure when `COOKIE_SECURE=true` | `utils/session.js` |
| Per-request account check | User reloaded each request; inactive or deleted → 401 | `authMiddleware.js` |
| Authorization | Permission per route plus rule-level checks; all routes × all roles tested | `routes/table.js`, `test/routes.test.js` |
| Input validation | Zod on every body and query; JSON size limits 1 MB / 8 MB | `validators/schemas.js`, `index.js` |
| Rate limiting | Login/passkey 40 per 10 min, enrolment 20 per 10 min | `authRoutes.js` |
| HTTP headers | Helmet; CORS allow-list with credentials | `index.js` |
| Passkeys | WebAuthn; public key only; origin check; current password required to add or remove | `passkeyController.js`, `passkeyConfig.js` |
| Uploads | Only JPEG/PNG/WebP decoded by Sharp, re-encoded to WebP; served to signed-in users only; dotfiles denied | `lib/images.js`, `index.js` |
| Audit trail | Append-only AuditLog, Movement, WorkLog | `lib/immutable.js` |
| Protected accounts | System Administrators hidden; shown as "Private user" | `lib/accountPrivacy.js` |
| Network | MongoDB on an internal Docker network only; keyfile auth | `compose.yaml` |
| Errors | Internal messages hidden in production | `errorMiddleware.js` |

## Known risks / observations

| # | Observation | Impact |
|---|---|---|
| R1 | Logout clears the cookie but does not revoke the JWT; a copied token stays valid until expiry unless the user is disabled | Low–medium |
| R2 | Cookie `maxAge` is hard-coded to 7 days regardless of `JWT_EXPIRES_IN` | Config confusion |
| R3 | No account lockout beyond IP rate limiting | Low |
| R4 | `/api/uploads` has no volume in `compose.yaml` | Data loss risk (pictures) |
| R5 | The Windows installer is unsigned | Users must trust the source |
| R6 | `deploy/README.md` "Passkeys and role permissions" still describes old roles (admin/operator/viewer) | Wrong guidance |

## Recommended improvements (not implemented)
- Token revocation or a session version on the user, so password change or logout invalidates sessions.
- Tie cookie `maxAge` to `JWT_EXPIRES_IN`.
- Add a persistent volume for uploads and include it in backups.
- Update the outdated role text in `deploy/README.md` and the root `README.md`.

## Data privacy
Personal data stored: user name, email, role; names in work-log snapshots. There is no retention or purge process. Customer data: Out of Service recipient name and address.
