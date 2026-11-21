import { test } from "node:test";
import assert from "node:assert/strict";
import { builtInConfig } from "../lib/configStore.js";
import { planMove } from "../lib/workflow.js";
import { mouldStateError } from "../lib/mouldState.js";
import { evaluateMove } from "../lib/evaluateMove.js";

const user = { _id: "user", role: "executive", permissions: [] };
const mould = { _id: "mould", toolId: "M1", location: "WORKSHOP", status: "NEEDS_REPAIR", toolType: "EXTRUSION_DIE", capableMachines: [], owner: "OTHER", totalShots: 100, shotsToService: 10 };
const machine = { _id: "machine", code: "INJ-01", active: true };
const rack = { _id: "rack", zone: "FLK", locationId: "FLK-A1", active: true, capacity: 1 };

test("every active source/destination allows direct moves for a user with no move permissions", () => {
  const config = builtInConfig();
  for (const from of config.locations) for (const to of config.locations) {
    if (from.key === to.key) continue;
    const plan = planMove({ mould: { ...mould, location: from.key }, user, to: to.key, machine, rack,
      outOfServiceDetails: to.external ? { recipientName: "Repairer", address: "Address", repairDetails: "Repair" } : undefined });
    assert.equal(plan.set.location, to.key);
    assert.equal(plan.set.status, mould.status);
    assert.equal(plan.movement.performedBy, user._id);
    assert.equal(mouldStateError({ ...mould, ...plan.set }), null);
  }
});

test("custom active destinations work even when a published transition disallows them", () => {
  const config = builtInConfig();
  config.locations.push({ key: "CUSTOM", kind: "simple", active: true });
  config.transitions.push({ from: mould.location, to: "CUSTOM", allowed: false });
  assert.equal(evaluateMove(config, mould, { user, to: "CUSTOM" }).ok, true);
  config.locations.at(-1).active = false;
  assert.equal(evaluateMove(config, mould, { user, to: "CUSTOM" }).ok, false);
});

test("authentication, physical occupancy, required placement and deleted mould checks remain", () => {
  const code = expected => error => error.details?.code === expected;
  assert.throws(() => planMove({ mould, user: null, to: "PRODUCTION_FLOOR" }), code("FORBIDDEN_MOVE"));
  assert.throws(() => planMove({ mould, user, to: "MACHINE" }), code("MACHINE_REQUIRED"));
  assert.throws(() => planMove({ mould, user, to: "MACHINE", machine, occupant: { _id: "other", toolId: "M2" } }), code("MACHINE_OCCUPIED"));
  assert.throws(() => planMove({ mould, user, to: "MOULD_ROOM", rack, rackOccupancy: 1 }), code("RACK_FULL"));
  assert.throws(() => planMove({ mould: { ...mould, deletedAt: new Date() }, user, to: "PRODUCTION_FLOOR" }), code("MOULD_DELETED"));
});
