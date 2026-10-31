# Mould Tracker Upgrade – Claude Code Task

> How to use: copy `Flexicare_Lanka_Tools_list_PR_013__14_-_Last_Updated_-_04_JAN_2024.xlsx` into `./data/`, open Claude Code in the project root, paste this whole file. Run ONE phase at a time (say "next" to continue).

## 0. Working rules (read first)
- Existing app: Next.js + MongoDB, LAN-only, PWA/installable. **Extend it, don't rewrite it.** Reuse existing models, components, auth, i18n.
- Explore cheaply: `ls`, `package.json`, tree (depth 3), models, auth middleware, i18n files. Don't read every file.
- Never print xlsx rows or image data in chat. Use scripts; print only counts/summaries.
- Small diffs, no full-file dumps, no repeated explanations. No new library unless essential (one-line reason).
- Business rules are enforced on the **server**; the UI only mirrors them.
- If blocked, ask ONE batched question; otherwise pick a sensible default and note it.
- Every turn ends with exactly: `Status` · `Files changed` · `How to test (≤5 steps)` · `Open questions (if any)`.

## 1. Vocabulary (important)
- The place everyone calls "Mould Room" is the same as the old "Tool Room". **All UI text, both languages, must say "Mould Room" / "Mould කාමරය"** (Sinhala label is exactly `Mould කාමරය`, keep the English word "Mould" in Latin script; store it in one i18n key so it can be changed in one place). Replace every old "Tool Room" label. Internal enum may be `MOULD_ROOM`; migrate existing data/values if the old value was `TOOL_ROOM`.
- "Mould" = one Tool ID in the sheet. "Item" = a product made by that mould.

## 2. Source data (xlsx, sheet `INJECTION MOULDING`, ~286 rows, ~147 images)
Header row 9: `Tool set count | Tool ID | Capable Machine(s) | Item ID | Item Image | Description | Shots to Be Service | No. of Cavities | QAS | Material ID | Material Description | Masterbatch ID | Masterbatch Description`
- Group rows by **Tool ID** → 1 Mould with many Items.
- Capable machines like `INJ-01/INJ-03` → split on `/`, trim → array.
- Merged cells exist → forward-fill merged values onto every row of the tool.
- Skip title rows, `PG n` rows, formula cells. Some rows miss a cell → map by header name, not column position. Trim whitespace/newlines; `N/A` → null.
- Images: embedded pictures anchored to rows of "Item Image". Map via anchor → extract from `xl/media/*` → resize (max ~800px, WebP/JPEG q≈80) + small thumbnail → save under the app's existing upload dir (or `public/uploads/items/`). Store only paths in MongoDB.
- Sheet `EXTRUSION 01` is out of scope for now; keep the importer sheet-pluggable.

## 3. Locations & status
**Locations:** `MACHINE` (machine ID e.g. INJ-03) · `PRODUCTION_FLOOR` · `WORKSHOP` · `MOULD_ROOM` (must include a **rack**).
**Status:** `GOOD` · `NEEDS_SERVICE` · `NEEDS_REPAIR` · `IN_SERVICE` · `IN_REPAIR`.

Rules (server-enforced, clear error messages):
1. GOOD mould may be at: Machine, Production Floor, or a Mould Room rack.
2. Any service/repair status (`NEEDS_*`, `IN_*`) → must be at **Workshop**. Moving it into the Mould Room is blocked.
3. Flow: Machine → Production Floor / Mould Room (if GOOD) or Workshop (if service/repair needed).
4. After service/repair, set status GOOD at Workshop → then send to Mould Room (rack required), Production Floor, or Machine.
5. Mounting on a machine only if it is in the mould's `capableMachines` (override only Admin/Super Admin with a reason).
6. One mould per machine at a time.
7. Every move/status change writes a **Movement** record and an **AuditLog** entry; remarks mandatory for service/repair.
8. If `totalShots >= shotsToService` → auto `NEEDS_SERVICE`.

## 4. Mould Room racks (new – easy "where is it?" lookup)
The Mould Room has **2 main sides (zones)**:
- **FLK** side – FLK moulds
- **CCI** side – CCI moulds

Each zone has racks coded like `A1…A10`, `B1…B10`, `C1…C10` (row letter + number). **Location ID = zone + rack**, shown as `FLK-A3` / `CCI-B7` (UI text: "Mould Room · FLK · A3").

Data model `Rack`: `zone` (FLK|CCI, itself configurable), `code`, `locationId` (unique, e.g. `FLK-A3`), `capacity` (default unlimited/null), `active`, `note`, timestamps. Mould gets `owner` (FLK|CCI) and, when in Mould Room, `rackId`.

**Super Admin panel → "Rack Management"** (only Super Admin; Admin read-only):
- Create/rename/disable zones and racks; **bulk generate** (zone + row letters + number range, e.g. FLK, rows A–C, 1–10) with preview before saving; add/remove a single rack or a whole row.
- Cannot delete a rack that currently holds moulds (disable it or move moulds first). Renaming a rack updates all references; history keeps the old code as text snapshot.
- Seed defaults on first run: FLK and CCI zones with rows A,B,C × 1–10 (Super Admin can change afterwards).

Behaviour:
- Putting a mould in the Mould Room **requires choosing a rack** (dropdown grouped by zone → row; show current occupancy). Warn if mould owner ≠ rack zone (allow override with reason).
- **Find-a-mould UX:** one big search box on the home screen (Tool ID, Item ID, description, machine, rack). Result card shows a bold location line, e.g. `MOULD ROOM · FLK · A3` or `MACHINE INJ-04` or `WORKSHOP – IN REPAIR`, plus status badge and last-moved time/user.
- **Rack view:** screen listing zones → racks (grid) with moulds per rack and empty racks highlighted; tap a rack to see its moulds. Filter by zone.
- Optional if cheap: QR per mould and per rack, scan in PWA to open.

## 5. Roles & permissions (one map in `lib/permissions.ts`, used by API + UI)
| Capability | Super Admin | Admin | Prod. Supervisor | Mould Technician | Mould Maker |
|---|---|---|---|---|---|
| System settings, rack management, language texts, import, audit logs | ✅ | ❌ (view-only racks) | ❌ | ❌ | ❌ |
| Add/edit/remove users | ✅ | ✅ (not super admins) | ❌ | ❌ | ❌ |
| Add/edit/remove moulds & items | ✅ | ✅ | ❌ | ❌ | ❌ |
| Daily machine changes (mount/unmount, floor moves) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Take out of / put into Mould Room (assign rack) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Service/repair work, status change, Workshop moves | ✅ | ✅ | ❌ | ✅ | ✅ |
| View list/search/history | ✅ | ✅ | ✅ | ✅ | ✅ |
Deletes are soft (`deletedAt`); Movement history is immutable.

## 6. UI/UX
- Mobile-first, large touch targets (shop-floor phones/tablets); keep existing design language.
- **English + Sinhala**, switch in header, saved per user; all labels/status/roles/errors translated; Noto Sans Sinhala font; check no text is clipped.
- Screens: Login · Dashboard (counts by location/status, needs service) · Mould list + search/filters · Mould detail (item gallery with thumbnails, current location, history) · Quick Move · Mould Room check-out/check-in · Rack view · Workshop queue · Admin (users, moulds) · Super Admin (rack management, audit log, import, export CSV/XLSX).
- No external CDN/API at runtime (LAN only).

## 7. Phases
1. **Gap analysis only** (≤25 lines): what exists / missing / to change (include Tool Room→Mould Room rename impact). No code. Then wait.
2. Data model (Mould, Item, Rack, Movement, AuditLog, User) + permissions + seed super admin & default racks.
3. Import script `scripts/import-moulds.ts` (idempotent upsert by toolId+itemId, `--dry-run`, summary of moulds/items/images/skipped/warnings).
4. API + workflow rules + rack assignment + audit (with tests for rules 1–8 and permissions).
5. UI + i18n (EN/SI) incl. rack view, rack management, find-a-mould search.
6. Polish: dashboard, performance, PWA check, export, short README.

## 8. Done when
- Import yields correct mould/item counts; 5 random items verified with correct images.
- Rules 1–8 + permission table covered by tests (1 test user per role).
- Super Admin can add/rename/disable racks and bulk-generate; any mould's exact location (zone + rack) is visible within 2 taps from search.
- Everything traceable; nothing hard-deleted; both languages complete, no hard-coded strings, "Mould Room" wording everywhere.
- `npm run build` and lint pass.

**Start with Phase 1 now.**
