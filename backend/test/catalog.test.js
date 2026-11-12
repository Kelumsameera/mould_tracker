// Catalog & Totals: the real aggregation pipelines, run in memory (mingo) on mixed data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Aggregator } from "mingo";
import { mouldSummaryPipeline, itemSummaryPipeline, shapeSummary, mouldListPipeline, productListPipeline, productDetailPipeline, shapeList, processOf, describeFilters, EXPORT_CAP } from "../lib/catalog.js";
import { familyOf } from "../config/itemFamilies.js";

const id = (n) => `id${n}`;
// M1 injection, 3 items; M2 injection, 1 item that M1 also makes; D1 extrusion die, 1 item; M9 deleted (excluded); M3 no items.
const moulds = [
  { _id: id(1), toolId: "FLK100", toolType: "INJECTION_MOULD", owner: "FLK", status: "GOOD", capableMachines: ["INJ-01", "INJ-02"], deletedAt: null },
  { _id: id(2), toolId: "FLK200", toolType: "INJECTION_MOULD", owner: "CCI", status: "NEEDS_REPAIR", capableMachines: ["INJ-02"], deletedAt: null },
  { _id: id(3), toolId: "FLK300", owner: null, status: "GOOD", capableMachines: [] }, // old document: no toolType, no deletedAt
  { _id: id(4), toolId: "LEX01D", toolType: "EXTRUSION_DIE", owner: null, status: "GOOD", capableMachines: ["EX02"], deletedAt: null },
  { _id: id(9), toolId: "GONE", toolType: "INJECTION_MOULD", status: "GOOD", capableMachines: [], deletedAt: new Date() }
];
const items = [
  { _id: "i1", mouldId: id(1), itemId: "GP0001-130", description: "OXYGEN CONNECTOR", cavities: 8, materialId: "PP1", images: [{ thumbPath: "items/a_thumb.webp" }], deletedAt: null },
  { _id: "i2", mouldId: id(1), itemId: "GP0002-100", description: "CAP", cavities: 4, materialId: "PP1", images: [], deletedAt: null },
  { _id: "i3", mouldId: id(1), itemId: "CP0010-1", description: "VALVE", cavities: 4, materialId: "PE2", images: [] },
  { _id: "i4", mouldId: id(2), itemId: "gp0001-130", description: "OXYGEN CONNECTOR", cavities: 2, materialId: "PP1", images: [], deletedAt: null },
  { _id: "i5", mouldId: id(4), itemId: "EX-TUBE-5", description: "TUBE 5MM", notes: "Pin: P77", materialId: "PVC", images: [], deletedAt: null },
  { _id: "i6", mouldId: id(1), itemId: "OLD-ITEM", description: "removed", deletedAt: new Date() },
  { _id: "i7", mouldId: id(9), itemId: "GHOST-1", description: "on deleted mould", deletedAt: null }
];
const run = (collection, pipeline) => new Aggregator(pipeline, { collectionResolver: (name) => ({ moulds, items })[name] }).run(collection);
const summary = (process) => shapeSummary(run(moulds, mouldSummaryPipeline(process)), run(items, itemSummaryPipeline(process)));

test("summary: mould count and unique item count stay separate; soft-deleted excluded", () => {
  const s = summary();
  assert.deepEqual([s.all.moulds, s.all.uniqueItems], [4, 4], "FLK100, FLK200, FLK300, LEX01D / GP0001-130, GP0002-100, CP0010-1, EX-TUBE-5");
  assert.equal(s.all.mouldsWithMultipleItems, 1);
  assert.equal(s.all.itemsInMultipleMoulds, 1, "GP0001-130 is made by FLK100 and FLK200 (case-insensitive)");
  assert.deepEqual([s.all.itemsPerMouldMax, s.all.itemsPerMouldAvg], [3, 1.3]);
});

test("summary: process split INJECTION / EXTRUSION", () => {
  const s = summary();
  assert.deepEqual([s.INJECTION.moulds, s.INJECTION.uniqueItems, s.EXTRUSION.moulds, s.EXTRUSION.uniqueItems], [3, 3, 1, 1]);
  const ext = summary("EXTRUSION");
  assert.deepEqual([ext.all.moulds, ext.all.uniqueItems, ext.INJECTION.moulds], [1, 1, 0]);
  assert.equal(processOf(undefined), "INJECTION");
});

test("moulds tab: rows, totals and breakdown follow the filters; pagination keeps the total", () => {
  const all = shapeList(run(moulds, mouldListPipeline({})), "moulds");
  assert.equal(all.total, 4);
  assert.deepEqual(all.rows.map((r) => [r.toolId, r.itemCount, r.cavities]), [["FLK100", 3, 16], ["FLK200", 1, 2], ["FLK300", 0, 0], ["LEX01D", 1, 0]]);
  assert.deepEqual(Object.fromEntries(all.breakdown.process.map((c) => [c.value, c.count])), { INJECTION: 3, EXTRUSION: 1 });
  const byMachine = shapeList(run(moulds, mouldListPipeline({ machine: "INJ-02" })), "moulds");
  assert.deepEqual([byMachine.total, byMachine.rows.map((r) => r.toolId)], [2, ["FLK100", "FLK200"]]);
  const page2 = shapeList(run(moulds, mouldListPipeline({ limit: 2, page: 2 })), "moulds");
  assert.deepEqual([page2.total, page2.rows.map((r) => r.toolId)], [4, ["FLK300", "LEX01D"]]);
  assert.equal(shapeList(run(moulds, mouldListPipeline({ material: "PE2" })), "moulds").total, 1);
  assert.equal(shapeList(run(moulds, mouldListPipeline({ owner: "NONE" })), "moulds").total, 2);
  assert.deepEqual(shapeList(run(moulds, mouldListPipeline({ q: "p77" })), "moulds").rows.map((r) => r.toolId), ["LEX01D"], "Pin ID search");
});

test("products tab: unique Item IDs with the list of moulds that make them", () => {
  const p = shapeList(run(items, productListPipeline({})), "products");
  assert.equal(p.total, 4);
  const gp = p.rows.find((r) => r._id === "GP0001-130");
  assert.deepEqual([gp.mouldCount, gp.moulds.map((m) => m.toolId).sort(), gp.thumbPath], [2, ["FLK100", "FLK200"], "items/a_thumb.webp"]);
  assert.deepEqual(Object.fromEntries(p.breakdown.family.map((c) => [c.value, c.count])), { GP: 2, CP: 1, EX: 1 });
  const gpOnly = shapeList(run(items, productListPipeline({ family: "GP" })), "products");
  assert.deepEqual(gpOnly.rows.map((r) => r._id), ["GP0001-130", "GP0002-100"]);
  assert.equal(shapeList(run(items, productListPipeline({ q: "oxygen" })), "products").total, 1);
  assert.equal(shapeList(run(items, productListPipeline({ process: "EXTRUSION" })), "products").total, 1);
  assert.equal(shapeList(run(items, productListPipeline({ material: "PP1", sort: "moulds" })), "products").rows[0]._id, "GP0001-130");
});

test("product detail lists every live mould that makes the item", () => {
  const rows = run(items, productDetailPipeline("gp0001-130"));
  assert.deepEqual(rows.map((r) => r.mould.toolId), ["FLK100", "FLK200"]);
});

test("special characters in filters never break the pipeline", () => {
  for (const q of ["a(b", "*", "\\", "??", "%$#@!"]) assert.equal(shapeList(run(moulds, mouldListPipeline({ q })), "moulds").total, 0, q);
  // Punctuation is ignored: "[x" searches "x", "flk-100" and "FLK 100" find FLK100.
  assert.deepEqual(shapeList(run(moulds, mouldListPipeline({ q: "[x" })), "moulds").rows.map((r) => r.toolId), ["LEX01D"]);
  for (const q of ["flk-100", "FLK 100", "flk_100"]) assert.deepEqual(shapeList(run(moulds, mouldListPipeline({ q })), "moulds").rows.map((r) => r.toolId), ["FLK100"], q);
});

test("families, export header text and cap", () => {
  assert.deepEqual([familyOf("GP0001-130"), familyOf("cp12"), familyOf("123")], ["GP", "CP", ""]);
  assert.equal(describeFilters({ process: "INJECTION", q: "", tab: "moulds", status: "GOOD" }), "process=INJECTION; status=GOOD");
  assert.equal(EXPORT_CAP, 5000);
});
