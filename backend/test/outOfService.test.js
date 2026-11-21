import { setSettingsLoader, refreshSettings } from "../lib/settings.js";
setSettingsLoader(async () => [{ kind: "setting", key: "moves.unrestricted", value: false }]);
await refreshSettings();
import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { ROLES, can } from "../lib/permissions.js";
import { canMove, planMove, planInitialLocation } from "../lib/workflow.js";
import Movement from "../models/Movement.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import User from "../models/User.js";
import Item from "../models/Item.js";
import AuditLog from "../models/AuditLog.js";
import { moveMould } from "../controllers/mouldController.js";
import { mouldDTO, movementDTO } from "../utils/serializers.js";
import Mould from "../models/Mould.js";
import { moveMouldSchema } from "../validators/schemas.js";

afterEach(() => mock.restoreAll());

const user = role => ({ _id: new mongoose.Types.ObjectId(), role });
const mould = (patch = {}) => ({ _id: new mongoose.Types.ObjectId(), toolId: "TEST-1", location: "WORKSHOP", status: "IN_REPAIR", totalShots: 120, ...patch });
const dispatch = { recipientName: "Repair Company", address: "12 Factory Road", repairDetails: "Replace damaged insert" };
const code = name => error => error.details?.code === name;

test("only Super Admin and System Administrator can send or return, even with custom grants", () => {
  for (const role of ROLES) {
    const actor = { ...user(role), permissionOverrides: ["move.outOfService", "workshop.work", "moves.machine"] };
    const expected = ["super_admin", "system_admin"].includes(role);
    assert.equal(can(actor, "move.outOfService"), expected, role);
    assert.equal(canMove(actor, "WORKSHOP", "OUT_OF_SERVICE"), expected, role);
    assert.equal(canMove(actor, "OUT_OF_SERVICE", "WORKSHOP"), expected, role);
    if (!expected) assert.throws(() => planMove({ mould: mould(), user: actor, to: "OUT_OF_SERVICE", outOfServiceDetails: dispatch, remarks: "External repair" }), code("FORBIDDEN_MOVE"));
  }
});

test("sending preserves status and shot counters and records a valid movement", () => {
  for (const status of ["GOOD", "NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR"]) {
    const current = mould({ status });
    const plan = planMove({ mould: current, user: user("super_admin"), to: "OUT_OF_SERVICE", outOfServiceDetails: dispatch, remarks: "External repair vendor" });
    assert.equal(plan.set.status, status);
    assert.equal(plan.set.location, "OUT_OF_SERVICE");
    assert.equal(plan.movement.fromLocation, "WORKSHOP");
    assert.equal(plan.movement.toLocation, "OUT_OF_SERVICE");
    assert.equal(plan.movement.remarks, "External repair vendor");
    assert.equal(plan.set.totalShots, undefined);
    assert.equal(new Mould({ ...current, ...plan.set }).validateSync(), undefined);
  }
});

test("outside tools can move to every destination without bypassing repair completion", () => {
  const actor = user("super_admin");
  for (const to of ["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP"]) {
    assert.equal(canMove(actor, "OUT_OF_SERVICE", to), true, to);
  }
  for (const from of ["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM"]) {
    assert.equal(canMove(actor, from, "OUT_OF_SERVICE"), true, from);
  }
  const current = mould({ location: "OUT_OF_SERVICE" });
  const returned = planMove({ mould: current, user: actor, to: "WORKSHOP", remarks: "Received back" });
  assert.equal(returned.set.status, "IN_REPAIR");
  assert.equal(returned.set.location, "WORKSHOP");
  assert.throws(() => planMove({ mould: current, user: actor, to: "WORKSHOP", status: "GOOD", remarks: "Received" }), code("OUT_OF_SERVICE_STATUS"));
});

test("remarks are required in both directions and new tools cannot start outside", () => {
  const actor = user("super_admin");
  assert.throws(() => planMove({ mould: mould(), user: actor, to: "OUT_OF_SERVICE", outOfServiceDetails: dispatch, remarks: " " }), code("REMARKS_REQUIRED"));
  assert.throws(() => planMove({ mould: mould({ location: "OUT_OF_SERVICE" }), user: actor, to: "WORKSHOP" }), code("REMARKS_REQUIRED"));
  assert.throws(() => planInitialLocation({ user: actor, location: "OUT_OF_SERVICE" }), code("INVALID_LOCATION"));
  assert.ok(moveMouldSchema.safeParse({ to: "OUT_OF_SERVICE", outOfServiceDetails: dispatch, remarks: "External service" }).success);
});


test("all source locations can dispatch outside, clearing the old mounting and rack", () => {
  for (const location of ["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP"]) {
    const current = mould({ location, status: "GOOD", toolType: location === "TOOL_ROOM" ? "EXTRUSION_DIE" : "INJECTION_MOULD", machineId: location === "MACHINE" ? new mongoose.Types.ObjectId() : null, rackId: location === "MOULD_ROOM" ? new mongoose.Types.ObjectId() : null });
    const plan = planMove({ mould: current, user: user("super_admin"), to: "OUT_OF_SERVICE", outOfServiceDetails: dispatch, remarks: "External service" });
    assert.equal(plan.set.machineId, null);
    assert.equal(plan.set.rackId, null);
    assert.equal(plan.movement.fromLocation, location);
    assert.equal(new Mould({ ...current, ...plan.set }).validateSync(), undefined);
  }
});

test("return destinations still validate status, capability, occupancy and storage type", () => {
  const actor = user("super_admin");
  const machine = { _id: new mongoose.Types.ObjectId(), code: "INJ-01", active: true };
  const rack = { _id: new mongoose.Types.ObjectId(), active: true, zoneActive: true, zone: "FLK", locationId: "FLK-A1", capacity: 1 };
  const current = mould({ location: "OUT_OF_SERVICE", status: "GOOD", capableMachines: [machine.code] });
  for (const [to, extra] of [["MACHINE", { machine }], ["PRODUCTION_FLOOR", {}], ["MOULD_ROOM", { rack }], ["TOOL_ROOM", {}], ["WORKSHOP", {}]]) {
    const start = { ...current, toolType: to === "TOOL_ROOM" ? "EXTRUSION_DIE" : "INJECTION_MOULD" };
    const plan = planMove({ mould: start, user: actor, to, remarks: "Received back", ...extra });
    assert.equal(new Mould({ ...start, ...plan.set }).validateSync(), undefined, to);
  }
  assert.throws(() => planMove({ mould: { ...current, status: "IN_REPAIR" }, user: actor, to: "MACHINE", machine, remarks: "Received" }), code("NOT_GOOD"));
  assert.throws(() => planMove({ mould: current, user: actor, to: "MACHINE", machine, occupant: { _id: new mongoose.Types.ObjectId(), toolId: "BUSY" }, remarks: "Received" }), code("MACHINE_OCCUPIED"));
  assert.throws(() => planMove({ mould: current, user: actor, to: "MOULD_ROOM", rack, rackOccupancy: 1, remarks: "Received" }), code("RACK_FULL"));
  assert.throws(() => planMove({ mould: current, user: actor, to: "TOOL_ROOM", remarks: "Received" }), code("INVALID_LOCATION"));
  assert.throws(() => planMove({ mould: current, user: actor, to: "PRODUCTION_FLOOR" }), code("REMARKS_REQUIRED"));
  assert.equal(canMove(actor, "OUT_OF_SERVICE", "OUT_OF_SERVICE"), false);
});


test("dispatch details are required, trimmed, bounded and rejected for unrelated destinations", () => {
  for (const invalid of [undefined, {}, { ...dispatch, address: " " }, { ...dispatch, recipientName: "x".repeat(151) }, { ...dispatch, address: "x".repeat(501) }, { ...dispatch, repairDetails: "x".repeat(2001) }]) {
    assert.equal(moveMouldSchema.safeParse({ to: "OUT_OF_SERVICE", outOfServiceDetails: invalid, remarks: "Send" }).success, false);
    assert.throws(() => planMove({ mould: mould(), user: user("super_admin"), to: "OUT_OF_SERVICE", outOfServiceDetails: invalid, remarks: "Send" }), code("DISPATCH_DETAILS_REQUIRED"));
  }
  assert.equal(moveMouldSchema.safeParse({ to: "WORKSHOP", outOfServiceDetails: dispatch }).success, false);
  assert.equal(moveMouldSchema.safeParse({ to: "OUT_OF_SERVICE", outOfServiceDetails: { ...dispatch, sentAt: new Date() } }).success, false);
});

test("each dispatch is retained in history, and return dates do not overwrite the original dispatch", () => {
  const sentAt = new Date("2026-10-29T06:00:00Z");
  const returnedAt = new Date("2026-10-30T06:00:00Z");
  const initial = mould();
  const sent = planMove({ mould: initial, user: user("super_admin"), to: "OUT_OF_SERVICE", outOfServiceDetails: { ...dispatch, recipientName: "  Repair Company  " }, remarks: dispatch.repairDetails, now: sentAt });
  assert.equal(sent.set.outOfServiceDetails.recipientName, dispatch.recipientName);
  assert.equal(sent.set.outOfServiceDetails.sentAt, sentAt);
  assert.equal(sent.movement.outOfServiceDetails.returnedAt, null);
  const outside = { ...initial, ...sent.set };
  const returned = planMove({ mould: outside, user: user("super_admin"), to: "WORKSHOP", remarks: "Received back", now: returnedAt });
  assert.equal(returned.set.outOfServiceDetails.returnedAt, returnedAt);
  assert.equal(sent.movement.outOfServiceDetails.returnedAt, null);
  const resent = planMove({ mould: { ...outside, ...returned.set }, user: user("super_admin"), to: "OUT_OF_SERVICE", outOfServiceDetails: { ...dispatch, recipientName: "Second Company" }, remarks: "Send again" });
  assert.equal(resent.set.outOfServiceDetails.recipientName, "Second Company");
  assert.equal(returned.movement.outOfServiceDetails.recipientName, "Repair Company");
  assert.equal(new Mould({ ...initial, ...sent.set }).validateSync(), undefined);
});


test("move controller saves dispatch details to mould, immutable movement, audit and API response", async () => {
  const actor = { ...user("super_admin"), name: "Super Admin" };
  const doc = new Mould(mould());
  const movements = [], audits = [];
  let saved;
  mock.method(mongoose, "startSession", async () => ({ withTransaction: async work => work(), endSession: async () => {} }));
  mock.method(doc, "save", async () => { saved = doc.toObject(); return doc; });
  mock.method(Mould, "findById", () => ({ session: async () => doc, lean: async () => doc.toObject() }));
  for (const model of [Machine, Rack, User]) mock.method(model, "find", () => ({ lean: async () => [] }));
  mock.method(Item, "find", () => ({ sort() { return this; }, lean: async () => [] }));
  mock.method(Movement, "create", async entries => { movements.push(...entries); return entries; });
  mock.method(AuditLog, "create", async entries => { audits.push(...entries); return entries; });
  const res = { status() { return this; }, json(body) { this.body = body; } };
  await moveMould({ user: actor, params: { id: String(doc._id) }, body: moveMouldSchema.parse({ to: "OUT_OF_SERVICE", outOfServiceDetails: dispatch, remarks: dispatch.repairDetails, version: doc.version }) }, res);
  assert.equal(saved.location, "OUT_OF_SERVICE");
  assert.equal(saved.outOfServiceDetails.recipientName, dispatch.recipientName);
  assert.equal(movements[0].outOfServiceDetails.address, dispatch.address);
  assert.equal(new Movement(movements[0]).validateSync(), undefined);
  assert.equal(audits[0].after.outOfServiceDetails.repairDetails, dispatch.repairDetails);
  assert.equal(res.body.mould.outOfServiceDetails.recipientName, dispatch.recipientName);
  assert.equal(movementDTO({ ...movements[0], _id: new mongoose.Types.ObjectId() }).outOfServiceDetails.address, dispatch.address);
  assert.equal(mouldDTO(mould()).outOfServiceDetails, null);
  assert.equal(movementDTO({ _id: new mongoose.Types.ObjectId() }).outOfServiceDetails, null);
});
