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

## Workflow rules (enforced on the server, `backend/lib/workflow.js`)

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

Back up the database **and** the uploads folder together, before every upgrade or migration:

```
mongodump --uri "$MONGODB_URI" --archive=mould-tracker-$(date +%F).archive.gz --gzip
tar czf uploads-$(date +%F).tgz -C backend uploads
# restore
mongorestore --uri "$MONGODB_URI" --archive=mould-tracker-YYYY-MM-DD.archive.gz --gzip --drop
tar xzf uploads-YYYY-MM-DD.tgz -C backend
```

For the Docker/Coolify deployment see `deploy/README.md`.
