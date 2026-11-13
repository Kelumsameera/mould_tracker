# Mould Tracker

Tracks where every injection mould and extrusion die is (machine, Production Floor, Isolation Area,
Mould Room rack, Tool Room, Workshop, Out of Service), what state it is in, and who did what.
Next.js frontend + Express/MongoDB backend, installable as a PWA, English and Sinhala (EN / සිං).

```
tool-tracker/
├── backend/                  Express 5 + Mongoose (plain JavaScript)
│   ├── index.js              server entry
│   ├── config/db.js          connection + transaction helper
│   ├── models/               Mould, Item, Movement, WorkLog, Machine, Rack, Zone, User, RoleAccess, AuditLog, …
│   ├── controllers/          one per area (mould, user, rack, workLog, audit, auth, passkey, machine)
│   ├── routes/               route tables: [method, path, permissions, handler, schema]
│   ├── lib/                  business rules as pure functions (workflow, permissions, cavities, flowConfig, …)
│   ├── middleware/           auth (JWT cookie + effective permissions), zod validation, errors
│   ├── validators/schemas.js request schemas
│   ├── scripts/              one-off tools (.mjs): importer, seeds, migrations
│   ├── migrations/           data migrations from the old app
│   └── test/                 node:test, no database needed (npm test)
├── frontend/                 Next.js 16 + React 19 + TypeScript, src/{app,components,utils}
├── deploy/                   Docker / Nginx / Coolify notes (see deploy/README.md)
├── docs/                     user documentation and the public docs site builder
└── archive/                  old files, not used
```

## Run locally

```
cd backend
npm install
npm run dev            # http://localhost:4000/api/health
npm test

cd frontend
copy .env.local.example .env.local
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit && npm run build
```

There are **no default accounts or passwords**. Create the first System Administrator as described below.

## Environment (backend/.env)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | This app's own database (`mould_tracker`). Never point it at the old shared database. |
| `SOURCE_MONGODB_URI` | Only for `migrations/upgradeMouldModel.mjs` (read-only source). |
| `JWT_SECRET` (32+ chars), `JWT_EXPIRES_IN` | Session cookie signing. |
| `CORS_ORIGIN` | Comma-separated frontend origins. |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Cookie flags (secure on HTTPS). |
| `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_ID` | Passkeys; leave blank to disable. |
| `UPLOAD_DIR` | Item pictures (default `backend/uploads`). Back it up with the database. |
| `SEED_SYSADMIN_EMAIL`, `SEED_SYSADMIN_PASSWORD` | First System Administrator (see below). Keep out of source control. |
| `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` | Optional Super Admin created by `npm run seed`. |
| `ISOLATION_MAX_WAIT_HOURS` | "Waiting too long" in the Isolation Area (default 24; red at twice). |
| `LIMITED_RUN_ALERT_DAYS` | Running with blocked cavities turns red after this (default 7). |

## Roles

| Role (stored value) | Summary |
|---|---|
| System Administrator (`system_admin`) | Everything, always (cannot be reduced). The only role that manages access (role matrix, per-user permissions) and the only one that assigns `super_admin` / `system_admin`. At least one active System Administrator must always exist. Accounts are visible only to their owner. |
| Super Admin (`super_admin`) | System settings, racks, import, audit log, export, users below Super Admin. |
| Admin (`admin`) | Moulds, items, machines, users below Admin. |
| Production Supervisor (`production_supervisor`) | Mount / floor / Isolation moves, problems, cavities. |
| Mould Technician (`mould_technician`) | Machine, Workshop and Isolation moves, status, work log, cavities. |
| Mould Maker (`mould_maker`) | Mould Room, Workshop and Isolation moves, status, work log, cavities. |
| Executive (`executive`) | Read-only management view: moulds, history, dashboard, work log report, cavity downtime, Isolation, racks, export of reports. Lands on the Dashboard. |

Who may assign which role is one table, `ASSIGNABLE_ROLES` in `backend/lib/permissions.js`
(System Administrator: all; Super Admin: Admin and below; Admin: Production Supervisor and below).

### Permissions

effective permissions = role defaults (editable matrix) + user **grants** − user **denies**.
User overrides may have an expiry date (temporary access) and always need a reason.
The server checks the effective list on every request; `/api/auth/me` returns it and the UI mirrors it.

| Key | Meaning |
|---|---|
| `mould.view` | View moulds, search, history and timeline |
| `mould.create` / `mould.edit` / `mould.machines.edit` / `mould.images.manage` / `mould.delete` | Add; edit details, items, cavities; edit capable machines; pictures; remove/restore |
| `move.machine` / `move.floor` / `move.mouldroom` / `move.workshop` / `move.isolation` | Moves to each place (leaving Isolation needs the destination's permission) |
| `move.outOfService` | External repair dispatch (Super Admin only) |
| `status.change` | Change status at the Workshop |
| `machines.override` | Mount outside the capable machines, with a reason |
| `worklog.create` / `worklog.view` / `worklog.report` | Work log entry, history, report |
| `problem.report` | Report a problem |
| `cavity.manage` | Run with blocked cavities / restore |
| `rack.view` / `rack.manage` | Racks |
| `users.manage` | Users (limited by `ASSIGNABLE_ROLES`) |
| `access.manage` | Access Control (System Administrator only, never grantable) |
| `import.run` / `audit.view` / `export.run` / `settings.manage` | Import, audit log, exports, settings |

**Access Control** (`/access`): System Administrators edit the role matrix (Roles tab) and per-user
grants/denies with expiry and reason (Users tab, with an effective-permissions preview). Everyone else
sees a read-only "My access" list. Every change is confirmed, audited (before/after/reason) and listed
under *Audit log → Access changes*. Users with overrides show a badge in the user list.

### First System Administrator

```
cd backend
# set SEED_SYSADMIN_EMAIL (and SEED_SYSADMIN_PASSWORD if that account does not exist yet)
npm run seed:sysadmin              # dry run: says what it would do
npm run seed:sysadmin -- --apply   # promotes the existing account, or creates it
```

Without the variable the script only prints instructions. A created account must change its password at
first sign-in (also true for the optional Super Admin from `npm run seed`). `npm run create:system-admin`
(create-only, `SYSTEM_ADMIN_*` variables) still works.

After upgrading from an older version run `npm run migrate:permissions` (dry run) and then
`npm run migrate:permissions -- --apply` to rewrite stored permission names; the app already reads the old
names correctly, so this is housekeeping. Likewise `npm run migrate:conditional` (then `-- --apply`) renames the
old mould status `RUNNING_LIMITED` to `CONDITIONAL`; history keeps the old value and is shown as Conditional.

## Workflow rules (built-in defaults; editable in Workflow settings)

1. GOOD moulds may be on a machine, on the Production Floor, in the Isolation Area or on a Mould Room rack
   (extrusion dies: Tool Room).
2. Service/repair statuses mean the Workshop; such a mould never goes into the Mould Room.
3. **Isolation Area** (`ISOLATION`): every move whose destination is not a machine goes through it.
   Machine / Production Floor / Mould Room / Workshop → Isolation, wait, then Isolation → final place.
   A direct move is refused with "Send to Isolation Area first". Mounting on a machine is direct
   (from the Production Floor, Isolation, the Mould Room/Tool Room or another machine). Moves inside one
   place (another rack, a new Workshop status) and Out of Service dispatch/return are exempt.
   Sending to Isolation records an optional planned destination, remarks and optionally a status; any
   status may wait there. Leaving records the dwell time. Waiting longer than
   `ISOLATION_MAX_WAIT_HOURS` shows amber, twice that red.
4. Mount only on a capable machine unless an Admin overrides with a reason; one mould per machine
   (also a unique database index).
5. **Running with blocked cavities**: status `CONDITIONAL` ("Conditional" / "කොන්දේසි සහිත"; tooltip "Running with blocked cavities / temporary fix"), allowed only on a
   machine, the Production Floor or in Isolation. Cavities are numbered 1…N (N = total cavities of the
   items); a reason is required; each change writes a movement, a work log entry (`CAVITY_BLOCK` /
   `CAVITY_RESTORE`) and an audit entry. Sending such a mould to the Workshop makes it `IN_REPAIR` and keeps
   the blocked list until it is restored. Restoring all cavities makes a running mould GOOD.
   Red after `LIMITED_RUN_ALERT_DAYS` or past the expected fix date.
6. Editing master data (details, items, machines, pictures, cavities, shots-to-service, notes) works at any
   status and location and never changes either; each part needs its own permission. Stale saves are
   refused (mould `version`). Edits appear in the timeline as "Edited" with before/after.
7. Every change is recorded (Movement + AuditLog); remarks are required for service/repair.
8. `totalShots >= shotsToService` flags NEEDS_SERVICE when shots are recorded.

## Configurable workflow (Workflow settings, `/workflow`)

Locations, statuses, roles and the move rules are data, not code. The built-in defaults (`backend/lib/workflowConfig.js`)
are exactly the original rules, so nothing changes until a System Administrator publishes something else.

- **Who:** editing needs `config.manage` (System Administrator only, never grantable). Super Admin, Admin and Executive
  can view the workflow, its versions and differences read-only.
- **Draft → publish:** every change goes into one draft. *Publish* needs a reason, refuses an invalid draft with the
  list of problems, and applies to everyone on their next request/refresh. *Versions* shows history and differences,
  *Roll back* re-publishes an older version as a new version, *Export/Import JSON* moves a config between systems
  (an import always becomes the draft). Every step is in the audit log with the difference and the reason.
- **One rules engine:** `evaluateMove(config, mould, request)` (`backend/lib/evaluateMove.js`) decides every move for
  the API, the simulator and the UI's buttons. Location kinds: `machine` (one mould per machine), `rack` (zone + rack),
  `simple`, `transit` (holding area with a max wait). Rules: allowed / *via* another location / required fields /
  permissions (one from each line). Statuses have *allowed at* and *may move to* lists plus flags.
- **Simulator:** pick a location, status, destination (and, for a System Administrator, the draft and a role) to see
  allowed/blocked, the route, required fields and the exact error before publishing.
- **Validation** refuses: missing EN/SI labels, bad/duplicate keys, not exactly one machine location, no rack location,
  GOOD missing, locations nothing leads into or out of, statuses with nowhere to be or go, *via* cycles and dead ends,
  unknown or locked permissions, removing built-in roles or anything still used by records (disable it instead).

### How to …
- **Add a location** (e.g. Calibration Room): Workflow settings → Locations → key `CALIBRATION_ROOM` → Add; set labels,
  kind, icon, colour, "Allow status changes here", "Allow new moulds to start here". Its permission `move.calibration_room`
  appears in Access Control automatically. Then Workflow rules → click the cells (e.g. Workshop → Calibration Room,
  Calibration Room → Mould Room) → Allowed, *via*, requirements. Statuses → allow GOOD there (done automatically).
  Save draft → check the problem list → Simulator → Publish with a reason. The location gets its own screen in the menu.
- **Add a status:** Statuses → key → Add; set labels, colour, where it may be and where it may go.
- **Add a role:** Roles → key (e.g. `quality_inspector`) → *Copy permissions from* → Add; tick permissions and which
  roles it may assign; give other roles the right to assign it. After publishing it can be given to users.
- **Remove the Isolation step for one move:** Workflow rules → that cell → *Must go through* = none → publish.
- **Undo:** Versions → *Roll back to this version* (with a reason).

## Settings (`/settings`)

Every list, label and limit that used to be in the code has a default and can be changed here (permission
`settings.manage`: System Administrator only, never grantable). Changes apply at once (confirm + audit) and are
marked *Modified*; *Reset to default* puts the original back.
- **Texts / Labels:** every English/Sinhala UI text, side by side with the code default; search, "missing Sinhala",
  export/import JSON. (Texts that contain numbers or names keep their code wording.)
- **Thresholds & limits:** pictures per item, picture size/quality, export row cap, page size, "service soon" warning
  level, auto-refresh interval, session length, minimum password length, typo suggestions on/off, recent searches.
  The Isolation max wait and the Conditional overdue days are part of the workflow (Workflow settings).
- **Lists:** work-log types, outcomes, problem types, standard remarks (tap to add in move forms), owners, processes,
  product families. Items used in records can be disabled but not removed.
- **Dashboards:** which cards each role sees, in which order.
- Machines (Machines screen) and zones/racks (Rack management) keep their own screens.

After upgrading, run each of these as a dry run first, then with `--apply` (back up first):
`npm run seed:workflow` (stores the built-in workflow as published version 1), `npm run migrate:permissions`,
`npm run migrate:conditional`, `npm run backfill:search`.

## Catalog & Totals

`/catalog` (permission `catalog.view`, all roles by default) shows complete totals, not locations: total moulds,
total unique items (unique Item IDs), items per mould, moulds with more than one item and items made by more than
one mould, for All / Injection / Extrusion (process = tool type). Moulds and Products are separate tabs with
breakdown chips, search, sorting and server-side paging (20 per page). Product families are the Item ID prefix
(`backend/config/itemFamilies.js`). CSV/XLSX export of the current tab and filters needs `export.run`, is audited and
stops at 5,000 rows. Extrusion dies come from the `EXTRUSION 01` sheet (`--sheet "EXTRUSION 01"`; Die ID = Tool ID,
Pin ID kept on the items).

## Search

Every search box uses one helper (`backend/lib/search.js`, mirrored in `frontend/src/utils/search.ts`): case,
punctuation and spacing never matter (`FLK19066` = `flk 19066` = `FLK-19066`), Sinhala text is kept, and every word
of a multi-word query must match. Moulds and items store a normalized `searchKey` (kept up to date on save and by the
importer); after upgrading run `npm run backfill:search` (dry run) then `-- --apply`. An Item ID finds every mould that
makes it ("Matched item" on the card). Ranking: exact, prefix, substring; when nothing matches, a one-character typo
or O/0, I/1/l mix-up is offered as "Did you mean …?". The Find box shows up to 8 live suggestions (keyboard ↑ ↓ Enter
Esc, recent searches per device).

## Pictures

Up to 5 pictures per item (`MAX_ITEM_IMAGES`, `backend/lib/images.js`), shrunk in the browser, stored as
WebP + thumbnail named by content hash under `UPLOAD_DIR`. Pictures can be picked while adding a mould,
and added / replaced / removed / reordered when editing (phone camera supported). Every change is audited.

Workbook import: `node scripts/import-moulds.mjs --file <xlsx> [--sheet "..."]` (dry run) then `--apply`.
`--images-only` only (re)attaches sheet pictures to existing items and restores missing picture files; it
never overwrites a manually uploaded picture and can be run repeatedly.

## Racks

Zones, rows and pallet positions are managed by Super Admins under *Rack management*; moving into the
Mould Room needs a rack with free capacity. `scripts/migrate-rack-positions.mjs` converts older rack data.

## Backup and restore

The workflow config, settings and texts are stored in the database (`workflowconfigs`, `settings`), so a normal
database backup covers them. A workflow change can also be undone with *Roll back* or a JSON export/import.


Back up the database **and** the uploads folder together, before every upgrade or migration:

```
mongodump --uri "$MONGODB_URI" --archive=mould-tracker-$(date +%F).archive.gz --gzip
tar czf uploads-$(date +%F).tgz -C backend uploads
# restore
mongorestore --uri "$MONGODB_URI" --archive=mould-tracker-YYYY-MM-DD.archive.gz --gzip --drop
tar xzf uploads-YYYY-MM-DD.tgz -C backend
```

For the Docker/Coolify deployment see `deploy/README.md`.
