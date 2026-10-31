---
title: Work log report and export
description: Search, filter, summarise and export work-log entries
audience: Admin, Super Admin
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review + tests)
---

# Work log report and export

## Availability
Route `/work-report`, requires `worklog.report` (Super Admin, Admin).

## Filters

| Filter | Values |
|---|---|
| Search | Text (also matches the mould's Item IDs) |
| Tool ID, Person, Machine | Free text / person |
| Type | Repair, Service, Minor fix, Inspection, Cleaning, Other |
| Outcome | OK, Needs repair, Needs service, None |
| Status | Any mould status |
| Problem reports only | yes/no |
| Range | Today, 7 days, 30 days, This month, All, Custom (whole local days, Asia/Colombo) |

Your last filters are remembered on this device.

## Outputs
- **List:** paged on the server (20 per page by default, max 100). A table on wide screens, cards on phones; search words are highlighted; corrected entries are marked.
- **Summary:** per person (each named person counts once per entry) and per mould.
- **Export:** CSV or XLSX. The XLSX has a "Work log" sheet and an "About this export" sheet listing the filters. **Maximum 5,000 rows**, otherwise `EXPORT_TOO_LARGE` asks you to narrow the filters. Each export is audited (`worklog.exported`).

Protected System Administrator identities appear as **Private user** in results and exports.

## Evidence
`backend/controllers/workLogController.js` (`listWorkLogs`, `workLogSummary`, `exportWorkLogs`); `backend/lib/workLogFilter.js`; `backend/lib/dateRange.js`; `frontend/src/app/(tracker)/work-report/page.tsx`; `backend/test/workLogReport.test.js`.
