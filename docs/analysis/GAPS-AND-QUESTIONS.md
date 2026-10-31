---
title: Gaps and open questions
description: Uncertainties, inconsistencies and questions for the product owner
audience: Product owner, IT, maintainers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Open
---

# Gaps and open questions

## Questions for the owner

| # | Question | Why it matters |
|---|---|---|
| Q1 | Does the Coolify service mount a persistent volume on the backend's `/app/uploads`? `compose.yaml` has none. | Item and work-log pictures could be lost on redeploy and are not in Mongo backups |
| Q2 | What is the official version number? Packages say 2.0.0; native shells say 2.2.0. | Version labels in the docs |
| Q3 | Should `settings.manage`, `import.run` and `export.run` be removed, or are screens planned? | They appear in User access but have no effect |
| Q4 | Is an "Add machine" button wanted on `/machines`? (The API supports it.) | New machines currently need API/scripts |
| Q5 | Escalation paths per shift (who to call when a move is refused)? | Roles pages |
| Q6 | Backup schedule, RPO/RTO and the restore owner? | Operations page |
| Q7 | Is a Sinhala quick-start document wanted? (The UI already supports Sinhala.) | Optional deliverable |
| Q8 | May screenshots be captured from production (with redaction), or only from a demo stack? | Screenshot backlog |
| Q9 | Are QR labels in use with the old `#/…/m/<id>` links? | Integrations / FAQ |

## Inconsistencies found in existing docs (not changed)

| File | Issue |
|---|---|
| `README.md` (root) | Top half describes the pre-upgrade Tool app (roles admin/operator/viewer, `/api/tools`, a seed with default credentials, "auto refresh every 10s"). The `/api/tools` route now returns 410. |
| `deploy/README.md` § "Passkeys and role permissions" | Describes Admin/Operator/Viewer; the current roles are different |
| `backend/.env.example` | `JWT_EXPIRES_IN` exists, but the cookie `maxAge` is hard-coded to 7 days |

## Not verified at runtime
- The UI flows were not clicked through; the app was not started against a database.
- The Mermaid diagrams were not rendered by a tool (syntax checked by review).
- Native builds were not built.

## Screenshot backlog
Every `Screenshot needed:` line in `docs/` (at least 12). Capture them from the demo stack and save under `docs/assets/screenshots/`.
