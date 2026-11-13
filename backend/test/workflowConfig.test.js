// Configurable workflow: the built-in config equals the original hard-coded rules, and behaviour can be changed
// through config only (new location, status, role, removed "via"). Existing rule tests run unchanged on top.
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { builtInConfig, registerConfigKeys } from "../lib/configStore.js";
import { evaluateMove } from "../lib/evaluateMove.js";
import { planMove, planStatus, movePermissionGroups, canMove, planInitialLocation } from "../lib/workflow.js";
import { mouldStateError } from "../lib/mouldState.js";
import { locationOf, transitionOf } from "../lib/workflowConfig.js";
import { planSeed } from "../scripts/seed-workflow-config.mjs";
import Mould from "../models/Mould.js";
import Movement from "../models/Movement.js";

const oid = () => new mongoose.Types.ObjectId();
const SA = { _id: oid(), role: "super_admin" };
const code = (c) => (e) => e.details?.code === c;
const clone = (x) => JSON.parse(JSON.stringify(x));

// The rules exactly as they were hard-coded before the config existed.
const STORAGE = ["MOULD_ROOM", "TOOL_ROOM"];
function originalGroups(from, to) {
  if (from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return [["move.outOfService"]];
  const g = [];
  if ((STORAGE.includes(from) && to !== "MACHINE") || STORAGE.includes(to)) g.push(["move.mouldroom"]);
  if (to === "ISOLATION") g.push(["move.isolation"]);
  if (to === "MACHINE") g.push(["move.machine"]);
  if (to === "WORKSHOP") g.push(["move.workshop"]);
  if (to === "PRODUCTION_FLOOR" && !STORAGE.includes(from)) g.push(from === "WORKSHOP" ? ["move.floor", "move.workshop"] : ["move.floor"]);
  return g;
}
function originalRoute(from, to) {
  if (from == null || from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return null;
  if (to === "MACHINE") return ["PRODUCTION_FLOOR", "ISOLATION", "MOULD_ROOM", "TOOL_ROOM", "MACHINE"].includes(from) ? null : "ISOLATION_FIRST";
  if (to === "ISOLATION") return from === "ISOLATION" ? "NO_CHANGE" : null;
  if (from === to) return null;
  return from === "ISOLATION" ? null : "ISOLATION_FIRST";
}

test("built-in config = original rules for every from/to pair (permissions and Isolation routing)", () => {
  const config = builtInConfig();
  const keys = config.locations.map((l) => l.key);
  assert.deepEqual(keys, ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP", "OUT_OF_SERVICE"]);
  for (const from of [null, ...keys]) for (const to of keys) {
    assert.deepEqual(movePermissionGroups(from, to, config), originalGroups(from, to), `${from} -> ${to}`);
    const t = transitionOf(config, from, to);
    assert.equal(t.via ? "ISOLATION_FIRST" : (from && from === to && to === "ISOLATION" ? "NO_CHANGE" : null), originalRoute(from, to), `${from} -> ${to}`);
  }
  assert.equal(canMove({ role: "super_admin" }, "OUT_OF_SERVICE", "OUT_OF_SERVICE", config), false);
});

test("seeded labels for the extra locations; roles seeded from the permission table", () => {
  const c = builtInConfig();
  assert.deepEqual(locationOf(c, "TOOL_ROOM").labels, { en: "Mould Room – Extrusion", si: "Mould කාමරය – Extrusion" });
  assert.deepEqual(locationOf(c, "OUT_OF_SERVICE").labels, { en: "Outside Repair", si: "පිටත repair" });
  assert.notEqual(locationOf(c, "TOOL_ROOM").labels.en, locationOf(c, "MOULD_ROOM").labels.en);
  const exec = c.roles.find((r) => r.key === "executive");
  assert.ok(exec.builtIn && exec.permissions.includes("mould.view") && !exec.permissions.includes("move.machine"));
  assert.ok(c.roles.find((r) => r.key === "system_admin").locked);
});

test("evaluateMove: path, required fields and translated error codes", () => {
  const c = builtInConfig();
  const onMachine = { _id: oid(), toolId: "A1", location: "MACHINE", status: "GOOD", machineId: oid() };
  const blocked = evaluateMove(c, onMachine, { user: SA, to: "MOULD_ROOM" });
  assert.deepEqual([blocked.ok, blocked.errors[0].code, blocked.path], [false, "ISOLATION_FIRST", ["MACHINE", "ISOLATION", "MOULD_ROOM"]]);
  const ok = evaluateMove(c, { ...onMachine, location: "ISOLATION", machineId: null }, { user: SA, to: "MOULD_ROOM" });
  assert.deepEqual([ok.ok, ok.requiredFields], [true, ["rack"]]);
  assert.deepEqual(evaluateMove(c, onMachine, { user: SA, to: "ISOLATION", status: "NEEDS_REPAIR", remarks: "x" }).requiredFields, ["remarks"]);
  assert.deepEqual(evaluateMove(c, { ...onMachine, location: "ISOLATION", machineId: null }, { user: SA, to: "WORKSHOP", remarks: "x" }).requiredFields, ["remarks"]);
});

// ---- Behaviour changed through config only ----
function withCalibrationRoom() {
  const c = clone(builtInConfig());
  c.version = 2;
  c.locations.push({ key: "CALIBRATION_ROOM", labels: { en: "Calibration Room", si: "Calibration කාමරය" }, kind: "simple", active: true, sortOrder: 65, permission: "move.calibration_room" });
  for (const from of [null, ...c.locations.map((l) => l.key)]) {
    c.transitions.push({ from, to: "CALIBRATION_ROOM", allowed: from === "WORKSHOP", via: null, permissions: [["move.calibration_room"]], requires: [] });
  }
  for (const to of c.locations.map((l) => l.key)) {
    c.transitions.push({ from: "CALIBRATION_ROOM", to, allowed: to === "MOULD_ROOM", via: null, permissions: to === "MOULD_ROOM" ? [["move.mouldroom"]] : [], requires: [] });
  }
  for (const s of c.statuses) if (Array.isArray(s.allowedLocations) && s.isGood) s.allowedLocations.push("CALIBRATION_ROOM");
  c.statuses.push({ key: "CALIBRATING", labels: { en: "Calibrating", si: "Calibrate වෙමින්" }, active: true, allowedLocations: ["CALIBRATION_ROOM", "WORKSHOP"], moveTo: ["CALIBRATION_ROOM"] });
  return c;
}

test("config only: Workshop -> Calibration Room -> Mould Room works; other moves into it are refused", () => {
  const c = withCalibrationRoom();
  const user = { _id: oid(), role: "super_admin", permissionOverrides: { grant: [], deny: [] } };
  const shop = { _id: oid(), toolId: "C1", toolType: "INJECTION_MOULD", location: "WORKSHOP", status: "GOOD", owner: "FLK" };
  // The permission is new: grant it to the user (custom keys arrive in Phase C; here we use a role matrix row).
  const granted = { ...user, rolePermissionOverrides: [...builtInConfig().roles.find((r) => r.key === "super_admin").permissions] };
  const can = { ...granted, permissionOverrides: null };
  // Without the new permission: refused.
  assert.throws(() => planMove({ mould: shop, user: can, to: "CALIBRATION_ROOM", remarks: "x", config: c }), code("FORBIDDEN_MOVE"));
  // A role whose permission list includes the new key (role permissions are config data).
  const inspector = { _id: oid(), role: "super_admin", rolePermissionOverrides: ["move.calibration_room", "move.mouldroom"] };
  const r1 = planMove({ mould: shop, user: inspector, to: "CALIBRATION_ROOM", config: c });
  const atCal = { ...shop, ...r1.set };
  assert.equal(mouldStateError(atCal, c), null);
  const r2 = planMove({ mould: atCal, user: inspector, to: "MOULD_ROOM", rack: { _id: oid(), zone: "FLK", locationId: "FLK-A1", active: true, zoneActive: true }, config: c });
  assert.equal(r2.set.location, "MOULD_ROOM");
  assert.throws(() => planMove({ mould: { ...shop, location: "ISOLATION" }, user: inspector, to: "CALIBRATION_ROOM", config: c }), code("FORBIDDEN_MOVE"));
});

test("config only: new status allowed where configured; validation uses the config", () => {
  const c = withCalibrationRoom();
  assert.equal(mouldStateError({ location: "CALIBRATION_ROOM", status: "CALIBRATING" }, c), null);
  assert.ok(mouldStateError({ location: "MACHINE", machineId: oid(), status: "CALIBRATING" }, c));
  assert.ok(mouldStateError({ location: "CALIBRATION_ROOM", status: "GOOD" }, builtInConfig()), "unknown in the built-in config");
});

test("config only: removing the Isolation requirement for one transition allows the direct move", () => {
  const c = clone(builtInConfig());
  const onMachine = { _id: oid(), toolId: "A1", location: "MACHINE", status: "GOOD", machineId: oid(), machine: { code: "INJ-01" } };
  assert.throws(() => planMove({ mould: onMachine, user: SA, to: "PRODUCTION_FLOOR", config: c }), code("ISOLATION_FIRST"));
  transitionOf(c, "MACHINE", "PRODUCTION_FLOOR").via = null;
  assert.equal(planMove({ mould: onMachine, user: SA, to: "PRODUCTION_FLOOR", config: c }).set.location, "PRODUCTION_FLOOR");
  assert.throws(() => planMove({ mould: onMachine, user: SA, to: "WORKSHOP", remarks: "x", config: c }), code("ISOLATION_FIRST"), "other transitions unchanged");
});

test("config only: thresholds, status rules and where status changes happen", () => {
  const c = clone(builtInConfig());
  locationOf(c, "WORKSHOP").statusChange = false;
  const shop = { _id: oid(), toolId: "W1", location: "WORKSHOP", status: "NEEDS_REPAIR" };
  assert.throws(() => planStatus({ mould: shop, user: SA, status: "IN_REPAIR", remarks: "x", config: c }), code("NOT_AT_WORKSHOP"));
  assert.equal(planStatus({ mould: shop, user: SA, status: "IN_REPAIR", remarks: "x" }).set.status, "IN_REPAIR", "built-in unchanged");
  assert.throws(() => planInitialLocation({ user: SA, location: "ISOLATION" }), code("INVALID_LOCATION"));
});

test("new location keys are accepted by the models once the config is registered", async () => {
  const c = withCalibrationRoom();
  assert.ok(new Movement({ mouldId: oid(), toolId: "X", type: "MOVED", toLocation: "CALIBRATION_ROOM", performedBy: oid() }).validateSync());
  await registerConfigKeys(c);
  assert.equal(new Movement({ mouldId: oid(), toolId: "X", type: "MOVED", toLocation: "CALIBRATION_ROOM", toStatus: "CALIBRATING", performedBy: oid() }).validateSync(), undefined);
  assert.ok(Mould.schema.path("location").enumValues.includes("CALIBRATION_ROOM"));
});

test("seed: one published version from the built-in defaults, idempotent", () => {
  const doc = planSeed(0, new Date(0));
  assert.deepEqual([doc.version, doc.state, doc.locations.length, doc.statuses.length], [1, "published", 7, 6]);
  assert.equal(planSeed(1), null);
});
