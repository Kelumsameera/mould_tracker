---
title: Documentation changelog
description: Revision log for the docs folder
audience: Maintainers
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Current
---

# Documentation changelog

| Date | Version | Change | Basis |
|---|---|---|---|
| 2026-10-29 | 1.0 | Initial documentation suite created (orientation, getting started, 17 feature pages, 8 roles pages, 8 workflows, 4 demos, administration, technical reference, support, evidence matrix, gaps, complete guide). Existing READMEs left unchanged; their inconsistencies are listed in GAPS. | Branch `feature/mould-tracker-upgrade`, static review; backend 157/157 and frontend 29/29 tests passing |

## Maintenance rules
- Update the affected page **and** the evidence matrix whenever `backend/lib/permissions.js`, `lib/workflow.js`, `lib/workLog.js`, routes or schemas change.
- Bump `last_verified` only after re-checking against the code.
- Keep proposals labelled "Planned / proposed".
