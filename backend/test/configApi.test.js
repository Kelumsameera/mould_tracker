// Phase C: workflow config API (draft, publish, rollback, export/import, validate, simulate), validation rules,
// dynamic permission keys, custom roles and the locked config.manage capability.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { find } from "mingo";
import WorkflowConfig from "../models/WorkflowConfig.js";
import Mould from "../models/Mould.js";
import Movement from "../models/Movement.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { builtInConfig, getConfig, invalidateConfig, setConfigLoader } from "../lib/configStore.js";
import { validateConfig, diffConfigs, configContent } from "../lib/workflowValidation.js";
import { allPermissionKeys, grantablePermissions, can, canAssignRole, assignableFor, roleKeys, permissionsFor } from "../lib/permissions.js";
import { transitionOf, locationOf } from "../lib/workflowConfig.js";
import { planMove } from "../lib/workflow.js";
import { userAccessSchema, roleAccessSchema, configPublishSchema } from "../validators/schemas.js";
import { configRouteTable } from "../routes/configRoutes.js";
import * as api from "../controllers/configController.js";

const oid = () => new mongoose.Types.ObjectId();
const clone = (x) => JSON.parse(JSON.stringify(x));
const codes = (problems) => problems.map((p) => p.code);
const sys = { _id: oid(), role: "system_admin" };

// ---- In-memory WorkflowConfig ----
let docs, audits;
const wrap = (d) => d && Object.assign(d, { markModified() {}, async save() { return d; }, toObject() { return { ...d }; } });
const chain = (rows, one = false) => ({ sort(spec) { const [k, dir] = Object.entries(spec)[0]; rows = [...rows].sort((a, b) => (a[k] - b[k]) * dir); return this; }, limit(n) { rows = rows.slice(0, n); return this; }, lean: async () => (one ? (rows[0] ? { ...rows[0] } : null) : rows.map((r) => ({ ...r }))), then(ok, ko) { return Promise.resolve(rows[0] ? wrap(rows[0]) : null).then(ok, ko); } });
beforeEach(() => {
  docs = []; audits = [];
  mock.method(WorkflowConfig, "findOne", (filter = {}) => chain(find(docs, filter).all(), true));
  mock.method(WorkflowConfig, "find", (filter = {}) => chain(find(docs, filter).all()));
  mock.method(WorkflowConfig, "create", async (doc) => { const d = wrap({ _id: oid(), ...clone(doc), createdAt: new Date() }); docs.push(d); return d; });
  mock.method(WorkflowConfig, "exists", async (filter) => find(docs, filter).all().length > 0);
  mock.method(WorkflowConfig, "updateMany", async (filter, update) => { for (const d of find(docs, filter).all()) Object.assign(d, update.$set); });
  mock.method(WorkflowConfig, "deleteOne", async (filter) => { docs = docs.filter((d) => !find([d], filter).all().length); });
  mock.method(WorkflowConfig.prototype, "save", async function () { const d = wrap({ ...this.toObject(), _id: this._id }); docs.push(d); return d; });
  for (const M of [Mould, Movement]) mock.method(M, "distinct", async () => []);
  mock.method(User, "distinct", async () => ["admin", "mould_maker"]);
  mock.method(AuditLog, "create", async (e) => { audits.push(Array.isArray(e) ? e[0] : e); return [e]; });
  setConfigLoader(async () => WorkflowConfig.findOne({ state: "published" }).sort({ version: -1 }).lean());
});
afterEach(async () => { mock.restoreAll(); setConfigLoader(null); });

const res = () => { const r = { body: null, json(b) { r.body = b; return r; }, set() { return r; }, status() { return r; } }; return r; };
const call = async (fn, body = {}, extra = {}) => { const r = res(); await fn({ user: sys, body, query: {}, params: {}, ip: "t", accountPrivacy: { ids: [] }, ...extra }, r); return r.body; };

function withCalibrationRoom(base = builtInConfig()) {
  const c = clone(configContent(base));
  c.locations.push({ key: "CALIBRATION_ROOM", labels: { en: "Calibration Room", si: "Calibration කාමරය" }, kind: "simple", active: true, permission: "move.calibration_room" });
  for (const from of [null, ...c.locations.map((l) => l.key)]) c.transitions.push({ from, to: "CALIBRATION_ROOM", allowed: from === "WORKSHOP", via: null, permissions: [["move.calibration_room"]], requires: [] });
  for (const to of c.locations.map((l) => l.key)) c.transitions.push({ from: "CALIBRATION_ROOM", to, allowed: to === "MOULD_ROOM", via: null, permissions: to === "MOULD_ROOM" ? [["move.mouldroom"]] : [], requires: [] });
  c.roles.push({ key: "quality_inspector", labels: { en: "Quality Inspector", si: "තත්ත්ව පරීක්ෂක" }, builtIn: false, active: true, permissions: ["mould.view", "move.calibration_room", "move.mouldroom"], assignable: [] });
  c.roles.find((r) => r.key === "super_admin").assignable.push("quality_inspector");
  return c;
}

// ---- Validation ----
test("the built-in config is valid; the Calibration Room variant too", () => {
  assert.deepEqual(validateConfig(builtInConfig()), []);
  assert.deepEqual(validateConfig(withCalibrationRoom()), []);
});

test("validation rejects unreachable / dead-end locations, dead-end statuses and missing labels", () => {
  const c = withCalibrationRoom();
  for (const t of c.transitions) if (t.to === "CALIBRATION_ROOM") t.allowed = false;
  assert.ok(codes(validateConfig(c)).includes("UNREACHABLE_LOCATION"));
  const d = withCalibrationRoom();
  for (const t of d.transitions) if (t.from === "CALIBRATION_ROOM") t.allowed = false;
  assert.ok(codes(validateConfig(d)).includes("DEAD_END_LOCATION"));
  const e = clone(configContent(builtInConfig()));
  e.statuses.push({ key: "LOST", labels: { en: "Lost", si: "" }, active: true, allowedLocations: ["NOWHERE"], moveTo: [] });
  assert.ok(["DEAD_END_STATUS", "MISSING_LABEL", "UNKNOWN_LOCATION"].every((x) => codes(validateConfig(e)).includes(x)));
});

test("validation: via cycles, orphan and locked permissions, system-critical items, built-in roles, used keys", () => {
  const c = clone(configContent(builtInConfig()));
  transitionOf(c, "MACHINE", "ISOLATION").via = "WORKSHOP";
  transitionOf(c, "MACHINE", "WORKSHOP").via = "ISOLATION";
  assert.ok(codes(validateConfig(c)).includes("VIA_CYCLE"));
  const o = clone(configContent(builtInConfig()));
  transitionOf(o, "ISOLATION", "WORKSHOP").permissions = [["move.nowhere"]];
  o.roles.find((r) => r.key === "admin").permissions.push("access.manage");
  assert.ok(codes(validateConfig(o)).includes("ORPHAN_PERMISSION") && codes(validateConfig(o)).includes("LOCKED_PERMISSION"));
  const m = clone(configContent(builtInConfig()));
  locationOf(m, "MACHINE").active = false;
  m.locations.find((l) => l.kind === "rack").kind = "simple";
  m.statuses.find((s) => s.key === "GOOD").active = false;
  m.roles = m.roles.filter((r) => r.key !== "executive");
  assert.ok(["MACHINE_LOCATION", "RACK_LOCATION", "GOOD_STATUS", "BUILT_IN_ROLE"].every((x) => codes(validateConfig(m)).includes(x)));
  const u = clone(configContent(builtInConfig()));
  u.locations = u.locations.filter((l) => l.key !== "TOOL_ROOM");
  assert.ok(codes(validateConfig(u, { usedLocations: ["TOOL_ROOM"] })).includes("LOCATION_IN_USE"));
  const r = withCalibrationRoom();
  r.roles = r.roles.filter((x) => x.key !== "quality_inspector");
  assert.ok(codes(validateConfig(r, { usedRoles: ["quality_inspector"] })).includes("ROLE_IN_USE"));
  const s = clone(configContent(builtInConfig()));
  s.roles.find((x) => x.key === "super_admin").assignable.push("system_admin");
  assert.ok(codes(validateConfig(s)).includes("LOCKED_ROLE"));
});

test("diff lists added / removed / changed entries per section", () => {
  const a = configContent(builtInConfig());
  const b = withCalibrationRoom();
  transitionOf(b, "MACHINE", "PRODUCTION_FLOOR").via = null;
  const d = diffConfigs(a, b);
  assert.deepEqual(d.locations.added, ["CALIBRATION_ROOM"]);
  assert.deepEqual(d.roles.added, ["quality_inspector"]);
  assert.ok(d.transitions.changed.some((x) => x.key === "MACHINE>PRODUCTION_FLOOR" && x.fields.includes("via")));
  assert.deepEqual(diffConfigs(a, a), {});
});

// ---- API flow ----
test("draft -> publish changes behaviour for the next request; rollback restores it; every step audited", async () => {
  const onMachine = { _id: oid(), toolId: "A1", location: "MACHINE", status: "GOOD", machineId: oid(), machine: { code: "INJ-01" } };
  const superAdmin = { _id: oid(), role: "super_admin" };
  assert.throws(() => planMove({ mould: onMachine, user: superAdmin, to: "PRODUCTION_FLOOR" }), (e) => e.details?.code === "ISOLATION_FIRST");

  // Version 1 = built-in, then a draft without the Isolation requirement for Machine -> Floor.
  docs.push(wrap({ ...clone(configContent(builtInConfig())), version: 1, state: "published" }));
  await invalidateConfig();
  const draft = clone(configContent(getConfig()));
  transitionOf(draft, "MACHINE", "PRODUCTION_FLOOR").via = null;
  const saved = await call(api.saveDraft, { config: draft });
  assert.deepEqual([saved.meta.version, saved.meta.state, saved.problems], [2, "draft", []]);
  assert.throws(() => planMove({ mould: onMachine, user: superAdmin, to: "PRODUCTION_FLOOR" }), (e) => e.details?.code === "ISOLATION_FIRST", "a draft changes nothing");

  // Simulator on the draft already shows the new answer.
  const sim = await call(api.simulate, { mould: { location: "MACHINE", status: "GOOD" }, to: "PRODUCTION_FLOOR", draft: true });
  assert.equal(sim.verdict.ok, true);

  await call(api.publish, { reason: "Floor moves direct for trials" });
  assert.equal(getConfig().version, 2);
  assert.equal(planMove({ mould: onMachine, user: superAdmin, to: "PRODUCTION_FLOOR" }).set.location, "PRODUCTION_FLOOR");
  assert.equal(docs.find((d) => d.version === 1).state, "archived");

  const rolled = await call(api.rollback, { version: 1, reason: "Back to the standard flow" });
  assert.deepEqual([rolled.meta.version, rolled.meta.basedOn, getConfig().version], [3, 1, 3]);
  assert.throws(() => planMove({ mould: onMachine, user: superAdmin, to: "PRODUCTION_FLOOR" }), (e) => e.details?.code === "ISOLATION_FIRST");

  assert.deepEqual(audits.map((a) => a.action), ["workflow.draft.saved", "workflow.published", "workflow.rolledback"]);
  assert.ok(audits[1].after.diff.transitions.changed.length && audits[1].reason);
});

test("publish refuses an invalid draft with the list of problems", async () => {
  const bad = clone(configContent(builtInConfig()));
  bad.locations.push({ key: "NOWHERE", labels: { en: "Nowhere", si: "කොහෙවත් නෑ" }, kind: "simple", active: true });
  await call(api.saveDraft, { config: bad });
  await assert.rejects(call(api.publish, { reason: "try it" }), (e) => e.details?.code === "CONFIG_INVALID" && e.details.problems.some((p) => p.code === "UNREACHABLE_LOCATION"));
  assert.equal(getConfig().version, 0, "still the built-in config");
});

test("export / import: import validates and becomes the draft, never published directly", async () => {
  const exported = await call(api.exportConfig);
  assert.equal(exported.format, "mould-tracker-workflow");
  const imported = await call(api.importConfig, { config: withCalibrationRoom(exported.config), reason: "from test site" });
  assert.equal(imported.meta.state, "draft");
  assert.equal(getConfig().version, 0);
  await assert.rejects(call(api.importConfig, { config: { ...exported.config, locations: [] }, reason: "broken" }), (e) => e.details?.code === "CONFIG_INVALID" || e.details?.code === "DRAFT_EXISTS");
});

// ---- Roles and permission keys ----
test("custom role Quality Inspector and the new move permission work once published", async () => {
  docs.push(wrap({ ...withCalibrationRoom(), version: 5, state: "published" }));
  await invalidateConfig();
  assert.ok(roleKeys().includes("quality_inspector"));
  assert.ok(allPermissionKeys().includes("move.calibration_room") && grantablePermissions().includes("move.calibration_room"));
  const qi = { _id: oid(), role: "quality_inspector" };
  assert.deepEqual(permissionsFor(qi).sort(), ["mould.view", "move.calibration_room", "move.mouldroom"].sort());
  assert.equal(can(qi, "move.machine"), false);
  const shop = { _id: oid(), toolId: "Q1", toolType: "INJECTION_MOULD", location: "WORKSHOP", status: "GOOD" };
  assert.equal(planMove({ mould: shop, user: qi, to: "CALIBRATION_ROOM" }).set.location, "CALIBRATION_ROOM");
  assert.equal(canAssignRole({ role: "super_admin" }, "quality_inspector"), true);
  assert.equal(canAssignRole({ role: "admin" }, "quality_inspector"), false);
  assert.ok(assignableFor("system_admin").includes("quality_inspector"));
  assert.equal(userAccessSchema.safeParse({ grant: ["move.calibration_room"], reason: "cover" }).success, true);
});

test("config.manage and access.manage stay System Administrator only and are never grantable", () => {
  assert.equal(can(sys, "config.manage"), true);
  for (const role of ["super_admin", "admin", "executive"]) assert.equal(can({ role, permissionOverrides: { grant: ["config.manage"], deny: [] } }, "config.manage"), false);
  assert.equal(grantablePermissions().includes("config.manage"), false);
  assert.equal(userAccessSchema.safeParse({ grant: ["config.manage"], reason: "nope" }).success, false);
  assert.equal(roleAccessSchema.safeParse({ permissions: ["config.manage"], reason: "nope" }).success, false);
});

test("config routes: editing needs config.manage; reading is open to signed-in users; a reason is required", () => {
  const perms = Object.fromEntries(configRouteTable.map(([m, p, perm]) => [`${m} ${p}`, perm]));
  for (const k of ["put /draft", "post /publish", "post /rollback", "post /import", "get /export", "delete /draft", "post /validate"]) assert.deepEqual(perms[k], ["config.manage"], k);
  assert.equal(perms["get /"], "signed-in");
  assert.equal(configPublishSchema.safeParse({}).success, false);
});
