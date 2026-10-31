import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { PERMISSIONS, ROLES, can, canManageUser, permissionsFor } from "../lib/permissions.js";
import { mouldStateError } from "../lib/mouldState.js";
import { buildRacks, DEFAULT_LAYOUT, DEFAULT_ZONES } from "../lib/racks.js";
import Mould from "../models/Mould.js";
import Rack from "../models/Rack.js";
import Movement from "../models/Movement.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { buildPlan, isAppUser, mapMovement, mapRole, summarize, toolToItems, toolToMould } from "../migrations/upgradeMouldModel.mjs";
import { createUser, updateUser } from "../controllers/userController.js";
import { requirePermission } from "../middleware/authMiddleware.js";

afterEach(() => mock.restoreAll());
const oid = () => new mongoose.Types.ObjectId();
const user = (role) => ({ _id: oid(), role });

// The permission table from the upgrade spec, one row per capability, columns in ROLES order.
const TABLE = {
  "settings.manage":  [1, 0, 0, 0, 0],
  "racks.manage":     [1, 0, 0, 0, 0],
  "import.run":       [1, 0, 0, 0, 0],
  "audit.view":       [1, 0, 0, 0, 0],
  "racks.view":       [1, 1, 1, 1, 1],
  "users.manage":     [1, 1, 0, 0, 0],
  "moulds.manage":    [1, 1, 0, 0, 0],
  "moves.machine":    [1, 1, 1, 1, 0],
  "moves.mouldRoom":  [1, 1, 0, 0, 1],
  "workshop.work":    [1, 1, 0, 1, 1],
  "machines.override":[1, 1, 0, 0, 0],
  "moulds.view":      [1, 1, 1, 1, 1],
  "worklog.create":   [1, 1, 0, 1, 1],
  "worklog.view":     [1, 1, 1, 1, 1],
  "worklog.report":   [1, 1, 0, 0, 0],
  "problem.report":   [1, 1, 1, 1, 1]
};

test("permission map matches the role table for one user per role", () => {
  for (const [permission, row] of Object.entries(TABLE)) {
    ROLES.forEach((role, i) => assert.equal(can(user(role), permission), role === "system_admin" || Boolean(row[i]), `${role} / ${permission}`));
  }
  assert.ok(Object.keys(TABLE).every((p) => p in PERMISSIONS));
  assert.throws(() => can(user("admin"), "nope"), /Unknown permission/);
  assert.equal(can(null, "moulds.view"), false);
});

test("legacy roles keep working until migrated, and map as agreed", () => {
  assert.deepEqual(permissionsFor(user("operator")), permissionsFor(user("mould_technician")));
  assert.deepEqual(permissionsFor(user("viewer")), permissionsFor(user("production_supervisor")));
  assert.equal(mapRole("admin"), "super_admin");
  assert.equal(mapRole("operator"), "mould_technician");
  assert.equal(mapRole("viewer"), "production_supervisor");
  assert.equal(mapRole("mould_maker"), "mould_maker");
});

test("admins cannot create, edit or appoint super admins", () => {
  const sa = user("super_admin"), admin = user("admin");
  assert.equal(canManageUser(sa, user("super_admin")), true);
  assert.equal(canManageUser(admin, user("mould_maker")), true);
  assert.equal(canManageUser(admin, user("mould_maker"), "super_admin"), false);
  assert.equal(canManageUser(admin, user("super_admin"), "admin"), false);
  assert.equal(canManageUser(user("mould_technician"), user("mould_maker")), false);
});

test("user API enforces the super admin boundary on the server", async () => {
  const admin = user("admin");
  await assert.rejects(createUser({ user: admin, body: { name: "X", email: "x@example.com", password: "password1", role: "super_admin" } }, {}), (e) => e.status === 403);

  const target = { _id: oid(), role: "super_admin", async save() { throw new Error("must not save"); } };
  mock.method(User, "findById", async () => target);
  await assert.rejects(updateUser({ user: admin, params: { id: "x" }, body: { active: false } }, {}), (e) => e.status === 403);

  const self = { ...user("super_admin"), equals() {} };
  self._id = { equals: () => true };
  mock.method(User, "findById", async () => self);
  await assert.rejects(updateUser({ user: { _id: self._id, role: "super_admin" }, params: { id: "x" }, body: { role: "admin" } }, {}), (e) => e.status === 400);
});

test("requirePermission accepts any listed permission and returns 403 otherwise", () => {
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json() { return this; } };
  let next = false;
  requirePermission("moves.mouldRoom", "workshop.work")({ user: user("mould_maker") }, res, () => { next = true; });
  assert.equal(next, true);
  next = false;
  requirePermission("moves.mouldRoom")({ user: user("production_supervisor") }, res, () => { next = true; });
  assert.equal(next, false); assert.equal(res.statusCode, 403);
});

test("mould invariants: rack in Mould Room, Workshop for service/repair, machine only on MACHINE", () => {
  const ok = { status: "GOOD", location: "MOULD_ROOM", rackId: oid() };
  assert.equal(mouldStateError(ok), null);
  assert.match(mouldStateError({ ...ok, rackId: null }), /needs a rack/);
  assert.equal(mouldStateError({ ...ok, rackId: null, awaitingRack: true }), null);
  assert.match(mouldStateError({ ...ok, status: "NEEDS_REPAIR" }), /cannot be in the Mould Room/);
  assert.match(mouldStateError({ status: "IN_REPAIR", location: "PRODUCTION_FLOOR" }), /must be at the Workshop/);
  assert.equal(mouldStateError({ status: "IN_SERVICE", location: "WORKSHOP" }), null);
  assert.equal(mouldStateError({ status: "NEEDS_SERVICE", location: "MACHINE", machineId: oid() }), null); // rule 8 may flag a mounted mould
  assert.match(mouldStateError({ status: "GOOD", location: "MACHINE" }), /needs a machine/);
  assert.match(mouldStateError({ status: "GOOD", location: "WORKSHOP", rackId: oid() }), /Only a mould in the Mould Room/);

  assert.equal(new Mould({ toolId: "t1", location: "PRODUCTION_FLOOR" }).validateSync(), undefined);
  assert.match(new Mould({ toolId: "t1", location: "MOULD_ROOM" }).validateSync().message, /needs a rack/);
  assert.ok(new Mould({ toolId: "t1", location: "TOOL_ROOM" }).validateSync());
});

test("racks: bulk generation, location IDs and the FLK/CCI A1-C10 defaults", async () => {
  const racks = buildRacks({ zone: "flk", rowFrom: "a", rowTo: "c", from: 1, to: 10 });
  assert.equal(racks.length, 30);
  assert.deepEqual(racks[2], { zone: "FLK", row: "A", number: 3, code: "A3", locationId: "FLK-A3" });
  assert.equal(racks.at(-1).locationId, "FLK-C10");
  assert.throws(() => buildRacks({ zone: "FLK", rowFrom: "C", rowTo: "A", from: 1, to: 2 }), /in order/);
  assert.throws(() => buildRacks({ zone: "FLK", rowFrom: "A", rowTo: "A", from: 5, to: 1 }), /in order/);
  assert.deepEqual(DEFAULT_ZONES.map((z) => z.code), ["FLK", "CCI"]);
  assert.deepEqual(DEFAULT_LAYOUT, { rowFrom: "A", rowTo: "C", from: 1, to: 10 });

  const rack = new Rack({ zone: "cci", row: "B", number: 7, code: "b7" });
  await rack.validate();
  assert.equal(rack.locationId, "CCI-B7");
});

test("movement and audit records are append-only", async () => {
  for (const Model of [Movement, AuditLog]) {
    await assert.rejects(Model.updateOne({}, { $set: { remarks: "x" } }).exec(), /immutable/);
    await assert.rejects(Model.deleteMany({}).exec(), /immutable/);
    await assert.rejects(Model.findOneAndUpdate({}, { $set: {} }).exec(), /immutable/);
  }
  const m = Movement.hydrate({ _id: oid(), mouldId: oid(), toolId: "T1", type: "MOVED", performedBy: oid() });
  m.remarks = "changed";
  await assert.rejects(m.save(), /immutable/);
});

test("migration maps old tools onto moulds without the old removed-from-store state", () => {
  const base = { _id: oid(), toolCode: "T1", size: "80T", products: [{ pid: "P1", desc: "Cap", cav: 4 }], notes: "n", version: 3 };
  const store = toolToMould({ ...base, status: "store" });
  assert.deepEqual([store.location, store.status, store.awaitingRack, String(store._id)], ["MOULD_ROOM", "GOOD", true, String(base._id)]);
  assert.equal(new Mould(store).validateSync(), undefined);

  const machineId = oid();
  const mounted = toolToMould({ ...base, status: "machine", machineId });
  assert.deepEqual([mounted.location, mounted.machineId, mounted.awaitingRack], ["MACHINE", machineId, false]);

  const out = toolToMould({ ...base, status: "taken", takenNote: " Taken by Sunil ", takenAt: new Date(0) });
  assert.deepEqual([out.location, out.status, out.remarks], ["PRODUCTION_FLOOR", "GOOD", "Taken by Sunil"]);
  assert.equal(new Mould(out).validateSync(), undefined);
  assert.throws(() => toolToMould({ ...base, status: "lost" }), /Unknown status/);

  assert.deepEqual(toolToItems(base), [{ mouldId: base._id, itemId: "P1", description: "Cap", cavities: 4, sortOrder: 0 }]);
});

test("migration copies history with location snapshots and keeps it linked", () => {
  const m = { _id: oid(), toolId: oid(), toolCode: "T1", action: "taken_out", fromStatus: "machine", toStatus: "taken",
    fromMachineId: oid(), toMachineId: null, note: "Replaced by T2", performedBy: oid(), createdAt: new Date(5) };
  const moved = mapMovement(m, new Map([[String(m.fromMachineId), "INJ-03"]]));
  assert.deepEqual([moved.type, moved.fromLocation, moved.toLocation, moved.fromMachineCode, moved.remarks],
    ["MOVED", "MACHINE", "PRODUCTION_FLOOR", "INJ-03", "Replaced by T2"]);
  assert.equal(moved.mouldId, m.toolId); assert.equal(moved.legacyMovementId, m._id);
  assert.equal(new Movement(moved).validateSync(), undefined);
  assert.equal(mapMovement({ ...m, action: "deleted", toStatus: null }).toLocation, null);
  assert.throws(() => mapMovement({ ...m, action: "teleported" }), /Unknown history action/);
});

test("migration copies only this app's users and their passkeys from the shared database", () => {
  const mine = { _id: oid(), email: "a@x.com", role: "admin", passwordHash: "h" };
  const op = { _id: oid(), email: "o@x.com", role: "operator", passwordHash: "h" };
  const other = { _id: oid(), email: "s@x.com", role: "Supervisor", password: "p" };
  const otherAdmin = { _id: oid(), email: "b@x.com", role: "Admin", passwordHash: "h" };
  assert.deepEqual([mine, op, other, otherAdmin].map(isAppUser), [true, true, false, false]);

  const machineId = oid();
  const tool = { _id: oid(), toolCode: "T1", status: "machine", machineId, products: [{ pid: "P1", cav: 2 }] };
  const moves = [
    { _id: oid(), toolId: tool._id, toolCode: "T1", action: "assigned", toStatus: "machine", toMachineId: machineId, performedBy: mine._id, createdAt: new Date(2) },
    { _id: oid(), toolId: oid(), toolCode: "GONE", action: "deleted", fromStatus: "store", performedBy: other._id, createdAt: new Date(1) }
  ];
  const plan = buildPlan({
    tools: [tool], toolmovements: moves, machines: [{ _id: machineId, code: "INJ-01" }],
    users: [mine, op, other, otherAdmin], passkeys: [{ userId: mine._id }, { userId: other._id }]
  });
  const s = summarize(plan);
  assert.deepEqual(s.copy, { tools: 1, toolmovements: 2, machines: 1, users: 2, passkeys: 1 });
  assert.deepEqual(s.skipped, { usersOfOtherApp: 2, passkeysOfOtherUsers: 1 });
  assert.deepEqual(s.warnings, { movementsByUncopiedUser: 1, movementsOfDeletedTools: 1, missingMachines: 0 });
  assert.deepEqual(plan.roleChanges.map((c) => [c.from, c.to]), [["admin", "super_admin"], ["operator", "mould_technician"]]);
  assert.equal(plan.copy.toolmovements[0].toolCode, "GONE"); // history is copied oldest first
  assert.equal(plan.moulds[0].lastMovedBy, mine._id);
  assert.equal(plan.movements[1].toMachineCode, "INJ-01");
});
