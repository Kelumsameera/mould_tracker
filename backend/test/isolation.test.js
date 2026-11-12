// Step 4: Isolation Area between Production Floor, Mould Room and Workshop.
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { planMove, canMove, isolationRouteError } from "../lib/workflow.js";
import { mouldStateError } from "../lib/mouldState.js";
import { ISOLATION_MAX_WAIT_HOURS, isolationLevel } from "../lib/flowConfig.js";
import { moveMouldSchema } from "../validators/schemas.js";
import { mouldDTO } from "../utils/serializers.js";
import Mould from "../models/Mould.js";
import Movement from "../models/Movement.js";

const oid = () => new mongoose.Types.ObjectId();
const SA = { _id: oid(), role: "super_admin" };
const INJ3 = { _id: oid(), code: "INJ-03", active: true };
const rack = { _id: oid(), zone: "FLK", code: "A3", locationId: "FLK-A3", active: true, capacity: null, zoneActive: true };
const base = (patch = {}) => ({ _id: oid(), toolId: "FLK100", owner: "FLK", status: "GOOD", toolType: "INJECTION_MOULD", machineId: null, rackId: null, capableMachines: ["INJ-03"], shotsToService: 1000, totalShots: 0, ...patch });
const at = {
  MACHINE: () => base({ location: "MACHINE", machineId: INJ3._id, machine: { ...INJ3 } }),
  PRODUCTION_FLOOR: () => base({ location: "PRODUCTION_FLOOR" }),
  MOULD_ROOM: () => base({ location: "MOULD_ROOM", rackId: rack._id, rack }),
  WORKSHOP: () => base({ location: "WORKSHOP" })
};
const code = (c) => (e) => e.details?.code === c;
const extra = (to) => ({ MACHINE: { machine: INJ3 }, MOULD_ROOM: { rack: { ...rack, _id: oid(), locationId: "FLK-B1" } }, WORKSHOP: { remarks: "check" } }[to] ?? {});
// Apply a plan to a mould like the controller does.
const apply = (m, plan) => ({ ...m, ...plan.set, machine: plan.set.machineId ? INJ3 : null });

test("every direct non-machine move is refused with 'Send to Isolation Area first'", () => {
  const pairs = [["MACHINE", "PRODUCTION_FLOOR"], ["MACHINE", "MOULD_ROOM"], ["MACHINE", "WORKSHOP"], ["PRODUCTION_FLOOR", "MOULD_ROOM"], ["PRODUCTION_FLOOR", "WORKSHOP"],
    ["MOULD_ROOM", "PRODUCTION_FLOOR"], ["MOULD_ROOM", "WORKSHOP"], ["WORKSHOP", "MOULD_ROOM"], ["WORKSHOP", "PRODUCTION_FLOOR"], ["WORKSHOP", "MACHINE"]];
  for (const [from, to] of pairs) {
    assert.throws(() => planMove({ mould: at[from](), user: SA, to, ...extra(to) }), (e) => e.details?.code === "ISOLATION_FIRST" && e.message === "Send to Isolation Area first", `${from} -> ${to}`);
  }
});

test("two-hop flows through Isolation reach every destination", () => {
  for (const [from, to] of [["MACHINE", "MOULD_ROOM"], ["PRODUCTION_FLOOR", "WORKSHOP"], ["MOULD_ROOM", "WORKSHOP"], ["WORKSHOP", "MOULD_ROOM"], ["WORKSHOP", "PRODUCTION_FLOOR"], ["MOULD_ROOM", "PRODUCTION_FLOOR"]]) {
    const start = at[from]();
    const hop1 = planMove({ mould: start, user: SA, to: "ISOLATION", intendedDestination: to });
    const waiting = apply(start, hop1);
    assert.equal(mouldStateError(waiting), null, `${from} in isolation`);
    assert.equal(waiting.isolation.intendedDestination, to);
    const hop2 = planMove({ mould: waiting, user: SA, to, ...extra(to) });
    const done = apply(waiting, hop2);
    assert.deepEqual([done.location, done.isolation], [to, null], `${from} -> ISOLATION -> ${to}`);
  }
});

test("mounting on a machine is direct from the Production Floor, Isolation or the Mould Room", () => {
  for (const m of [at.PRODUCTION_FLOOR(), base({ location: "ISOLATION" }), at.MOULD_ROOM()]) {
    assert.equal(planMove({ mould: m, user: SA, to: "MACHINE", machine: INJ3 }).set.location, "MACHINE", m.location);
  }
});

test("dwell time is recorded on the move that leaves Isolation", () => {
  const since = new Date("2026-11-10T08:00:00Z");
  const now = new Date("2026-11-10T11:30:00Z");
  const waiting = base({ location: "ISOLATION", isolation: { since, intendedDestination: "MOULD_ROOM" } });
  const { movement } = planMove({ mould: waiting, user: SA, to: "MOULD_ROOM", rack, now });
  assert.equal(movement.dwellMinutes, 210);
  assert.equal(movement.fromLocation, "ISOLATION");
  assert.equal(new Movement(movement).validateSync(), undefined);
  const into = planMove({ mould: at.MACHINE(), user: SA, to: "ISOLATION", intendedDestination: "WORKSHOP", remarks: "flash", now });
  assert.deepEqual([into.movement.intendedDestination, into.set.isolation.since, into.set.isolation.fromLocation], ["WORKSHOP", now, "MACHINE"]);
});

test("any status may wait in Isolation; service/repair still only goes on to the Workshop", () => {
  for (const status of ["NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR"]) {
    const m = base({ location: "ISOLATION", status });
    assert.equal(mouldStateError(m), null, status);
    assert.throws(() => planMove({ mould: m, user: SA, to: "MOULD_ROOM", rack }), code("NOT_GOOD"), status);
    assert.throws(() => planMove({ mould: m, user: SA, to: "PRODUCTION_FLOOR" }), code("NOT_GOOD"), status);
    assert.throws(() => planMove({ mould: m, user: SA, to: "MACHINE", machine: INJ3 }), code("NOT_GOOD"), status);
    assert.equal(planMove({ mould: m, user: SA, to: "WORKSHOP", remarks: "repair" }).set.location, "WORKSHOP");
  }
  // A status can be set when sending to Isolation (remarks needed), e.g. a machine mould that needs repair.
  assert.throws(() => planMove({ mould: at.MACHINE(), user: SA, to: "ISOLATION", status: "NEEDS_REPAIR" }), code("REMARKS_REQUIRED"));
  assert.equal(planMove({ mould: at.MACHINE(), user: SA, to: "ISOLATION", status: "NEEDS_REPAIR", remarks: "crack" }).set.status, "NEEDS_REPAIR");
});

test("the Mould Room still needs a rack after Isolation; a second Isolation move is refused", () => {
  const waiting = base({ location: "ISOLATION" });
  assert.throws(() => planMove({ mould: waiting, user: SA, to: "MOULD_ROOM" }), code("RACK_REQUIRED"));
  assert.throws(() => planMove({ mould: waiting, user: SA, to: "ISOLATION" }), code("NO_CHANGE"));
});

test("planned destination only when sending to Isolation", () => {
  assert.throws(() => planMove({ mould: base({ location: "ISOLATION" }), user: SA, to: "WORKSHOP", remarks: "x", intendedDestination: "MOULD_ROOM" }), code("INVALID_DESTINATION"));
  assert.equal(moveMouldSchema.safeParse({ to: "ISOLATION", intendedDestination: "ISOLATION" }).success, false);
  assert.equal(moveMouldSchema.safeParse({ to: "ISOLATION", intendedDestination: "MOULD_ROOM", remarks: "" }).success, true);
});

test("move.isolation is needed to send to Isolation; leaving needs the destination's permission", () => {
  const supervisor = { role: "production_supervisor" };
  assert.equal(canMove(supervisor, "MACHINE", "ISOLATION"), true);
  assert.equal(canMove({ role: "production_supervisor", permissionOverrides: { grant: [], deny: ["move.isolation"] } }, "MACHINE", "ISOLATION"), false);
  assert.equal(canMove({ role: "executive" }, "MACHINE", "ISOLATION"), false);
  assert.equal(canMove(supervisor, "ISOLATION", "PRODUCTION_FLOOR"), true);
  assert.equal(canMove(supervisor, "ISOLATION", "MOULD_ROOM"), false, "Mould Room needs move.mouldroom");
  assert.equal(canMove({ role: "mould_maker" }, "ISOLATION", "MOULD_ROOM"), true);
});

test("route rule is pure and exempts Out of Service, new moulds and same-place moves", () => {
  assert.equal(isolationRouteError(null, "WORKSHOP"), null);
  assert.equal(isolationRouteError("WORKSHOP", "OUT_OF_SERVICE"), null);
  assert.equal(isolationRouteError("OUT_OF_SERVICE", "WORKSHOP"), null);
  assert.equal(isolationRouteError("MOULD_ROOM", "MOULD_ROOM"), null);
  assert.equal(isolationRouteError("MACHINE", "MACHINE"), null);
});

test("waiting too long: amber after the limit, red after twice the limit; shown on the card", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const hoursAgo = (h) => new Date(now - h * 3_600_000);
  assert.equal(isolationLevel(hoursAgo(1), now), null);
  assert.equal(isolationLevel(hoursAgo(ISOLATION_MAX_WAIT_HOURS + 1), now), "amber");
  assert.equal(isolationLevel(hoursAgo(ISOLATION_MAX_WAIT_HOURS * 2 + 1), now), "red");
  const dto = mouldDTO(base({ location: "ISOLATION", isolation: { since: new Date(), intendedDestination: "MOULD_ROOM" } }));
  assert.deepEqual([dto.isolation.intendedDestination, dto.isolation.level], ["MOULD_ROOM", null]);
  assert.equal(mouldDTO(at.MACHINE()).isolation, null);
});

test("the model accepts a mould in Isolation and rejects an isolation stay elsewhere", () => {
  assert.equal(new Mould(base({ location: "ISOLATION", status: "NEEDS_REPAIR", isolation: { since: new Date() } })).validateSync(), undefined);
  assert.ok(new Mould(base({ location: "PRODUCTION_FLOOR", isolation: { since: new Date() } })).validateSync());
});
