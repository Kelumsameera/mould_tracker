import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import sharp from "sharp";
import mongoose from "mongoose";
import { normalizeMachineCode, parseCapableMachines } from "../lib/machines.js";
import { SHEETS, cellText, clean, groupMoulds, imagesByRow, makePlan, parseCount, parseSheet, renderImage, summarize, toolKey } from "../scripts/import-moulds.mjs";

const config = SHEETS["INJECTION MOULDING"];
const HEAD = Object.values(config.headers);
const oid = () => new mongoose.Types.ObjectId();

// A small copy of the real layout: title rows, header on row 9, page footer, repeated header, logo, formula total.
async function workbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("INJECTION MOULDING");
  ws.getCell("A1").value = "FLEXICARE tools list";
  ws.getRow(9).values = [...HEAD, "PG 1"];
  const row = (r, v) => { ws.getRow(r).values = v; };
  row(10, ["1", "FLK 001", "INJ-03/INJ-04/ INJ-05", "gp0001-130", null, "Connector\n(5mm)", "100,000", "16", "QAS-IN-1", "XM1", "PVC", "N/A", "N/A"]);
  row(11, ["1", "FLK 001", "INJ 05", "GP0001-131", null, "Cap", "100000", "8 but 4 validated", "QAS-IN-1", "N/A", "N/A", "N/A", "N/A"]);
  row(12, ["2", "4021", "Pending", "GP0002-100", null, "Valve", "", "", "", "", "", "", ""]);
  ws.getCell("D13").value = { formula: "COUNTA(D10:D12)", result: 3 };
  row(14, ["", "Prepared by", "", "", "", "", "", "", "", "", "", "", ""]);
  row(16, [...HEAD, "PG 2"]);
  row(17, ["3", "L1/2", "N/A", "GP0003-001", null, "Tube", "5000", "2", "QAS-IN-2", "", "", "", ""]);
  row(18, ["", "", "INJ-01", "GP0003-002", null, "Tube 2", "5000", "2", "", "", "", "", ""]);
  ws.mergeCells("B17:B18"); // merged Tool ID must reach every row of the mould
  const png = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#3366cc" } }).png().toBuffer();
  const pic = wb.addImage({ buffer: png, extension: "png" });
  ws.addImage(pic, { tl: { col: 4, row: 9 }, ext: { width: 50, height: 50 } });  // row 10, Item Image
  ws.addImage(pic, { tl: { col: 3, row: 16 }, ext: { width: 50, height: 50 } }); // row 17, anchored one column early
  ws.addImage(pic, { tl: { col: 0, row: 0 }, ext: { width: 50, height: 50 } });  // logo on the title row
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(await wb.xlsx.writeBuffer());
  return reread.getWorksheet("INJECTION MOULDING");
}

test("machine codes share one spelling and capable machines split cleanly", () => {
  assert.equal(normalizeMachineCode("INJ_14"), "INJ-14");
  assert.equal(normalizeMachineCode(" inj 5 "), "INJ-05");
  assert.equal(normalizeMachineCode("MACHINE-01"), "MACHINE-01");
  assert.deepEqual(parseCapableMachines("INJ-03/INJ-04/ INJ-05"), { codes: ["INJ-03", "INJ-04", "INJ-05"], unknown: [] });
  assert.deepEqual(parseCapableMachines("INJ-01/INJ-02 INJ-03/").codes, ["INJ-01", "INJ-02", "INJ-03"]);
  assert.deepEqual(parseCapableMachines("N/A"), { codes: [], unknown: [] });
  assert.deepEqual(parseCapableMachines("Pending"), { codes: [], unknown: ["Pending"] });
});

test("cell values are cleaned: rich text, formulas, N/A and loose numbers", () => {
  assert.equal(cellText({ richText: [{ text: "A " }, { text: "\nB" }] }), "A B");
  assert.equal(cellText({ formula: "SUM(A1)", result: 7 }), "7");
  assert.equal(clean("N/A"), null); assert.equal(clean(" - "), null); assert.equal(clean("x"), "x");
  assert.deepEqual(parseCount("100,000"), { value: 100000, note: "" });
  assert.deepEqual(parseCount("8 but 4 validated"), { value: 8, note: "8 but 4 validated" });
  assert.deepEqual(parseCount(""), { value: null, note: "" });
  assert.equal(toolKey(" flk 001 "), "FLK001");
});

test("sheet parsing finds headers by name and skips headers, footers, totals and logos", async () => {
  const ws = await workbook();
  const parsed = parseSheet(ws, config);
  assert.equal(parsed.headerRow, 9);
  assert.deepEqual(parsed.missingHeaders, []);
  assert.deepEqual(parsed.rows.map((r) => r.rowNumber), [10, 11, 12, 17, 18]);
  assert.deepEqual(parsed.skipped, { repeatedHeader: 1, footerOrPartial: 1, formulaTotal: 1, blank: 1 });
  assert.equal(parsed.rows[0].itemId, "GP0001-130");
  assert.equal(parsed.rows[0].description, "Connector (5mm)");
  assert.equal(parsed.rows[0].masterbatchId, null);
  assert.equal(parsed.rows[4].toolId, "L1/2"); // forward-filled from the merge

  const { map, ignored } = imagesByRow(ws, parsed.rows.map((r) => r.rowNumber));
  assert.deepEqual([...map.keys()], [10, 17]);
  assert.equal(ignored, 1);

  const { moulds, warnings } = groupMoulds(parsed.rows, config, map);
  assert.deepEqual(moulds.map((m) => [m.toolId, m.items.length]), [["FLK 001", 2], ["4021", 1], ["L1/2", 2]]);
  const flk = moulds[0];
  assert.deepEqual(flk.capableMachines, ["INJ-03", "INJ-04", "INJ-05"]);
  assert.equal(flk.shotsToService, 100000);
  assert.equal(flk.owner, "FLK");
  assert.equal(moulds[1].owner, null);
  assert.equal(flk.items[1].cavities, 8);
  assert.match(flk.items[1].notes, /8 but 4 validated/);
  assert.equal(flk.items[0].imageIds.length, 1);
  assert.deepEqual(moulds[2].capableMachines, ["INJ-01"]);
  assert.ok(warnings.some((w) => /Pending/.test(w.warning)));
});

test("pictures become an 800px WebP plus thumbnail named by content", async () => {
  const png = await sharp({ create: { width: 1600, height: 400, channels: 3, background: "#ff0000" } }).png().toBuffer();
  const a = await renderImage(png), b = await renderImage(png);
  assert.equal(a.path, b.path);
  assert.match(a.path, /^items\/[0-9a-f]{20}\.webp$/);
  assert.equal(a.width, 800); assert.equal(a.height, 200);
  const thumb = await sharp(a.thumb).metadata();
  assert.equal(thumb.format, "webp"); assert.equal(thumb.width, 200);
});

function sheetOf(moulds) {
  return { moulds, rows: [], skipped: {}, missingHeaders: [], warnings: [] };
}
const sheetMould = (toolId, items, extra = {}) => ({
  key: toolKey(toolId), toolId, toolSetCount: "1", capableMachines: ["INJ-03"], shotsToService: 1000, owner: toolId.startsWith("FLK") ? "FLK" : null, rows: [1],
  items: items.map((itemId, i) => ({ itemId, description: "d", cavities: 2, notes: "", qas: null, materialId: null, materialDescription: null, masterbatchId: null, masterbatchDescription: null, sortOrder: i, imageIds: [] })),
  ...extra
});

test("merge by Tool ID ignoring spaces: sheet wins, history and extra items stay, nothing deleted", () => {
  const existing = { _id: oid(), toolId: "FLK001", toolSetCount: "", capableMachines: [], shotsToService: null, owner: "CCI", location: "MACHINE" };
  const onlyDb = { _id: oid(), toolId: "OLD-9" };
  const typo = { _id: oid(), toolId: "L12" };
  const db = {
    moulds: [existing, onlyDb, typo],
    items: [{ _id: oid(), mouldId: existing._id, itemId: "P1", description: "old" }, { _id: oid(), mouldId: existing._id, itemId: "LEGACY" }],
    machines: [{ _id: oid(), code: "INJ_03" }, { _id: oid(), code: "INJ-04" }, { _id: oid(), code: "INJ_04" }],
    imageSource: () => undefined
  };
  const sheet = sheetOf([sheetMould("FLK 001", ["P1", "P2"]), sheetMould("NEW1", ["X"]), sheetMould("L1/2", ["Y"])]);
  const plan = makePlan(sheet, db);

  assert.equal(plan.update.length, 1);
  const u = plan.update[0];
  assert.equal(String(u.current._id), String(existing._id));
  assert.deepEqual(u.mouldChanged.toolId, { from: "FLK001", to: "FLK 001" });
  assert.equal(u.next.owner, "CCI"); // an owner someone set is never overwritten
  assert.deepEqual(u.items.map((p) => [p.item.itemId, Boolean(p.old)]), [["P1", true], ["P2", false]]);
  assert.deepEqual(u.items[0].changed.description, { from: "old", to: "d" });
  assert.deepEqual(plan.legacyItemsKept, [{ toolId: "FLK 001", itemId: "LEGACY" }]);
  assert.deepEqual(plan.create.map((e) => e.sheet.toolId), ["NEW1"]);
  assert.deepEqual(plan.heldBack, [{ sheetToolId: "L1/2", dbToolId: "L12", rows: [1] }]);
  assert.deepEqual(plan.dbOnly, ["OLD-9"]);
  assert.deepEqual(plan.machineRenames.map((r) => [r.from, r.to]), [["INJ_03", "INJ-03"]]); // INJ_04 would collide, left alone
  assert.deepEqual(plan.machineCreates, []);

  const accepted = makePlan(sheet, db, { acceptPossible: true });
  assert.equal(accepted.heldBack.length, 0);
  assert.ok(accepted.update.some((e) => e.current.toolId === "L12" && e.possibleMatch));

  const s = summarize(plan, sheet, { summary: {} });
  assert.deepEqual(s.moulds, { create: 1, update: 1, unchanged: 0, heldBackPossibleMatch: 1, ambiguous: 0, duplicatesLeftAlone: 0, matchedButDeleted: 0, keptNotInSheet: 1 });
  assert.deepEqual(s.items, { create: 2, update: 1, unchanged: 0, keptNotInSheet: 1 });
});

test("re-running after an import plans no changes (idempotent)", () => {
  const sm = sheetMould("FLK 001", ["P1"]);
  const mould = { _id: oid(), toolId: "FLK 001", toolSetCount: "1", capableMachines: ["INJ-03"], shotsToService: 1000, owner: "FLK" };
  const item = { _id: oid(), mouldId: mould._id, itemId: "P1", description: "d", cavities: 2, qas: null, materialId: null, materialDescription: null, masterbatchId: null, masterbatchDescription: null, sortOrder: 0, images: [] };
  const plan = makePlan(sheetOf([sm]), { moulds: [mould], items: [item], machines: [{ _id: oid(), code: "INJ-03" }], imageSource: () => undefined });
  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.update.length + plan.create.length, 0);
});

test("duplicate moulds: the exact sheet spelling wins, the other copy is left alone; otherwise reported", () => {
  const spaced = { _id: oid(), toolId: "A 1" }, exact = { _id: oid(), toolId: "A1" };
  const db = { moulds: [spaced, exact], items: [], machines: [], imageSource: () => undefined };
  const plan = makePlan(sheetOf([sheetMould("A1", ["X"])]), db);
  assert.equal(plan.ambiguous.length, 0);
  assert.equal(String(plan.update[0].current._id), String(exact._id));
  assert.deepEqual(plan.duplicatesLeftAlone, [{ sheetToolId: "A1", mergedInto: "A1", leftAlone: "A 1" }]);
  assert.deepEqual(plan.dbOnly, ["A 1"]);

  const neither = makePlan(sheetOf([sheetMould("A1", ["X"])]), { ...db, moulds: [spaced, { _id: oid(), toolId: "A  1" }] });
  assert.equal(neither.ambiguous.length, 1);
});

test("a near match is merged only when confirmed with --match", () => {
  const db = { moulds: [{ _id: oid(), toolId: "A05 083" }], items: [], machines: [], imageSource: () => undefined };
  const sheet = sheetOf([sheetMould("A05-083", ["X"])]);
  assert.equal(makePlan(sheet, db).heldBack.length, 1);
  const ok = makePlan(sheet, db, { matches: { [toolKey("A05-083")]: toolKey("A05 083") } });
  assert.equal(ok.heldBack.length, 0);
  assert.equal(ok.update[0].current.toolId, "A05 083");
  assert.deepEqual(ok.update[0].mouldChanged.toolId, { from: "A05 083", to: "A05-083" });
  assert.equal(makePlan(sheet, db, { matches: { [toolKey("A05-083")]: "OTHER" } }).heldBack.length, 1);
});
