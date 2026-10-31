---
title: Mould Tracker documentation
description: Entry point and reading paths for the Mould Tracker documentation suite
audience: Everyone
last_verified: 2026-10-29
app_version: "web/API 2.0.0 (package.json); native shells 2.2.0"
status: Verified (static code review + automated tests)
---

# Mould Tracker documentation

Mould Tracker is a web app (installable as a PWA, with Windows and Android shells) that records **where every injection mould and extrusion die is, what condition it is in, and what work was done on it**.

> Start here: **[MOULD-TRACKER-COMPLETE-GUIDE.md](MOULD-TRACKER-COMPLETE-GUIDE.md)** — the standalone manual.

## Reading paths by role

| You are… | Read in this order |
|---|---|
| Production Supervisor | [First login](getting-started/first-login.md) → [Quick start](getting-started/quick-start.md) → [Find a mould](user-guide/find-a-mould.md) → [Report a problem](user-guide/report-a-problem.md) → [Mount and unmount](workflows/mount-and-unmount.md) |
| Mould Technician | Quick start → [Move a mould](user-guide/move-a-mould.md) → [Work log](user-guide/work-log.md) → [Shot count and service](workflows/shot-count-and-service.md) |
| Mould Maker | Quick start → [Workshop queue](user-guide/workshop-queue.md) → [Workshop repair cycle](workflows/workshop-repair-cycle.md) → [Rack view](user-guide/rack-view.md) |
| Admin | [Roles overview](roles/overview.md) → [Manage moulds](user-guide/manage-moulds.md) → [Machines](user-guide/machines.md) → [Users](user-guide/users.md) → [Work log report](user-guide/work-log-report.md) |
| Super Admin | Admin path + [Rack management](user-guide/rack-management.md) → [Out of Service](workflows/out-of-service.md) → [Audit log](user-guide/audit-log.md) |
| System Administrator / IT | [User access](user-guide/user-access.md) → [Configuration](administration/configuration.md) → [Security](administration/security-and-access.md) → [Operations](administration/operations-and-recovery.md) → [Deployment](technical/deployment.md) |
| Developer | [Architecture](technical/architecture.md) → [Repository](technical/repository-structure.md) → [Local development](technical/local-development.md) → [API](technical/api-reference.md) → [Database](technical/database-reference.md) |

## Sections

- Orientation: [Introduction](introduction.md) · [Product overview](product-overview.md) · [Glossary](glossary.md)
- Getting started: [Prerequisites](getting-started/prerequisites.md) · [First login](getting-started/first-login.md) · [Quick start](getting-started/quick-start.md) · [Navigation tour](getting-started/navigation-tour.md)
- [User guide](user-guide/README.md) · [Roles](roles/overview.md) · [Workflows](workflows/overview.md)
- Demonstrations: [5-minute tour](demonstrations/five-minute-tour.md) · [15-minute demo](demonstrations/fifteen-minute-demo.md) · [Admin/technical demo](demonstrations/admin-technical-demo.md) · [Demo data](demonstrations/demo-data-and-reset.md)
- Administration: [Configuration](administration/configuration.md) · [Security and access](administration/security-and-access.md) · [Operations and recovery](administration/operations-and-recovery.md)
- Technical: [Architecture](technical/architecture.md) · [Repository](technical/repository-structure.md) · [Local development](technical/local-development.md) · [Database](technical/database-reference.md) · [API](technical/api-reference.md) · [Integrations](technical/integrations.md) · [Deployment](technical/deployment.md)
- Support: [Troubleshooting](support/troubleshooting.md) · [FAQ](support/faq.md) · [Known limitations](support/known-limitations.md)
- Evidence: [EVIDENCE-MATRIX](analysis/EVIDENCE-MATRIX.md) · [GAPS-AND-QUESTIONS](analysis/GAPS-AND-QUESTIONS.md) · [Changelog](DOCUMENTATION-CHANGELOG.md)

## How these docs were produced

Written from the repository source on branch `feature/mould-tracker-upgrade` on 2026-10-29. Behaviour was verified by reading the code and running the automated test suites (backend 157/157 pass, frontend 29/29 pass). The app was **not** run against a live database for this pass, so UI walkthroughs are derived from source code. No screenshots exist yet; each page lists the captures it needs.
