# Mould Tracker – notes for coding agents

Read README.md first (roles, permission keys, workflow rules, env vars). Key points:

- Business rules live in pure functions in `backend/lib/` (workflow.js, permissions.js, cavities.js,
  mouldEdit.js, itemImages.js, flowConfig.js). Controllers load documents, call the planner, then save the
  Mould + Movement (+ WorkLog) + AuditLog in one transaction. The UI only mirrors the rules
  (`frontend/src/utils/permissions.ts` mirrors `canMove`, the Isolation route rule and `ASSIGNABLE_ROLES`).
- Non-machine moves always go through the Isolation Area; mounting on a machine is direct.
- Permission checks use the canonical keys (`mould.edit`, `move.isolation`, `cavity.manage`, …). Old keys in
  stored data are translated by `upgradePermissions`. `access.manage` is System Administrator only.
- Every user-visible string needs EN and SI in `frontend/src/utils/i18n.ts`. Wording: "Mould Room / Mould කාමරය",
  "Isolation Area / Isolation කලාපය".
- Confirm popups (`useConfirm`) before moves, deletes, removing pictures, access/role changes and cavity saves.
- Use only the `mould_tracker` database. Never write to the old shared database.
- Checks: `cd backend && npm test`; `cd frontend && npm test && npx tsc --noEmit && npm run build`.
- New backend test files must be added to the `backend/test/*` exceptions in `.gitignore` to be committed.

## Nothing hard-coded (rule for every new feature)
- Locations, statuses, roles and move rules are workflow config (`lib/workflowConfig.js` defaults, edited in
  /workflow, enforced by `lib/evaluateMove.js`). Never compare against a location/status/role name in new code: use the
  location kind/flags, the status flags or a permission. The UI reads the same config (`frontend/src/utils/runtimeConfig.ts`).
- Every other list, label, limit or threshold goes into `backend/lib/settings.js` (SETTINGS / LISTS) with its default,
  and is read with `setting(key)` / `listKeys(list)` (backend) or `setting(key, fallback)` / `activeList(list)` (frontend).
- UI texts stay in `frontend/src/utils/i18n.ts` (EN + SI); they can be overridden in Settings → Texts.
- Model enums for locations/statuses/work types grow from the config at runtime; validate input against the config,
  not against fixed arrays.
