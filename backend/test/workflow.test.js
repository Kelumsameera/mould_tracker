import { test, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { canMove, planInitialLocation, planMove, planShots, planStatus, serviceDueChange } from "../lib/workflow.js";
import { planBulkRacks, occupiedRacks } from "../lib/racks.js";
import Mould from "../models/Mould.js";

const oid = () => new mongoose.Types.ObjectId();
// One test user per role.
const U = Object.fromEntries(["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"].map((role) => [role, { _id: oid(), role, name: role }]));
const { super_admin: SA, admin: A, production_supervisor: PS, mould_technician: MT, mould_maker: MM } = U;

const INJ3 = { _id: oid(), code: "INJ-03", active: true };
const INJ9 = { _id: oid(), code: "INJ-09", active: true };
const rack = (patch = {}) => ({ _id: oid(), zone: "FLK", code: "A3", locationId: "FLK-A3", active: true, capacity: null, zoneActive: true, ...patch });
const mould = (patch = {}) => ({
  _id: oid(), toolId: "FLK100", owner: "FLK", status: "GOOD", location: "PRODUCTION_FLOOR", machineId: null, rackId: null,
  capableMachines: ["INJ-03"], shotsToService: 1000, totalShots: 0, ...patch
});
const onMachine = (patch = {}) => mould({ location: "MACHINE", machineId: INJ3._id, machine: INJ3, ...patch });
const code = (c) => (e) => e.details?.code === c;

describe("rule 1: a GOOD mould may be on a machine, the production floor or a Mould Room rack", () => {
  test("all three are allowed and leave a consistent mould", () => {
    for (const [to, extra] of [["MACHINE", { machine: INJ3 }], ["PRODUCTION_FLOOR", {}], ["MOULD_ROOM", { rack: rack() }]]) {
      const start = to === "PRODUCTION_FLOOR" ? onMachine() : mould();
      const { set } = planMove({ mould: start, user: SA, to, ...extra });
      assert.equal(set.location, to);
      assert.equal(new Mould({ ...start, ...set }).validateSync(), undefined, to);
    }
  });
});

describe("rule 2: service or repair means Workshop; never into the Mould Room", () => {
  for (const status of ["NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR"]) {
    test(`${status} mould`, () => {
      const m = status.startsWith("IN_") ? mould({ status, location: "WORKSHOP" }) : onMachine({ status });
      assert.throws(() => planMove({ mould: m, user: SA, to: "MOULD_ROOM", rack: rack() }), code("NOT_GOOD"));
      assert.throws(() => planMove({ mould: m, user: SA, to: "PRODUCTION_FLOOR" }), code("NOT_GOOD"));
      assert.throws(() => planMove({ mould: m, user: SA, to: "MACHINE", machine: INJ9 }), code("NOT_GOOD"));
      if (m.location !== "WORKSHOP") assert.equal(planMove({ mould: m, user: SA, to: "WORKSHOP", remarks: "worn" }).set.location, "WORKSHOP");
    });
  }
  test("status can only change at the Workshop, and the model refuses a flagged mould in the Mould Room", () => {
    assert.throws(() => planStatus({ mould: mould(), user: SA, status: "NEEDS_REPAIR", remarks: "x" }), code("NOT_AT_WORKSHOP"));
    assert.throws(() => planMove({ mould: onMachine(), user: SA, to: "MACHINE", machine: INJ9, status: "NEEDS_REPAIR" }), code("STATUS_ONLY_AT_WORKSHOP"));
    assert.ok(new Mould(mould({ status: "NEEDS_REPAIR", location: "MOULD_ROOM", rackId: oid() })).validateSync());
  });
});

describe("rule 3: from a machine to the floor / Mould Room if GOOD, to the Workshop if it needs work", () => {
  test("machine -> production floor, Mould Room, Workshop with a status", () => {
    assert.equal(planMove({ mould: onMachine(), user: PS, to: "PRODUCTION_FLOOR" }).set.machineId, null);
    const toRoom = planMove({ mould: onMachine(), user: MM, to: "MOULD_ROOM", rack: rack() });
    assert.equal(toRoom.movement.fromMachineCode, "INJ-03");
    assert.equal(toRoom.movement.toRackLocationId, "FLK-A3");
    const toShop = planMove({ mould: onMachine(), user: MT, to: "WORKSHOP", status: "NEEDS_REPAIR", remarks: "cracked insert" });
    assert.deepEqual([toShop.set.location, toShop.set.status, toShop.movement.toStatus], ["WORKSHOP", "NEEDS_REPAIR", "NEEDS_REPAIR"]);
  });
});

describe("rule 4: after service/repair, GOOD at the Workshop, then out again", () => {
  test("IN_SERVICE -> GOOD resets the shot count; IN_REPAIR -> GOOD keeps it", () => {
    const now = new Date(1000);
    const serviced = planStatus({ mould: mould({ location: "WORKSHOP", status: "IN_SERVICE", totalShots: 1500 }), user: MM, status: "GOOD", remarks: "serviced", now });
    assert.deepEqual(serviced.set, { status: "GOOD", totalShots: 0, lastServicedAt: now });
    const repaired = planStatus({ mould: mould({ location: "WORKSHOP", status: "IN_REPAIR", totalShots: 10 }), user: MT, status: "GOOD", remarks: "fixed" });
    assert.deepEqual(repaired.set, { status: "GOOD" });
  });
  test("a GOOD mould at the Workshop can go to a rack, the floor or a machine", () => {
    const m = mould({ location: "WORKSHOP" });
    assert.equal(planMove({ mould: m, user: MM, to: "MOULD_ROOM", rack: rack() }).set.location, "MOULD_ROOM");
    assert.equal(planMove({ mould: m, user: MT, to: "PRODUCTION_FLOOR" }).set.location, "PRODUCTION_FLOOR");
    assert.equal(planMove({ mould: m, user: MT, to: "MACHINE", machine: INJ3 }).set.location, "MACHINE");
  });
  test("the full workshop path: needs -> in -> good", () => {
    let m = mould({ location: "WORKSHOP", status: "NEEDS_SERVICE", totalShots: 1200 });
    m = { ...m, ...planStatus({ mould: m, user: MT, status: "IN_SERVICE", remarks: "started" }).set };
    m = { ...m, ...planStatus({ mould: m, user: MT, status: "GOOD", remarks: "done" }).set };
    assert.deepEqual([m.status, m.totalShots], ["GOOD", 0]);
  });
});

describe("rule 5: only capable machines, unless an Admin or Super Admin overrides with a reason", () => {
  test("not capable", () => {
    for (const user of [PS, MT]) assert.throws(() => planMove({ mould: mould(), user, to: "MACHINE", machine: INJ9 }), code("NOT_CAPABLE"));
    for (const user of [A, SA]) {
      assert.throws(() => planMove({ mould: mould(), user, to: "MACHINE", machine: INJ9 }), code("OVERRIDE_REASON_REQUIRED"));
      const ok = planMove({ mould: mould(), user, to: "MACHINE", machine: INJ9, overrideReason: "INJ-03 down, trial on INJ-09" });
      assert.equal(ok.movement.overrideReason, "INJ-03 down, trial on INJ-09");
      assert.deepEqual(ok.warnings, ["CAPABILITY_OVERRIDDEN"]);
    }
  });
  test("a mould with no capable machines listed also needs the override", () => {
    assert.throws(() => planMove({ mould: mould({ capableMachines: [] }), user: MT, to: "MACHINE", machine: INJ3 }), code("NOT_CAPABLE"));
  });
  test("inactive machine and missing machine are refused", () => {
    assert.throws(() => planMove({ mould: mould(), user: SA, to: "MACHINE", machine: { ...INJ3, active: false } }), code("MACHINE_INACTIVE"));
    assert.throws(() => planMove({ mould: mould(), user: SA, to: "MACHINE" }), code("MACHINE_REQUIRED"));
  });
});

describe("rule 6: one mould per machine", () => {
  test("an occupied machine is refused with the occupant named", () => {
    assert.throws(() => planMove({ mould: mould(), user: MT, to: "MACHINE", machine: INJ3, occupant: { _id: oid(), toolId: "FLK200" } }),
      (e) => e.details?.code === "MACHINE_OCCUPIED" && e.details.occupant === "FLK200");
  });
  test("the database enforces it too (unique index on machineId for mounted moulds)", () => {
    const idx = Mould.schema.indexes().find(([keys]) => keys.machineId === 1);
    assert.equal(idx[1].unique, true);
    assert.deepEqual(idx[1].partialFilterExpression, { location: "MACHINE" });
  });
});

describe("rule 7: every change is recorded; remarks are mandatory for service and repair", () => {
  test("Workshop moves and status changes need remarks", () => {
    assert.throws(() => planMove({ mould: onMachine(), user: MT, to: "WORKSHOP" }), code("REMARKS_REQUIRED"));
    assert.throws(() => planMove({ mould: onMachine(), user: MT, to: "WORKSHOP", remarks: "   " }), code("REMARKS_REQUIRED"));
    assert.throws(() => planStatus({ mould: mould({ location: "WORKSHOP" }), user: MT, status: "NEEDS_REPAIR" }), code("REMARKS_REQUIRED"));
  });
  test("each plan carries a complete Movement record", () => {
    const m = onMachine();
    const { movement } = planMove({ mould: m, user: MT, to: "WORKSHOP", status: "NEEDS_REPAIR", remarks: "flash" });
    assert.deepEqual(
      { ...movement, mouldId: String(movement.mouldId), performedBy: String(movement.performedBy), fromMachineId: String(movement.fromMachineId) },
      { mouldId: String(m._id), toolId: "FLK100", type: "MOVED", fromLocation: "MACHINE", toLocation: "WORKSHOP", fromStatus: "GOOD", toStatus: "NEEDS_REPAIR",
        fromMachineId: String(INJ3._id), fromMachineCode: "INJ-03", fromRackId: null, fromRackLocationId: null, remarks: "flash", overrideReason: "", performedBy: String(MT._id) }
    );
    assert.equal(planStatus({ mould: mould({ location: "WORKSHOP" }), user: MT, status: "IN_REPAIR", remarks: "x" }).movement.type, "STATUS_CHANGED");
  });
  test("moving to the same place is refused instead of writing an empty record", () => {
    assert.throws(() => planMove({ mould: onMachine(), user: SA, to: "MACHINE", machine: INJ3 }), code("NO_CHANGE"));
    const r = rack();
    assert.throws(() => planMove({ mould: mould({ location: "MOULD_ROOM", rackId: r._id, rack: r }), user: SA, to: "MOULD_ROOM", rack: r }), code("NO_CHANGE"));
    assert.throws(() => planStatus({ mould: mould({ location: "WORKSHOP" }), user: SA, status: "GOOD", remarks: "x" }), code("NO_CHANGE"));
  });
});

describe("rule 8: totalShots >= shotsToService -> NEEDS_SERVICE", () => {
  test("recording shots past the limit flags the mould and records why", () => {
    const below = planShots({ mould: onMachine({ totalShots: 900 }), user: PS, shots: 99 });
    assert.deepEqual([below.set.totalShots, below.statusSet], [999, null]);
    const at = planShots({ mould: onMachine({ totalShots: 900 }), user: PS, shots: 100 });
    assert.deepEqual(at.statusSet, { status: "NEEDS_SERVICE" });
    assert.equal(at.movement.toStatus, "NEEDS_SERVICE");
    assert.match(at.movement.remarks, /1000\/1000/);
  });
  test("shots only on a machine, positive whole numbers", () => {
    assert.throws(() => planShots({ mould: mould(), user: PS, shots: 5 }), code("NOT_ON_MACHINE"));
    assert.throws(() => planShots({ mould: onMachine(), user: PS, shots: 0 }), code("INVALID_SHOTS"));
    assert.throws(() => planShots({ mould: onMachine(), user: MM, shots: 1.5 }), code("INVALID_SHOTS"));
  });
  test("a due mould cannot be mounted, nor marked GOOD without a service", () => {
    assert.throws(() => planMove({ mould: mould({ totalShots: 1000 }), user: SA, to: "MACHINE", machine: INJ3 }), code("SERVICE_DUE"));
    assert.throws(() => planStatus({ mould: mould({ location: "WORKSHOP", status: "NEEDS_SERVICE", totalShots: 1000 }), user: MT, status: "GOOD", remarks: "x" }), code("SERVICE_DUE"));
  });
  test("a lowered limit flags moulds outside the Mould Room; in the Mould Room it waits for mounting", () => {
    assert.equal(serviceDueChange(onMachine({ totalShots: 600, shotsToService: 500 }), SA, "Shot limit changed").statusSet.status, "NEEDS_SERVICE");
    assert.equal(serviceDueChange(mould({ location: "MOULD_ROOM", rackId: oid(), totalShots: 600, shotsToService: 500 }), SA, "x").statusSet, null);
    assert.equal(serviceDueChange(onMachine({ totalShots: 600, shotsToService: null }), SA, "x").statusSet, null);
  });
});

describe("Mould Room racks", () => {
  test("a rack is required, must be in use, not full; zone must be active", () => {
    assert.throws(() => planMove({ mould: mould(), user: MM, to: "MOULD_ROOM" }), code("RACK_REQUIRED"));
    assert.throws(() => planMove({ mould: mould(), user: MM, to: "MOULD_ROOM", rack: rack({ active: false }) }), code("RACK_INACTIVE"));
    assert.throws(() => planMove({ mould: mould(), user: MM, to: "MOULD_ROOM", rack: rack({ zoneActive: false }) }), code("RACK_INACTIVE"));
    assert.throws(() => planMove({ mould: mould(), user: MM, to: "MOULD_ROOM", rack: rack({ capacity: 2 }), rackOccupancy: 2 }), code("RACK_FULL"));
    assert.equal(planMove({ mould: mould(), user: MM, to: "MOULD_ROOM", rack: rack({ capacity: 2 }), rackOccupancy: 1 }).set.location, "MOULD_ROOM");
  });
  test("owner and zone differ: warn, allow with a reason", () => {
    const cci = rack({ zone: "CCI", locationId: "CCI-A3" });
    assert.throws(() => planMove({ mould: mould(), user: MM, to: "MOULD_ROOM", rack: cci }), (e) => e.details?.code === "OWNER_MISMATCH" && e.details.zone === "CCI");
    const ok = planMove({ mould: mould(), user: MM, to: "MOULD_ROOM", rack: cci, overrideReason: "FLK side full" });
    assert.deepEqual([ok.warnings, ok.movement.overrideReason], [["OWNER_ZONE_OVERRIDDEN"], "FLK side full"]);
    assert.equal(planMove({ mould: mould({ owner: null }), user: MM, to: "MOULD_ROOM", rack: cci }).warnings.length, 0);
  });
  test("racking a migrated mould clears its waiting-for-rack flag", () => {
    const { set } = planMove({ mould: mould({ location: "MOULD_ROOM", awaitingRack: true }), user: MM, to: "MOULD_ROOM", rack: rack() });
    assert.equal(set.awaitingRack, false);
  });
  test("bulk generate preview splits new, revived and existing racks", () => {
    const existing = [{ _id: oid(), locationId: "FLK-A1" }, { _id: oid(), locationId: "FLK-A2", deletedAt: new Date() }];
    const plan = planBulkRacks(existing, { zone: "FLK", rowFrom: "A", rowTo: "A", from: 1, to: 3 });
    assert.deepEqual([plan.existing.map((r) => r.locationId), plan.revive.map((r) => r.locationId), plan.create.map((r) => r.locationId)], [["FLK-A1"], ["FLK-A2"], ["FLK-A3"]]);
    const racks = [{ _id: oid(), locationId: "FLK-B1" }, { _id: oid(), locationId: "FLK-B2" }];
    assert.deepEqual(occupiedRacks(racks, new Map([[String(racks[1]._id), 1]])), ["FLK-B2"]);
  });
  test("new moulds start in the Mould Room (rack), on the floor or at the Workshop, never on a machine", () => {
    assert.equal(planInitialLocation({ user: A, location: "MOULD_ROOM", rack: rack() }).set.rackId !== null, true);
    assert.throws(() => planInitialLocation({ user: A, location: "MOULD_ROOM" }), code("RACK_REQUIRED"));
    assert.throws(() => planInitialLocation({ user: A, location: "MACHINE" }), code("INVALID_LOCATION"));
  });
});

describe("who may move what (one user per role)", () => {
  // [from, to] -> roles allowed, in the order SA, A, PS, MT, MM
  const MATRIX = {
    "MACHINE>PRODUCTION_FLOOR": [1, 1, 1, 1, 0],
    "PRODUCTION_FLOOR>MACHINE": [1, 1, 1, 1, 0],
    "MACHINE>MACHINE": [1, 1, 1, 1, 0],
    "MACHINE>WORKSHOP": [1, 1, 0, 1, 1],
    "MACHINE>MOULD_ROOM": [1, 1, 0, 0, 1],
    "MOULD_ROOM>PRODUCTION_FLOOR": [1, 1, 0, 0, 1],
    "MOULD_ROOM>MACHINE": [1, 1, 0, 0, 0],
    "MOULD_ROOM>WORKSHOP": [1, 1, 0, 0, 1],
    "MOULD_ROOM>MOULD_ROOM": [1, 1, 0, 0, 1],
    "WORKSHOP>MOULD_ROOM": [1, 1, 0, 0, 1],
    "WORKSHOP>PRODUCTION_FLOOR": [1, 1, 1, 1, 1],
    "WORKSHOP>MACHINE": [1, 1, 1, 1, 0]
  };
  const users = [SA, A, PS, MT, MM];
  for (const [key, row] of Object.entries(MATRIX)) {
    test(key.replace(">", " -> "), () => {
      const [from, to] = key.split(">");
      users.forEach((u, i) => assert.equal(canMove(u, from, to), Boolean(row[i]), `${u.role}`));
    });
  }
  test("a forbidden move is refused before any other check", () => {
    assert.throws(() => planMove({ mould: onMachine(), user: PS, to: "WORKSHOP", remarks: "x" }), code("FORBIDDEN_MOVE"));
    assert.throws(() => planStatus({ mould: mould({ location: "WORKSHOP" }), user: PS, status: "IN_REPAIR", remarks: "x" }), code("FORBIDDEN"));
    assert.equal(planStatus({ mould: mould({ location: "WORKSHOP" }), user: MM, status: "IN_REPAIR", remarks: "x" }).set.status, "IN_REPAIR");
  });
});
