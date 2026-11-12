// Catalog & Totals: complete counts of moulds and of products (items), per process.
// Pure aggregation-pipeline builders; the controller runs them with Mould/Item.aggregate (server-side, no
// documents loaded into memory). Soft-deleted moulds and items are always excluded.
//   mould count != item count: one mould makes several items, one item may come from several moulds.
import { familyLabel } from "../config/itemFamilies.js";
import { keyFilter, looseRegex, queryWords } from "./search.js";

// Forgiving search (lib/search.js) on a document's searchKey (and optionally its joined items' keys);
// documents without a key yet fall back to separator-tolerant matching of their raw fields.
function searchMatch(q, prefix, legacyFields, itemsPrefix = null) {
  const words = queryWords(q);
  if (!words.length) return { _id: { $exists: false } };
  const loose = looseRegex(words);
  const or = [keyFilter(words, prefix + "searchKey"), { [prefix + "searchKey"]: null, $or: legacyFields.map((f) => ({ [prefix + f]: loose })) }];
  if (itemsPrefix) or.push(keyFilter(words, itemsPrefix + "searchKey"), { [itemsPrefix + "notes"]: loose });
  return { $or: or };
}

export const PROCESSES = ["INJECTION", "EXTRUSION"];
// The process is the tool type (one source of truth): extrusion dies vs everything else (injection moulds).
export const processOf = (toolType) => (toolType === "EXTRUSION_DIE" ? "EXTRUSION" : "INJECTION");
const processExpr = (field) => ({ $cond: [{ $eq: [field, "EXTRUSION_DIE"] }, "EXTRUSION", "INJECTION"] });
export function processMatch(process, prefix = "") {
  if (process === "EXTRUSION") return { [`${prefix}toolType`]: "EXTRUSION_DIE" };
  if (process === "INJECTION") return { [`${prefix}toolType`]: { $ne: "EXTRUSION_DIE" } };
  return {};
}

export const PAGE_SIZE = 20;
export const EXPORT_CAP = 5000;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// true when a deletedAt value is null or missing (a missing field is not equal to null in expressions)
const LIVE = (field) => ({ $not: [{ $ifNull: [field, false] }] });

// Live items joined with their live mould (one row per item-in-mould).
function itemRows(process) {
  return [
    { $match: { deletedAt: null } },
    { $lookup: { from: "moulds", localField: "mouldId", foreignField: "_id", as: "m" } },
    { $unwind: "$m" },
    { $match: { "m.deletedAt": null, ...processMatch(process, "m.") } },
    { $addFields: { key: { $toUpper: "$itemId" }, process: processExpr("$m.toolType") } }
  ];
}

// ---- Summary cards ----
// Moulds side: total, items per mould (avg / max), moulds with more than one item. Grouped by process.
export function mouldSummaryPipeline(process) {
  return [
    { $match: { deletedAt: null, ...processMatch(process) } },
    { $lookup: { from: "items", localField: "_id", foreignField: "mouldId", as: "items" } },
    { $project: { process: processExpr("$toolType"), n: { $size: { $filter: { input: "$items", as: "i", cond: LIVE("$$i.deletedAt") } } } } },
    { $group: { _id: "$process", moulds: { $sum: 1 }, totalItems: { $sum: "$n" }, maxItems: { $max: "$n" }, multiItem: { $sum: { $cond: [{ $gt: ["$n", 1] }, 1, 0] } } } }
  ];
}
// Items side: unique Item IDs and items made by more than one mould, per process and overall.
export function itemSummaryPipeline(process) {
  return [
    ...itemRows(process),
    { $group: { _id: "$key", moulds: { $addToSet: "$m._id" }, processes: { $addToSet: "$process" } } },
    { $project: { n: { $size: "$moulds" }, processes: 1 } },
    { $facet: {
      all: [{ $group: { _id: null, unique: { $sum: 1 }, multiMould: { $sum: { $cond: [{ $gt: ["$n", 1] }, 1, 0] } } } }],
      byProcess: [{ $unwind: "$processes" }, { $group: { _id: "$processes", unique: { $sum: 1 }, multiMould: { $sum: { $cond: [{ $gt: ["$n", 1] }, 1, 0] } } } }]
    } }
  ];
}
// Combine both sides into the cards: { all, INJECTION, EXTRUSION }.
export function shapeSummary(mouldRows, itemFacet) {
  const empty = () => ({ moulds: 0, uniqueItems: 0, itemsPerMouldAvg: 0, itemsPerMouldMax: 0, mouldsWithMultipleItems: 0, itemsInMultipleMoulds: 0, itemLinks: 0 });
  const out = { all: empty(), INJECTION: empty(), EXTRUSION: empty() };
  for (const r of mouldRows) {
    for (const k of [r._id, "all"]) {
      const t = out[k];
      t.moulds += r.moulds; t.itemLinks += r.totalItems; t.mouldsWithMultipleItems += r.multiItem;
      t.itemsPerMouldMax = Math.max(t.itemsPerMouldMax, r.maxItems ?? 0);
    }
  }
  const f = itemFacet?.[0] ?? { all: [], byProcess: [] };
  if (f.all[0]) Object.assign(out.all, { uniqueItems: f.all[0].unique, itemsInMultipleMoulds: f.all[0].multiMould });
  for (const r of f.byProcess) Object.assign(out[r._id], { uniqueItems: r.unique, itemsInMultipleMoulds: r.multiMould });
  for (const t of Object.values(out)) t.itemsPerMouldAvg = t.moulds ? Math.round((t.itemLinks / t.moulds) * 10) / 10 : 0;
  return out;
}

// ---- Moulds tab ----
const MOULD_SORT = { toolId: { toolId: 1 }, items: { itemCount: -1, toolId: 1 }, status: { status: 1, toolId: 1 } };
export function mouldListPipeline({ process, status, owner, machine, material, q, sort = "toolId", page = 1, limit = PAGE_SIZE } = {}) {
  const match = { deletedAt: null, ...processMatch(process) };
  if (status) match.status = status;
  if (owner) match.owner = owner === "NONE" ? null : owner;
  if (machine) match.capableMachines = machine;
  const after = {};
  if (material) after.materials = material;
  if (q) Object.assign(after, searchMatch(q, "", ["toolId"], "items.")); // Die ID = Tool ID; Pin ID is in the items' keys
  return [
    { $match: match },
    { $lookup: { from: "items", localField: "_id", foreignField: "mouldId", as: "items" } },
    { $addFields: { items: { $filter: { input: "$items", as: "i", cond: LIVE("$$i.deletedAt") } } } },
    { $addFields: {
      process: processExpr("$toolType"),
      itemCount: { $size: "$items" },
      cavities: { $sum: "$items.cavities" },
      materials: { $setUnion: [{ $filter: { input: "$items.materialId", as: "x", cond: { $ne: ["$$x", null] } } }, []] }
    } },
    ...(Object.keys(after).length ? [{ $match: after }] : []),
    { $facet: {
      rows: [{ $sort: MOULD_SORT[sort] ?? MOULD_SORT.toolId }, { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { toolId: 1, toolType: 1, process: 1, owner: 1, capableMachines: 1, cavities: 1, itemCount: 1, status: 1, location: 1, machineId: 1, rackId: 1, materials: 1 } }],
      total: [{ $count: "n" }],
      byProcess: [{ $group: { _id: "$process", n: { $sum: 1 } } }],
      byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
      byOwner: [{ $group: { _id: "$owner", n: { $sum: 1 } } }],
      byMachine: [{ $unwind: "$capableMachines" }, { $group: { _id: "$capableMachines", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 30 }],
      byMaterial: [{ $unwind: "$materials" }, { $group: { _id: "$materials", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 30 }]
    } }
  ];
}

// ---- Products tab (unique Item IDs) ----
const PRODUCT_SORT = { itemId: { _id: 1 }, moulds: { mouldCount: -1, _id: 1 } };
export function productListPipeline({ process, family, material, q, sort = "itemId", page = 1, limit = PAGE_SIZE } = {}) {
  const match = {};
  if (material) match.materialId = material;
  if (family) match.key = { $regex: `^${escapeRegex(family.toUpperCase())}(?![A-Z])` };
  if (q) Object.assign(match, searchMatch(q, "", ["itemId", "description"]));
  return [
    ...itemRows(process),
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $sort: { "m.toolId": 1 } },
    { $group: {
      _id: "$key",
      description: { $first: "$description" },
      thumbPath: { $max: { $arrayElemAt: ["$images.thumbPath", 0] } },
      materialId: { $first: "$materialId" }, materialDescription: { $first: "$materialDescription" },
      masterbatchId: { $first: "$masterbatchId" }, qas: { $first: "$qas" },
      processes: { $addToSet: "$process" },
      moulds: { $addToSet: { id: "$m._id", toolId: "$m.toolId" } }
    } },
    { $addFields: { mouldCount: { $size: "$moulds" }, family: { $let: { vars: { r: { $regexFind: { input: "$_id", regex: "^[A-Z]+" } } }, in: { $ifNull: ["$$r.match", ""] } } } } },
    { $facet: {
      rows: [{ $sort: PRODUCT_SORT[sort] ?? PRODUCT_SORT.itemId }, { $skip: (page - 1) * limit }, { $limit: limit }],
      total: [{ $count: "n" }],
      byFamily: [{ $group: { _id: "$family", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }],
      byMaterial: [{ $match: { materialId: { $ne: null } } }, { $group: { _id: "$materialId", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 30 }],
      byProcess: [{ $unwind: "$processes" }, { $group: { _id: "$processes", n: { $sum: 1 } } }]
    } }
  ];
}

const chips = (rows = [], label = (v) => v) => rows.map((r) => ({ value: r._id ?? null, label: label(r._id), count: r.n }));
export function shapeList(facetResult, kind) {
  const f = facetResult?.[0] ?? {};
  const base = { total: f.total?.[0]?.n ?? 0, rows: f.rows ?? [] };
  if (kind === "moulds") return { ...base, breakdown: { process: chips(f.byProcess), status: chips(f.byStatus), owner: chips(f.byOwner), machine: chips(f.byMachine), material: chips(f.byMaterial) } };
  return { ...base, breakdown: { family: chips(f.byFamily, (c) => familyLabel(c ?? "")), material: chips(f.byMaterial), process: chips(f.byProcess) } };
}

// Sorted Moulds of one product, for its detail sheet.
export function productDetailPipeline(itemId) {
  return [
    ...itemRows(null),
    { $match: { key: String(itemId).toUpperCase() } },
    { $sort: { "m.toolId": 1 } },
    { $project: { _id: 0, itemId: 1, description: 1, cavities: 1, materialId: 1, masterbatchId: 1, qas: 1, images: 1, mould: { id: "$m._id", toolId: "$m.toolId", status: "$m.status", process: "$process", owner: "$m.owner" } } }
  ];
}

// Text for the export header: which filters produced the file.
export const describeFilters = (f) => Object.entries(f).filter(([k, v]) => v && !["page", "limit", "format", "tab"].includes(k)).map(([k, v]) => `${k}=${v}`).join("; ") || "none";
