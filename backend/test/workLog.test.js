import { test, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import sharp from "sharp";
import { canDoWork, lastWorkSummary, planWorkLog } from "../lib/workLog.js";
import { photosFromDataUrls } from "../lib/images.js";
import WorkLog from "../models/WorkLog.js";
import Mould from "../models/Mould.js";

const oid = () => new mongoose.Types.ObjectId();
const person = (role, extra = {}) => ({ _id: oid(), role, name: `${role} user`, active: true, deletedAt: null, ...extra });
const U = Object.fromEntries(["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"].map((r) => [r, person(r)]));
const INJ3 = { _id: oid(), code: "INJ-03" };
const RACK = { _id: oid(), zone: "FLK", code: "A3", locationId: "FLK-A3" };
const mould = (patch = {}) => ({
  _id: oid(), toolId: "FLK100", owner: "FLK", status: "GOOD", location: "MACHINE", machineId: INJ3._id, machine: INJ3,
  rackId: null, rack: null, capableMachines: ["INJ-03"], shotsToService: 1000, totalShots: 400, version: 3, ...patch
});
const inRoom = (patch = {}) => mould({ location: "MOULD_ROOM", machineId: null, machine: null, rackId: RACK._id, rack: RACK, ...patch });
const input = (patch = {}) => ({ type: "REPAIR", description: "Replaced ejector pin", ...patch });
const code = (c) => (e) => e.details?.code === c;
const NOW = new Date("2026-10-21T10:00:00Z");

describe("permissions", () => {
  test("Super Admin, Admin, Mould Technician and Mould Maker can log work; Production Supervisor cannot", () => {
    for (const role of ["super_admin", "admin", "mould_technician", "mould_maker"]) {
      assert.equal(planWorkLog({ mould: mould(), user: U[role], input: input(), now: NOW }).log.recordedBy.role, role);
    }
    assert.throws(() => planWorkLog({ mould: mould(), user: U.production_supervisor, input: input(), now: NOW }), code("FORBIDDEN"));
  });
  test("only active people allowed to do mould work can be named", () => {
    assert.equal(canDoWork(U.mould_maker), true);
    assert.equal(canDoWork(U.production_supervisor), false);
    assert.equal(canDoWork({ ...U.mould_technician, active: false }), false);
    assert.equal(canDoWork({ ...U.mould_technician, deletedAt: new Date() }), false);
    const ps = U.production_supervisor;
    assert.throws(() => planWorkLog({ mould: mould(), user: U.admin, input: input({ doneBy: [String(ps._id)] }), workers: [ps], now: NOW }), code("INVALID_WORKER"));
    assert.throws(() => planWorkLog({ mould: mould(), user: U.admin, input: input({ doneBy: [String(oid())] }), workers: [], now: NOW }), code("INVALID_WORKER"));
  });
});

describe("who did the work is always recorded", () => {
  test("defaults to the signed-in user; recordedBy is always the signed-in user", () => {
    const { log } = planWorkLog({ mould: mould(), user: U.mould_technician, input: input(), now: NOW });
    assert.deepEqual(log.doneBy, [{ userId: U.mould_technician._id, name: "mould_technician user", role: "mould_technician" }]);
    assert.equal(log.recordedBy.userId, U.mould_technician._id);
  });
  test("several people, stored with name and role snapshots", () => {
    const a = person("mould_maker", { name: "Nimal" }), b = person("mould_technician", { name: "Kasun" });
    const { log } = planWorkLog({ mould: mould(), user: U.admin, input: input({ doneBy: [String(a._id), String(b._id), String(a._id)] }), workers: [a, b], now: NOW });
    assert.deepEqual(log.doneBy.map((p) => [p.name, p.role]), [["Nimal", "mould_maker"], ["Kasun", "mould_technician"]]); // duplicates dropped
    assert.equal(log.recordedBy.role, "admin");
    assert.deepEqual(lastWorkSummary(log, "x").names, ["Nimal", "Kasun"]);
    const six = Array.from({ length: 6 }, () => person("mould_maker"));
    assert.throws(() => planWorkLog({ mould: mould(), user: U.admin, input: input({ doneBy: six.map((p) => String(p._id)) }), workers: six, now: NOW }), code("TOO_MANY_WORKERS"));
  });
  test("work time can be in the past, never in the future", () => {
    const past = new Date("2026-10-20T08:00:00Z");
    assert.equal(planWorkLog({ mould: mould(), user: U.admin, input: input({ doneAt: past }), now: NOW }).log.doneAt.getTime(), past.getTime());
    assert.throws(() => planWorkLog({ mould: mould(), user: U.admin, input: input({ doneAt: new Date("2026-10-21T11:00:00Z") }), now: NOW }), code("DONE_AT_FUTURE"));
  });
});

describe("location snapshot", () => {
  test("on a machine: the machine is recorded and the mould stays there", () => {
    const plan = planWorkLog({ mould: mould(), user: U.mould_technician, input: input(), now: NOW });
    assert.deepEqual([plan.log.location, plan.log.machineCode, plan.log.rackLocationId, plan.log.shots], ["MACHINE", "INJ-03", null, 400]);
    assert.equal(plan.move, null);
    assert.equal(plan.statusSet, null);
  });
  test("on a rack: the rack is recorded", () => {
    const plan = planWorkLog({ mould: inRoom(), user: U.mould_maker, input: input({ type: "CLEANING", shots: 410 }), now: NOW });
    assert.deepEqual([plan.log.location, plan.log.rackLocationId, plan.log.machineCode, plan.log.shots], ["MOULD_ROOM", "FLK-A3", null, 410]);
  });
});

describe("outcome and rule 2", () => {
  test("OK keeps a GOOD mould GOOD", () => {
    const plan = planWorkLog({ mould: mould(), user: U.mould_technician, input: input({ outcome: "OK" }), now: NOW });
    assert.deepEqual([plan.log.statusBefore, plan.log.statusAfter, plan.statusSet], ["GOOD", "GOOD", null]);
  });
  test("needs repair on a machine: flagged in place, not moved", () => {
    const plan = planWorkLog({ mould: mould(), user: U.mould_technician, input: input({ outcome: "NEEDS_REPAIR" }), now: NOW });
    assert.deepEqual(plan.statusSet, { status: "NEEDS_REPAIR" });
    assert.equal(plan.move, null);
    assert.equal(plan.movement.type, "STATUS_CHANGED");
    assert.equal(new Mould({ ...mould(), ...plan.statusSet }).validateSync(), undefined);
  });
  test("needs repair + send to Workshop: moved through the normal move rules", () => {
    const plan = planWorkLog({ mould: mould(), user: U.mould_technician, input: input({ outcome: "NEEDS_REPAIR", sendToWorkshop: true }), now: NOW });
    assert.deepEqual([plan.move.set.location, plan.move.set.status, plan.move.set.machineId], ["WORKSHOP", "NEEDS_REPAIR", null]);
    assert.equal(plan.log.sentToWorkshop, true);
    assert.equal(plan.statusSet, null);
    assert.equal(plan.movement, null); // the move's own movement records the status
  });
  test("in the Mould Room the entry is saved but the status waits for the move (rule 2)", () => {
    const plan = planWorkLog({ mould: inRoom(), user: U.mould_maker, input: input({ outcome: "NEEDS_SERVICE" }), now: NOW });
    assert.deepEqual([plan.statusSet, plan.log.statusAfter, plan.warnings], [null, "GOOD", ["WORKSHOP_MOVE_REQUIRED"]]);
    const moved = planWorkLog({ mould: inRoom(), user: U.mould_maker, input: input({ outcome: "NEEDS_SERVICE", sendToWorkshop: true }), now: NOW });
    assert.equal(moved.move.set.location, "WORKSHOP");
  });
  test("a technician cannot take a mould out of the Mould Room: entry saved, move left to others", () => {
    const plan = planWorkLog({ mould: inRoom(), user: U.mould_technician, input: input({ outcome: "NEEDS_REPAIR", sendToWorkshop: true }), now: NOW });
    assert.equal(plan.move, null);
    assert.deepEqual(plan.warnings, ["WORKSHOP_MOVE_NOT_ALLOWED", "WORKSHOP_MOVE_REQUIRED"]);
  });
  test("a service with outcome OK resets the shot count and clears a service flag", () => {
    const plan = planWorkLog({ mould: mould({ status: "NEEDS_SERVICE", totalShots: 1200 }), user: U.mould_technician, input: input({ type: "SERVICE", outcome: "OK" }), now: NOW });
    assert.deepEqual(plan.statusSet, { status: "GOOD", totalShots: 0, lastServicedAt: NOW });
  });
  test("a repair cannot clear a mould that is past its shot limit", () => {
    const plan = planWorkLog({ mould: mould({ status: "NEEDS_SERVICE", totalShots: 1200 }), user: U.mould_technician, input: input({ outcome: "OK" }), now: NOW });
    assert.deepEqual([plan.statusSet, plan.warnings], [null, ["SERVICE_STILL_DUE"]]);
  });
});

describe("immutability and corrections", () => {
  test("work log entries cannot be changed or deleted", async () => {
    await assert.rejects(WorkLog.updateOne({}, { $set: { description: "x" } }).exec(), /immutable/);
    await assert.rejects(WorkLog.deleteOne({}).exec(), /immutable/);
    const doc = WorkLog.hydrate({ _id: oid(), mouldId: oid(), toolId: "T", type: "REPAIR", description: "x" });
    doc.description = "changed";
    await assert.rejects(doc.save({ validateBeforeSave: false }), /immutable/); // the save guard itself, not validation
  });
  test("a correction points at an entry of the same mould", () => {
    const m = mould();
    const ok = planWorkLog({ mould: m, user: U.admin, input: input({ correctsId: "abc" }), corrected: { _id: "abc", mouldId: m._id }, now: NOW });
    assert.equal(ok.log.correctsId, "abc");
    assert.throws(() => planWorkLog({ mould: m, user: U.admin, input: input({ correctsId: "abc" }), corrected: { _id: "abc", mouldId: oid() }, now: NOW }), code("INVALID_CORRECTION"));
    assert.throws(() => planWorkLog({ mould: m, user: U.admin, input: input({ correctsId: "abc" }), corrected: null, now: NOW }), code("INVALID_CORRECTION"));
  });
  test("the planned entry is a valid WorkLog document", () => {
    const { log } = planWorkLog({ mould: mould(), user: U.mould_maker, input: input({ outcome: "OK", partsUsed: "2x pin", timeSpentMinutes: 45 }), now: NOW });
    assert.equal(new WorkLog(log).validateSync(), undefined);
    assert.ok(new WorkLog({ ...log, doneBy: [] }).validateSync());
    assert.ok(new WorkLog({ ...log, description: "" }).validateSync());
  });
  test("a deleted mould takes no work entries; description is required", () => {
    assert.throws(() => planWorkLog({ mould: mould({ deletedAt: new Date() }), user: U.admin, input: input(), now: NOW }), code("MOULD_DELETED"));
    assert.throws(() => planWorkLog({ mould: mould(), user: U.admin, input: input({ description: "  " }), now: NOW }), code("DESCRIPTION_REQUIRED"));
  });
});

test("photos: real images only, stored resized as WebP", async () => {
  const jpeg = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#888" } }).jpeg().toBuffer();
  const [p] = await photosFromDataUrls([`data:image/jpeg;base64,${jpeg.toString("base64")}`]);
  assert.match(p.path, /^worklogs\/[0-9a-f]{20}\.webp$/);
  assert.deepEqual([p.width, p.height], [800, 400]);
  await assert.rejects(photosFromDataUrls(["data:text/html;base64,PGgxPg=="]), /JPEG, PNG or WebP/);
  await assert.rejects(photosFromDataUrls([`data:image/png;base64,${Buffer.from("not an image").toString("base64")}`]), /could not be read/);
});
