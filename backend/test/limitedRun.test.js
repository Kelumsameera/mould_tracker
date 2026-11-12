// Step 5: running with blocked cavities (limited run).
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { planCavities, buildDowntime, totalCavities } from "../lib/cavities.js";
import { planMove } from "../lib/workflow.js";
import { mouldStateError } from "../lib/mouldState.js";
import { LIMITED_RUN_ALERT_DAYS, limitedRunLevel } from "../lib/flowConfig.js";
import { mouldDTO } from "../utils/serializers.js";
import Movement from "../models/Movement.js";
import WorkLog from "../models/WorkLog.js";
import Mould from "../models/Mould.js";
import { createWorkLogSchema, cavitiesSchema } from "../validators/schemas.js";

const oid = () => new mongoose.Types.ObjectId();
const tech = { _id: oid(), role: "mould_technician", name: "Tech" };
const INJ3 = { _id: oid(), code: "INJ-03", active: true };
const code = (c) => (e) => e.details?.code === c;
const mould = (patch = {}) => ({ _id: oid(), toolId: "FLK100", toolType: "INJECTION_MOULD", status: "GOOD", location: "MACHINE", machineId: INJ3._id, machine: INJ3,
  rackId: null, capableMachines: ["INJ-03"], totalShots: 10, blockedCavities: [], limitedRun: null, ...patch });
const block = (m, blocked, extra = {}) => planCavities({ mould: m, user: tech, blocked, total: 16, reason: "cracked core pins", ...extra });
const apply = (m, plan) => ({ ...m, ...plan.set });

test("total cavities is the sum of the items' cavities", () => {
  assert.equal(totalCavities([{ cavities: 8 }, { cavities: 8 }, { cavities: null }]), 16);
  assert.equal(totalCavities([]), 0);
});

test("allowed on a machine, the Production Floor and in Isolation", () => {
  for (const [location, extra] of [["MACHINE", {}], ["PRODUCTION_FLOOR", { machineId: null, machine: null }], ["ISOLATION", { machineId: null, machine: null }]]) {
    const m = mould({ location, ...extra });
    const plan = block(m, [3, 7, 11, 15]);
    const next = apply(m, plan);
    assert.equal(next.status, "RUNNING_LIMITED", location);
    assert.deepEqual(next.blockedCavities, [3, 7, 11, 15]);
    assert.equal(mouldStateError(next), null, location);
  }
});

test("rejected in the Mould Room (and the model refuses RUNNING_LIMITED there)", () => {
  const m = mould({ location: "MOULD_ROOM", machineId: null, machine: null, rackId: oid() });
  assert.throws(() => block(m, [1]), code("LIMITED_RUN_LOCATION"));
  assert.ok(mouldStateError({ ...m, status: "RUNNING_LIMITED" }));
});

test("input checks: numbering, at least one active cavity, a reason, real cavity count", () => {
  const m = mould();
  assert.throws(() => block(m, [0]), code("INVALID_CAVITIES"));
  assert.throws(() => block(m, [17]), code("INVALID_CAVITIES"));
  assert.throws(() => block(m, [2, 2]), code("INVALID_CAVITIES"));
  assert.throws(() => block(m, Array.from({ length: 16 }, (_, i) => i + 1)), code("ALL_CAVITIES_BLOCKED"));
  assert.throws(() => block(m, [1], { reason: " " }), code("REASON_REQUIRED"));
  assert.throws(() => planCavities({ mould: m, user: tech, blocked: [1], total: 0, reason: "x" }), code("NO_CAVITIES"));
  assert.throws(() => block(m, []), code("NO_CHANGE"));
});

test("every change is recorded: movement, work log entry with snapshots, audit before/after", () => {
  const now = new Date("2026-11-10T08:00:00Z");
  const plan = block(mould(), [3, 7, 11, 15], { now, expectedFixBy: "2026-11-20T00:00:00Z", problemType: "core pin" });
  assert.equal(plan.action, "mould.cavities.blocked");
  assert.equal(plan.movement.type, "CAVITIES_CHANGED");
  assert.deepEqual(plan.movement.blockedCavities, [3, 7, 11, 15]);
  assert.match(plan.movement.remarks, /12 of 16 cavities active/);
  assert.equal(new Movement(plan.movement).validateSync(), undefined);
  assert.equal(plan.log.type, "CAVITY_BLOCK");
  assert.deepEqual([plan.log.doneBy[0].name, plan.log.recordedBy.name, plan.log.statusBefore, plan.log.statusAfter], ["Tech", "Tech", "GOOD", "RUNNING_LIMITED"]);
  assert.equal(new WorkLog(plan.log).validateSync(), undefined);
  assert.deepEqual(plan.before.blockedCavities, []);
  assert.deepEqual([plan.after.limitedRun.since, plan.after.limitedRun.problemType], [now, "core pin"]);
  // Later change keeps the original start date.
  const changed = block(apply(mould(), plan), [3, 7], { now: new Date("2026-11-11T08:00:00Z") });
  assert.equal(changed.action, "mould.cavities.changed");
  assert.equal(changed.set.limitedRun.since, now);
});

test("full restore makes a running mould GOOD and clears the limited run", () => {
  const running = apply(mould(), block(mould(), [1, 2]));
  const restore = planCavities({ mould: running, user: tech, blocked: [], total: 16, reason: "" });
  assert.deepEqual([restore.action, restore.set.status, restore.set.limitedRun, restore.set.blockedCavities, restore.log.type], ["mould.cavities.restored", "GOOD", null, [], "CAVITY_RESTORE"]);
});

test("sending a limited-run mould to the Workshop makes it IN_REPAIR and keeps the blocked list until restored", () => {
  const running = apply(mould(), block(mould(), [5]));
  const toIsolation = planMove({ mould: running, user: { ...tech, role: "super_admin" }, to: "ISOLATION", intendedDestination: "WORKSHOP" });
  const waiting = apply(running, toIsolation);
  assert.equal(waiting.status, "RUNNING_LIMITED", "still limited while waiting");
  assert.equal(mouldStateError(waiting), null);
  const toShop = planMove({ mould: waiting, user: { ...tech, role: "super_admin" }, to: "WORKSHOP", remarks: "fix pins" });
  const shop = apply(waiting, toShop);
  assert.equal(shop.status, "IN_REPAIR");
  assert.deepEqual(shop.blockedCavities, [5], "a move never touches the blocked list");
  assert.equal(mouldStateError(shop), null);
  // Restored at the Workshop: blocked list cleared, status stays IN_REPAIR for the workshop flow.
  const restored = planCavities({ mould: shop, user: tech, blocked: [], total: 16, reason: "" });
  assert.deepEqual([restored.set.status, restored.set.blockedCavities], ["IN_REPAIR", []]);
});

test("a limited-run mould may keep running on a machine but cannot go into the Mould Room", () => {
  const running = apply(mould({ location: "ISOLATION", machineId: null, machine: null }), block(mould({ location: "ISOLATION", machineId: null, machine: null }), [1]));
  assert.equal(planMove({ mould: running, user: { ...tech, role: "super_admin" }, to: "MACHINE", machine: INJ3 }).set.status, "RUNNING_LIMITED");
  assert.throws(() => planMove({ mould: running, user: { ...tech, role: "super_admin" }, to: "MOULD_ROOM", rack: { _id: oid(), locationId: "X", active: true, zoneActive: true } }), code("NOT_GOOD"));
  assert.throws(() => planMove({ mould: mould(), user: { ...tech, role: "super_admin" }, to: "ISOLATION", status: "RUNNING_LIMITED", remarks: "x" }), code("USE_CAVITY_ACTION"));
});

test("badge level: amber while running limited, red after the limit or past the expected fix date", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const daysAgo = (d) => new Date(now - d * 86_400_000);
  assert.equal(limitedRunLevel(null, now), null);
  assert.equal(limitedRunLevel({ since: daysAgo(3) }, now), "amber");
  assert.equal(limitedRunLevel({ since: daysAgo(LIMITED_RUN_ALERT_DAYS + 1) }, now), "red");
  assert.equal(limitedRunLevel({ since: daysAgo(1), expectedFixBy: daysAgo(0.5) }, now), "red");
  const dto = mouldDTO({ ...mould(), status: "RUNNING_LIMITED", blockedCavities: [1, 2], limitedRun: { since: new Date(), reason: "x" } }, {}, { totalCavities: 16 });
  assert.deepEqual([dto.blockedCavities, dto.totalCavities, dto.limitedRun.level], [[1, 2], 16, "amber"]);
});

test("permission cavity.manage is needed (matrix default and per-user)", () => {
  assert.throws(() => planCavities({ mould: mould(), user: { _id: oid(), role: "executive" }, blocked: [1], total: 16, reason: "x" }), code("FORBIDDEN"));
  const denied = { _id: oid(), role: "mould_technician", name: "T", permissionOverrides: { grant: [], deny: ["cavity.manage"] } };
  assert.throws(() => planCavities({ mould: mould(), user: denied, blocked: [1], total: 16, reason: "x" }), code("FORBIDDEN"));
  const granted = { _id: oid(), role: "executive", name: "E", permissionOverrides: { grant: ["cavity.manage"], deny: [] } };
  assert.equal(planCavities({ mould: mould(), user: granted, blocked: [1], total: 16, reason: "x" }).set.status, "RUNNING_LIMITED");
});

test("cavity work log types are report-only, not typed into the work log form; model accepts them", () => {
  assert.equal(createWorkLogSchema.safeParse({ type: "CAVITY_BLOCK", description: "x" }).success, false);
  assert.ok(WorkLog.schema.path("type").enumValues.includes("CAVITY_RESTORE"));
  assert.equal(cavitiesSchema.safeParse({ blocked: [1, 2], reason: "x" }).success, true);
  assert.equal(new Mould({ ...mould(), status: "RUNNING_LIMITED", blockedCavities: [1] }).validateSync(), undefined);
});

test("cavity downtime: one period per blocked set, open until restored", () => {
  const u = oid();
  const t = (h) => new Date(Date.UTC(2026, 10, 10, h));
  const periods = buildDowntime([
    { type: "CAVITIES_CHANGED", createdAt: t(8), blockedCavities: [3, 7], remarks: "pins", performedBy: u },
    { type: "MOVED", createdAt: t(9) },
    { type: "CAVITIES_CHANGED", createdAt: t(10), blockedCavities: [3], remarks: "one fixed", performedBy: u },
    { type: "CAVITIES_CHANGED", createdAt: t(12), blockedCavities: [], remarks: "all restored", performedBy: u },
    { type: "CAVITIES_CHANGED", createdAt: t(14), blockedCavities: [9], remarks: "new crack", performedBy: u }
  ], new Map([[String(u), { name: "Tech" }]]));
  assert.deepEqual(periods.map((p) => [p.cavities, p.from.getUTCHours(), p.to ? p.to.getUTCHours() : null, p.by]), [[[9], 14, null, "Tech"], [[3], 10, 12, "Tech"], [[3, 7], 8, 10, "Tech"]]);
});
