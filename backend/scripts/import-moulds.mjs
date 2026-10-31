// Imports moulds and items (with pictures) from the tools-list workbook.
//   node scripts/import-moulds.mjs --file <xlsx> [--sheet "INJECTION MOULDING"] [--dry-run] [--apply] [--match "A05-083=A05 083"]...
// Without --apply it is a dry run: it reads the workbook and the database and writes nothing.
// Merge rule: Tool ID (ignoring spaces) matches an existing mould -> sheet values win, history stays.
// If two existing moulds match, the one spelled exactly like the sheet wins and the other is left untouched.
// Near matches (differing only in punctuation) are held back unless confirmed with --match "SHEET=DB".
// Nothing is deleted: moulds and items missing from the sheet are kept and listed in the report.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import mongoose from "mongoose";
import { withTransaction } from "../config/db.js";
import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import Machine from "../models/Machine.js";
import Movement from "../models/Movement.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { normalizeMachineCode, parseCapableMachines } from "../lib/machines.js";
import { UPLOAD_DIR } from "../lib/uploads.js";
import { renderImage } from "../lib/images.js";
import { storageLocation } from "../lib/mouldState.js";

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export { UPLOAD_DIR };

// One entry per supported sheet; columns are found by header text, never by position.
export const SHEETS = {
  "INJECTION MOULDING": {
    headers: {
      toolSetCount: "Tool set count",
      toolId: "Tool ID",
      capableMachines: "Capable Machine(s)",
      itemId: "Item ID",
      image: "Item Image",
      description: "Description",
      shotsToService: "Shots to Be Service",
      cavities: "No. of Cavities",
      qas: "QAS",
      materialId: "Material ID",
      materialDescription: "Material Description",
      masterbatchId: "Masterbatch ID",
      masterbatchDescription: "Masterbatch Description"
    },
    // Tool IDs starting with these letters belong to that Mould Room zone. Others stay unassigned.
    ownerPrefixes: { FLK: "FLK" }
  },
  // Extrusion dies: stored in the Tool Room (no rack). "To Be Seravice" is service guidance text, not a shot
  // count, so it goes to the item notes together with the pin. Header spellings are the sheet's own.
  "EXTRUSION 01": {
    headers: {
      toolSetCount: "Tool set count",
      toolId: "Die ID",
      pinId: "Pin ID",
      capableMachines: "Capable Machine",
      itemId: "Item ID",
      image: "Item Image",
      description: "Decription",
      serviceNote: "To Be Seravice",
      qas: "QAS",
      materialId: "Material ID",
      materialDescription: "Material Description",
      masterbatchId: "Masterbatch ID",
      masterbatchDescription: "Masterbatch Description"
    },
    toolType: "EXTRUSION_DIE",
    // Title and signature rows fill both ID columns here; real die IDs look like LEX01D.
    toolIdPattern: /^[A-Z]+\d+[A-Z]*$/i,
    // One cell can list two items on separate lines ("L 211\nL 212"): each becomes its own item.
    splitItemLines: true,
    mouldNote: "Source: EXTRUSION 01",
    ownerPrefixes: {}
  }
};

const headerKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const toolKey = (id) => String(id ?? "").toUpperCase().replace(/\s+/g, "");
const looseKey = (id) => toolKey(id).replace(/[^A-Z0-9]/g, "");

// Plain text of a cell value: rich text, hyperlinks, formula results; whitespace and newlines collapsed.
export function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (value.richText) return cellText(value.richText.map((r) => r.text).join(""));
    if ("result" in value || "formula" in value || "sharedFormula" in value) return cellText(value.result);
    if ("text" in value) return cellText(value.text);
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim();
}

// "N/A", "-" and empty become null.
export const clean = (s) => (s == null || /^(n\/?a|-+|)$/i.test(String(s).trim()) ? null : String(s).trim());

// "100,000" -> 100000; "8 but 4 validated" -> { value: 8, note: "8 but 4 validated" }.
export function parseCount(raw) {
  const s = clean(raw);
  if (s == null) return { value: null, note: "" };
  const plain = s.replace(/,/g, "");
  if (/^\d+(\.0+)?$/.test(plain)) return { value: Math.round(Number(plain)), note: "" };
  const lead = plain.match(/^\d+/);
  return { value: lead ? Number(lead[0]) : null, note: s };
}

function findHeader(ws, headers) {
  const wanted = Object.fromEntries(Object.entries(headers).map(([field, label]) => [headerKey(label), field]));
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    const cols = {};
    ws.getRow(r).eachCell((cell, c) => {
      const field = wanted[headerKey(cellText(cell.value))];
      if (field && !cols[field]) cols[field] = c;
    });
    if (cols.toolId && cols.itemId) return { row: r, cols };
  }
  throw new Error("Header row with Tool ID and Item ID not found");
}

// Reads the sheet into item rows; header repeats, page footers, totals and blank lines are skipped.
export function parseSheet(ws, config) {
  const { row: headerRow, cols } = findHeader(ws, config.headers);
  const missing = Object.keys(config.headers).filter((f) => !cols[f]);
  const value = (r, field) => {
    if (!cols[field]) return "";
    const cell = ws.getCell(r, cols[field]);
    const source = cell.isMerged ? cell.master : cell; // merged cells: every row gets the merged value
    return { text: cellText(source.value), formula: Boolean(source.formula || source.sharedFormula) };
  };
  const rows = [];
  const skipped = { repeatedHeader: 0, footerOrPartial: 0, formulaTotal: 0, blank: 0 };
  const warnings = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const tool = value(r, "toolId"), item = value(r, "itemId");
    if (headerKey(tool.text) === headerKey(config.headers.toolId)) { skipped.repeatedHeader++; continue; }
    if (item.formula || tool.formula) { skipped.formulaTotal++; continue; }
    if (!tool.text && !item.text) { skipped.blank++; continue; }
    if (!tool.text || !item.text) { skipped.footerOrPartial++; continue; }
    if (config.toolIdPattern && !config.toolIdPattern.test(tool.text)) { skipped.footerOrPartial++; continue; }
    const row = { rowNumber: r };
    for (const field of Object.keys(config.headers)) {
      if (field === "image") continue;
      const v = value(r, field);
      if (v.formula) warnings.push({ row: r, field, warning: "formula cell ignored" });
      row[field] = v.formula ? null : clean(v.text);
    }
    row.toolId = row.toolId.toUpperCase();
    row.itemId = row.itemId.toUpperCase();
    if (config.splitItemLines) {
      const cell = ws.getCell(r, cols.itemId);
      const raw = (cell.isMerged ? cell.master : cell).value;
      const ids = String(raw?.richText ? raw.richText.map((t) => t.text).join("") : raw ?? "").split(/\r?\n/).map((s) => clean(s.replace(/\s+/g, " ")) ?? "").filter(Boolean);
      if (ids.length > 1) { for (const id of ids) rows.push({ ...row, itemId: id.toUpperCase() }); continue; }
    }
    rows.push(row);
  }
  return { headerRow, missingHeaders: missing, rows, skipped, warnings };
}

// Pictures anchored on an item row belong to that item; anything else (page logos) is ignored.
export function imagesByRow(ws, dataRows) {
  const rows = new Set(dataRows);
  const map = new Map();
  let ignored = 0;
  for (const img of ws.getImages()) {
    const r = Math.floor(img.range.tl.nativeRow ?? img.range.tl.row) + 1;
    if (!rows.has(r)) { ignored++; continue; }
    map.set(r, [...(map.get(r) || []), img.imageId]);
  }
  return { map, ignored };
}

const ownerFor = (toolId, prefixes) => Object.entries(prefixes).find(([p]) => toolId.startsWith(p))?.[1] ?? null;

// Groups item rows into moulds. Mould-level columns that disagree between rows keep the first value
// (capable machines are combined) and are reported.
export function groupMoulds(rows, config, images = new Map()) {
  const byKey = new Map();
  const warnings = [];
  for (const row of rows) {
    const key = toolKey(row.toolId);
    let m = byKey.get(key);
    if (!m) {
      m = { key, toolId: row.toolId, toolSetCount: row.toolSetCount ?? "", capableMachines: [], shotsToService: parseCount(row.shotsToService).value,
        owner: ownerFor(key, config.ownerPrefixes || {}), toolType: config.toolType ?? "INJECTION_MOULD", notes: config.mouldNote ?? "", items: [], rows: [] };
      byKey.set(key, m);
    } else {
      const shots = parseCount(row.shotsToService).value;
      if (shots != null && m.shotsToService != null && shots !== m.shotsToService) warnings.push({ row: row.rowNumber, toolId: m.toolId, warning: "shots to service differs from the first row; first kept" });
      if (m.shotsToService == null) m.shotsToService = shots;
    }
    const machines = parseCapableMachines(row.capableMachines);
    m.capableMachines = [...new Set([...m.capableMachines, ...machines.codes])].sort();
    if (machines.unknown.length) warnings.push({ row: row.rowNumber, toolId: m.toolId, warning: `capable machine not recognised: ${machines.unknown.join(", ")}` });
    m.rows.push(row.rowNumber);

    if (m.items.some((i) => i.itemId === row.itemId)) {
      warnings.push({ row: row.rowNumber, toolId: m.toolId, itemId: row.itemId, warning: "duplicate Item ID in this mould; first kept" });
      continue;
    }
    const cav = parseCount(row.cavities);
    m.items.push({
      itemId: row.itemId,
      description: row.description ?? "",
      cavities: cav.value,
      notes: [cav.note && `Cavities in tools list: ${cav.note}`, row.pinId && `Pin: ${row.pinId}`, row.serviceNote && `Service: ${row.serviceNote}`].filter(Boolean).join("\n"),
      qas: row.qas,
      materialId: row.materialId,
      materialDescription: row.materialDescription,
      masterbatchId: row.masterbatchId,
      masterbatchDescription: row.masterbatchDescription,
      sortOrder: m.items.length,
      imageIds: images.get(row.rowNumber) || [],
      rowNumber: row.rowNumber
    });
  }
  return { moulds: [...byKey.values()], warnings };
}

export { renderImage };

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const ITEM_FIELDS = ["itemId", "description", "cavities", "qas", "materialId", "materialDescription", "masterbatchId", "masterbatchDescription", "sortOrder"];
const fromSheet = (img) => String(img.source || "").startsWith("xlsx:");

function diff(current, next, fields) {
  const changed = {};
  for (const f of fields) if (!same(current?.[f], next[f])) changed[f] = { from: current?.[f] ?? null, to: next[f] };
  return changed;
}

// Compares the sheet with the database and decides every write. Pure, so dry run and --apply agree.
export function makePlan(sheet, db, { acceptPossible = false, matches: confirmed = {} } = {}) {
  const dbByKey = new Map();
  for (const m of db.moulds) dbByKey.set(toolKey(m.toolId), [...(dbByKey.get(toolKey(m.toolId)) || []), m]);
  const itemsByMould = new Map();
  for (const i of db.items) itemsByMould.set(String(i.mouldId), [...(itemsByMould.get(String(i.mouldId)) || []), i]);
  const sheetKeys = new Set(sheet.moulds.map((m) => m.key));
  const unmatchedDb = db.moulds.filter((m) => !sheetKeys.has(toolKey(m.toolId)));
  const looseDb = new Map(unmatchedDb.map((m) => [looseKey(m.toolId), m]));

  const plan = { create: [], update: [], unchanged: [], heldBack: [], ambiguous: [], duplicatesLeftAlone: [], deletedMatches: [], legacyItemsKept: [] };
  for (const s of sheet.moulds) {
    let matches = dbByKey.get(s.key) || [];
    let possible = null;
    if (!matches.length && looseDb.has(looseKey(s.toolId))) {
      possible = looseDb.get(looseKey(s.toolId));
      if (!acceptPossible && confirmed[toolKey(s.toolId)] !== toolKey(possible.toolId)) { plan.heldBack.push({ sheetToolId: s.toolId, dbToolId: possible.toolId, rows: s.rows }); continue; }
      matches = [possible];
    }
    if (matches.length > 1) {
      const exact = matches.filter((m) => m.toolId === s.toolId);
      if (exact.length === 1) {
        plan.duplicatesLeftAlone.push(...matches.filter((m) => m !== exact[0]).map((m) => ({ sheetToolId: s.toolId, mergedInto: exact[0].toolId, leftAlone: m.toolId })));
        matches = exact;
      }
    }
    if (matches.length > 1) { plan.ambiguous.push({ sheetToolId: s.toolId, dbToolIds: matches.map((m) => m.toolId) }); continue; }
    const current = matches[0];
    if (current?.deletedAt) { plan.deletedMatches.push({ sheetToolId: s.toolId, dbToolId: current.toolId }); continue; }

    const next = {
      toolId: s.toolId,
      toolSetCount: s.toolSetCount,
      capableMachines: s.capableMachines,
      shotsToService: s.shotsToService,
      owner: current?.owner ?? s.owner // never overwrite an owner someone already set
    };
    const existingItems = current ? itemsByMould.get(String(current._id)) || [] : [];
    const itemPlans = s.items.map((it) => {
      const old = existingItems.find((e) => toolKey(e.itemId) === toolKey(it.itemId));
      const fields = Object.fromEntries(ITEM_FIELDS.map((f) => [f, it[f]]));
      const changed = diff(old, fields, ITEM_FIELDS);
      if (it.notes && !String(old?.notes || "").includes(it.notes)) changed.notes = { from: old?.notes ?? "", to: [old?.notes, it.notes].filter(Boolean).join("\n") };
      const oldSheetImages = (old?.images || []).filter(fromSheet).map((i) => i.source);
      const imagesChanged = !same(oldSheetImages, it.imageIds.map((id) => db.imageSource(id)));
      return { old, item: it, fields, changed, imagesChanged };
    });
    const sheetItemKeys = new Set(s.items.map((i) => toolKey(i.itemId)));
    for (const e of existingItems) if (!sheetItemKeys.has(toolKey(e.itemId)) && !e.deletedAt) plan.legacyItemsKept.push({ toolId: s.toolId, itemId: e.itemId });

    const mouldChanged = diff(current, next, Object.keys(next));
    const entry = { sheet: s, current, next, mouldChanged, items: itemPlans, possibleMatch: Boolean(possible) };
    if (!current) plan.create.push(entry);
    else if (Object.keys(mouldChanged).length || itemPlans.some((p) => !p.old || Object.keys(p.changed).length || p.imagesChanged)) plan.update.push(entry);
    else plan.unchanged.push(entry);
  }
  const touched = new Set([...plan.update, ...plan.unchanged].map((e) => String(e.current._id)));
  const held = new Set(plan.heldBack.map((h) => h.dbToolId));
  plan.dbOnly = db.moulds.filter((m) => !touched.has(String(m._id)) && !held.has(m.toolId) && !m.deletedAt).map((m) => m.toolId);

  // Machines: legacy codes like INJ_14 get the sheet spelling INJ-14 (same _id); new capable machines are created.
  // Two records can normalize to the same code (e.g. "INJ_10" and "INJ 10"): the first rename wins and the
  // other is left as it is and reported. Merging them is a decision for a person, not the importer.
  const existingCodes = new Set(db.machines.map((m) => m.code));
  const claimed = new Set(existingCodes);
  plan.machineRenames = [];
  plan.machineRenameConflicts = [];
  for (const m of db.machines) {
    const to = normalizeMachineCode(m.code);
    if (to === m.code) continue;
    if (claimed.has(to)) { plan.machineRenameConflicts.push({ from: m.code, to }); continue; }
    claimed.add(to);
    plan.machineRenames.push({ id: m._id, from: m.code, to });
  }
  const afterRename = new Set([...existingCodes].map(normalizeMachineCode));
  plan.machineCreates = [...new Set(sheet.moulds.flatMap((m) => m.capableMachines))].filter((c) => !afterRename.has(c)).sort();
  return plan;
}

export function summarize(plan, sheet, images) {
  const all = [...plan.create, ...plan.update, ...plan.unchanged];
  const itemPlans = all.flatMap((e) => e.items);
  return {
    sheet: { itemRows: sheet.rows.length, moulds: sheet.moulds.length, skippedRows: sheet.skipped, missingHeaders: sheet.missingHeaders },
    moulds: { create: plan.create.length, update: plan.update.length, unchanged: plan.unchanged.length, heldBackPossibleMatch: plan.heldBack.length, ambiguous: plan.ambiguous.length, duplicatesLeftAlone: plan.duplicatesLeftAlone.length, matchedButDeleted: plan.deletedMatches.length, keptNotInSheet: plan.dbOnly.length },
    items: {
      create: itemPlans.filter((p) => !p.old).length,
      update: itemPlans.filter((p) => p.old && (Object.keys(p.changed).length || p.imagesChanged)).length,
      unchanged: itemPlans.filter((p) => p.old && !Object.keys(p.changed).length && !p.imagesChanged).length,
      keptNotInSheet: plan.legacyItemsKept.length
    },
    images: images.summary,
    machines: { rename: plan.machineRenames.length, create: plan.machineCreates.length, renameConflicts: plan.machineRenameConflicts.length },
    owner: { FLK: all.filter((e) => e.next.owner === "FLK").length, unassigned: all.filter((e) => !e.next.owner).length },
    warnings: sheet.warnings.length
  };
}

async function loadWorkbook(file, sheetName) {
  const config = SHEETS[sheetName];
  if (!config) throw new Error(`No importer for sheet "${sheetName}". Supported: ${Object.keys(SHEETS).join(", ")}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in workbook`);
  const parsed = parseSheet(ws, config);
  const { map, ignored } = imagesByRow(ws, parsed.rows.map((r) => r.rowNumber));
  const grouped = groupMoulds(parsed.rows, config, map);
  return { wb, sheetName, ...parsed, moulds: grouped.moulds, warnings: [...parsed.warnings, ...grouped.warnings], imageRows: map, ignoredImages: ignored };
}

// Renders every picture used by an item (dry run included, to catch broken files) without writing.
async function renderImages(sheet) {
  const ids = [...new Set([...sheet.imageRows.values()].flat())];
  const rendered = new Map();
  const failed = [];
  for (const id of ids) {
    const media = sheet.wb.model.media[id];
    try {
      const out = await renderImage(media.buffer);
      rendered.set(id, { ...out, source: `xlsx:${sheet.sheetName}:${media.name}.${media.extension}` });
    } catch (e) {
      failed.push({ imageId: id, error: e.message });
    }
  }
  const onDisk = [...rendered.values()].filter((r) => fs.existsSync(path.join(UPLOAD_DIR, r.path)) && fs.existsSync(path.join(UPLOAD_DIR, r.thumbPath))).length;
  const items = sheet.moulds.flatMap((m) => m.items);
  return {
    rendered,
    summary: {
      distinctPictures: ids.length,
      filesToWrite: rendered.size - onDisk,
      alreadyOnDisk: onDisk,
      failed: failed.length,
      itemsWithPicture: items.filter((i) => i.imageIds.length).length,
      itemsWithoutPicture: items.filter((i) => !i.imageIds.length).length,
      ignoredAnchors: sheet.ignoredImages,
      outputDir: UPLOAD_DIR
    },
    failed
  };
}

async function applyPlan(plan, images, actor, sheetName) {
  for (const r of plan.machineRenames) {
    await Machine.updateOne({ _id: r.id, code: r.from }, { $set: { code: r.to } });
    await AuditLog.create({ actorId: actor._id, actorName: actor.name, action: "machine.code_normalized", entityType: "Machine", entityId: r.id, entityLabel: r.to, before: { code: r.from }, after: { code: r.to } });
  }
  for (const code of plan.machineCreates) {
    const m = await Machine.findOneAndUpdate({ code }, { $setOnInsert: { code, name: code, active: true } }, { upsert: true, new: true });
    await AuditLog.create({ actorId: actor._id, actorName: actor.name, action: "machine.created", entityType: "Machine", entityId: m._id, entityLabel: code, reason: "Capable machine in tools list" });
  }

  fs.mkdirSync(path.join(UPLOAD_DIR, "items"), { recursive: true });
  for (const r of images.rendered.values()) {
    for (const [rel, data] of [[r.path, r.main], [r.thumbPath, r.thumb]]) {
      const target = path.join(UPLOAD_DIR, rel);
      if (!fs.existsSync(target)) fs.writeFileSync(target, data);
    }
  }
  const imageDocs = (ids) => ids.filter((id) => images.rendered.has(id)).map((id) => {
    const r = images.rendered.get(id);
    return { path: r.path, thumbPath: r.thumbPath, width: r.width, height: r.height, source: r.source };
  });

  const remarks = `Imported from tools list (${sheetName})`;
  for (const entry of [...plan.create, ...plan.update]) {
    await withTransaction(async (session) => {
      let mould = entry.current ? await Mould.findById(entry.current._id).session(session) : null;
      if (!mould) {
        // New moulds go to their storage room: injection moulds wait for a rack, extrusion dies sit in the Tool Room.
        const location = storageLocation(entry.sheet.toolType);
        [mould] = await Mould.create([{ ...entry.next, toolType: entry.sheet.toolType, notes: entry.sheet.notes, location, awaitingRack: location === "MOULD_ROOM", lastMovedAt: new Date(), lastMovedBy: actor._id }], { session });
        await Movement.create([{ mouldId: mould._id, toolId: mould.toolId, type: "IMPORTED", toLocation: location, toStatus: mould.status, remarks, performedBy: actor._id }], { session });
      } else if (Object.keys(entry.mouldChanged).length) {
        Object.assign(mould, entry.next);
        mould.version += 1;
        await mould.save({ session });
        await Movement.create([{ mouldId: mould._id, toolId: mould.toolId, type: "EDITED", fromLocation: mould.location, toLocation: mould.location, fromStatus: mould.status, toStatus: mould.status,
          remarks: `${remarks}: ${Object.keys(entry.mouldChanged).join(", ")}`, performedBy: actor._id }], { session });
      }
      const itemChanges = [];
      for (const p of entry.items) {
        const sheetImages = imageDocs(p.item.imageIds);
        if (!p.old) {
          await Item.create([{ ...p.fields, notes: p.item.notes, mouldId: mould._id, images: sheetImages }], { session });
          itemChanges.push({ itemId: p.item.itemId, created: true });
        } else if (Object.keys(p.changed).length || p.imagesChanged) {
          const set = Object.fromEntries(Object.entries(p.changed).map(([f, c]) => [f, c.to]));
          // Keep pictures not from the sheet, and keep a cleaned (background-removed) version of a sheet picture.
          const current = new Map((p.old.images || []).filter(fromSheet).map((i) => [i.source, i]));
          set.images = [...(p.old.images || []).filter((i) => !fromSheet(i)), ...sheetImages.map((img) => current.get(img.source) ?? img)];
          await Item.updateOne({ _id: p.old._id }, { $set: set }, { session });
          itemChanges.push({ itemId: p.item.itemId, changed: Object.keys(p.changed), images: p.imagesChanged });
        }
      }
      await AuditLog.create([{
        actorId: actor._id, actorName: actor.name, action: entry.current ? "mould.imported_update" : "mould.imported_create", entityType: "Mould", entityId: mould._id, entityLabel: mould.toolId,
        before: entry.current ? Object.fromEntries(Object.entries(entry.mouldChanged).map(([f, c]) => [f, c.from])) : null,
        after: { ...Object.fromEntries(Object.entries(entry.mouldChanged).map(([f, c]) => [f, c.to])), items: itemChanges }, reason: remarks
      }], { session });
    });
  }
}

const args = (argv) => {
  const get = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
  // --match "SHEET=DB" (repeatable) confirms a near match the dry run held back.
  const matches = {};
  argv.forEach((a, i) => {
    if (a !== "--match") return;
    const [sheetId, dbId] = String(argv[i + 1] ?? "").split("=");
    if (!sheetId || !dbId) throw new Error('--match expects "SHEET TOOL ID=DATABASE TOOL ID"');
    matches[toolKey(sheetId)] = toolKey(dbId);
  });
  return { file: get("--file"), sheet: get("--sheet") || "INJECTION MOULDING", apply: argv.includes("--apply"), matches };
};

async function main() {
  const opt = args(process.argv.slice(2));
  if (!opt.file) throw new Error("--file <path to xlsx> is required");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");

  const sheet = await loadWorkbook(path.resolve(opt.file), opt.sheet);
  const images = await renderImages(sheet);

  // Dry run must not create indexes or collections.
  mongoose.set("autoIndex", opt.apply);
  mongoose.set("autoCreate", opt.apply);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const mediaName = (id) => images.rendered.get(id)?.source;
    const [moulds, items, machines] = await Promise.all([Mould.find().lean(), Item.find().lean(), Machine.find().lean()]);
    const plan = makePlan(sheet, { moulds, items, machines, imageSource: mediaName }, { matches: opt.matches });
    const summary = summarize(plan, sheet, images);
    const report = {
      mode: opt.apply ? "apply" : "dry-run", database: mongoose.connection.db.databaseName, file: path.basename(opt.file), at: new Date().toISOString(), summary,
      unmatched: { dbOnly: plan.dbOnly, sheetOnlyCreated: plan.create.map((e) => e.sheet.toolId), heldBackPossibleMatches: plan.heldBack, ambiguous: plan.ambiguous, duplicatesLeftAlone: plan.duplicatesLeftAlone, matchedButDeleted: plan.deletedMatches },
      toolIdSpellingChanges: plan.update.filter((e) => e.mouldChanged.toolId).map((e) => e.mouldChanged.toolId),
      machineRenames: plan.machineRenames.map(({ from, to }) => ({ from, to })), machineRenameConflicts: plan.machineRenameConflicts, machineCreates: plan.machineCreates,
      itemsKeptNotInSheet: plan.legacyItemsKept, imageFailures: images.failed, warnings: sheet.warnings
    };
    const dir = path.resolve(BACKEND_DIR, "..", "outputs", "import");
    fs.mkdirSync(dir, { recursive: true });
    const reportFile = path.join(dir, `import-moulds-${report.mode}-${report.at.replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(JSON.stringify({ mode: report.mode, database: report.database, ...summary }, null, 2));
    console.log(`Full report: ${reportFile}`);
    if (opt.apply) {
      if (plan.ambiguous.length) throw new Error("Ambiguous Tool ID matches; fix them first (see report)");
      const actor = await User.findOne({ role: "super_admin", active: true, deletedAt: null });
      if (!actor) throw new Error("No active Super Admin to record the import under");
      await applyPlan(plan, images, actor, opt.sheet);
      await AuditLog.create({ actorId: actor._id, actorName: actor.name, action: "import.applied", entityType: "Import", entityLabel: report.file, after: summary });
      console.log("Applied.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
