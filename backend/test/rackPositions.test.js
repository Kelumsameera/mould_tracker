import { test, mock, afterEach } from "node:test";
import mongoose from "mongoose";
import Mould from "../models/Mould.js";
import Zone from "../models/Zone.js";
import { restoreMould } from "../controllers/mouldController.js";
import Item from "../models/Item.js";
import { listRacks } from "../controllers/rackController.js";
import assert from "node:assert/strict";
import Rack from "../models/Rack.js";
import { buildRacks, DEFAULT_LAYOUT } from "../lib/racks.js";
import { planRackPositions } from "../lib/rackMigration.js";
import { createRackSchema, updateRackSchema, bulkRacksSchema } from "../validators/schemas.js";
import { planMove } from "../lib/workflow.js";
afterEach(() => mock.restoreAll());

test("rack view includes item thumbnails, falls back to originals, and keeps items without photos usable", async () => {
  const query = value => ({ sort() { return this; }, collation() { return this; }, lean: async () => value });
  mock.method(Zone, "find", () => query([{ _id: "z1", code: "FLK", name: "FLK", active: true }]));
  mock.method(Rack, "find", () => query([{ _id: "r1", zone: "FLK", row: "A", pallet: 1, number: 1, locationId: "FLK-A-P1-1", capacity: 1, active: true }]));
  mock.method(Mould, "find", () => query([{ _id: "m1", toolId: "M1", rackId: "r1", status: "GOOD" }]));
  mock.method(Item, "find", (filter, projection) => {
    assert.equal(filter.deletedAt, null);
    assert.equal(projection.images, 1);
    return query([
      { mouldId: "m1", itemId: "P1", images: [{ path: "items/p1.webp", thumbPath: "items/p1-thumb.webp" }] },
      { mouldId: "m1", itemId: "P2", images: [{ path: "items/p2.webp" }] },
      { mouldId: "m1", itemId: "P3", images: [] },
    ]);
  });
  let body;
  await listRacks({ query: {} }, { json: value => { body = value; } });
  const items = body.zones[0].racks[0].moulds[0].items;
  assert.deepEqual(items.map(i => i.thumbUrl), ["/uploads/items/p1-thumb.webp", "/uploads/items/p2.webp", null]);
  assert.deepEqual(items.map(i => i.itemId), ["P1", "P2", "P3"]);
});

test("three racks, three pallets and four positions generate 36 distinct locations per zone", () => {
  const racks = buildRacks({ zone: "FLK", ...DEFAULT_LAYOUT });
  assert.equal(racks.length, 36);
  assert.equal(new Set(racks.map(r => r.locationId)).size, 36);
  assert.equal(racks[0].locationId, "FLK-A-P1-1");
  assert.equal(racks[4].locationId, "FLK-A-P2-1");
  assert.equal(racks.at(-1).locationId, "FLK-C-P3-4");
  assert.ok(racks.every(r => r.capacity === 1));
  for (const patch of [{ palletFrom: 0 }, { palletFrom: 4, palletTo: 2 }, { palletTo: undefined }, { palletTo: 100 }]) {
    assert.throws(() => buildRacks({ zone: "FLK", ...DEFAULT_LAYOUT, ...patch }), /Pallets/);
  }
  assert.throws(() => buildRacks({ zone: "FLK", rowFrom: "A", rowTo: "Z", from: 1, to: 999 }), /2000/);
});

test("models and API preserve the pallet coordinate when a position is renamed", async () => {
  const r = new Rack({ zone: "FLK", row: "A", pallet: 1, number: 2, code: "incorrect", capacity: null });
  await r.validate();
  assert.equal(r.locationId, "FLK-A-P1-2");
  assert.equal(r.capacity, 1);
  r.row = "B"; r.pallet = 3; r.number = 4;
  await r.validate();
  assert.equal(r.locationId, "FLK-B-P3-4");
  assert.equal(createRackSchema.parse({ zone: "FLK", row: "A", pallet: 1, number: 2 }).pallet, 1);
  assert.equal(updateRackSchema.parse({ pallet: 2 }).pallet, 2);
  for (const pallet of [0, -1, 1.5, 100]) assert.equal(createRackSchema.safeParse({ zone: "FLK", row: "A", pallet, number: 1 }).success, false);
  assert.equal(bulkRacksSchema.parse({ zone: "FLK", ...DEFAULT_LAYOUT }).palletTo, 3);
});

test("migration preserves ids, uses four positions per pallet, completes pallets and refuses occupied/colliding locations", () => {
  const racks = Array.from({ length: 10 }, (_, i) => ({ _id: String(i), zone: "FLK", row: "A", number: i + 1, code: `A${i + 1}`, locationId: `FLK-A${i + 1}`, active: true }));
  const plan = planRackPositions(racks);
  assert.equal(plan.changes[0].id, "0");
  assert.equal(plan.changes[0].to, "FLK-A-P1-1");
  assert.equal(plan.changes[4].to, "FLK-A-P2-1");
  assert.equal(plan.changes[9].to, "FLK-A-P3-2");
  assert.deepEqual(plan.create.map(r => r.locationId), ["FLK-A-P3-3", "FLK-A-P3-4"]);
  assert.deepEqual(plan.blockers, []);
  assert.match(planRackPositions(racks, new Map([["0", 2]])).blockers[0], /more than one/);
  assert.ok(planRackPositions([...racks, { _id: "other", pallet: 1, locationId: "FLK-A-P1-1" }]).blockers.some(b => /already exists/.test(b)));
  const converted = plan.changes.map(c => ({ ...racks.find(r => r._id === c.id), ...c.set }));
  assert.deepEqual(planRackPositions([...converted, ...plan.create]).changes, []);
  assert.deepEqual(planRackPositions([...converted, ...plan.create]).create, []);
});

test("a physical position rejects a second mould and records its full coordinate on movement", () => {
  const rack = { _id: "rack-id", locationId: "FLK-A-P1-1", zone: "FLK", pallet: 1, capacity: 1, active: true, zoneActive: true };
  const mould = { _id: "m1", toolId: "M1", location: "ISOLATION", status: "GOOD", owner: "FLK" };
  const user = { _id: "u1", role: "mould_maker" };
  assert.throws(() => planMove({ mould, user, to: "MOULD_ROOM", rack, rackOccupancy: 1 }), error => error.details?.code === "RACK_FULL");
  const result = planMove({ mould, user, to: "MOULD_ROOM", rack, rackOccupancy: 0 });
  assert.equal(result.movement.toRackLocationId, "FLK-A-P1-1");
  assert.equal(result.set.rackId, "rack-id");
});

test("restoring a deleted mould cannot claim an occupied position and locks the rack in the transaction", async () => {
  const doc = { _id: "m1", toolId: "M1", deletedAt: new Date(), location: "MOULD_ROOM", rackId: "r1" };
  let locked = false;
  mock.method(mongoose, "startSession", async () => ({ withTransaction: async work => work(), endSession: async () => {} }));
  mock.method(Mould, "findById", () => ({ session: async () => doc }));
  mock.method(Mould, "findOne", () => ({ session() { return this; }, lean: async () => null }));
  mock.method(Rack, "findById", () => ({ session() { return this; }, lean: async () => ({ _id: "r1", zone: "FLK", locationId: "FLK-A-P1-1", capacity: 1, active: true }) }));
  mock.method(Rack, "updateOne", async (_, update, options) => { locked = update.$inc.occupancyVersion === 1 && Boolean(options.session); });
  mock.method(Zone, "findOne", () => ({ session() { return this; }, lean: async () => ({ active: true }) }));
  mock.method(Mould, "countDocuments", () => ({ session: async () => 1 }));
  await assert.rejects(restoreMould({ params: { id: "m1" } }, {}), error => error.details?.code === "RACK_FULL");
  assert.equal(locked, true);
  assert.ok(doc.deletedAt);
});
