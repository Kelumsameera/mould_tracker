import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import Zone from "../models/Zone.js";
import Movement from "../models/Movement.js";
import User from "../models/User.js";
import { withTransaction } from "../config/db.js";
import { fail } from "../utils/ApiError.js";
import { itemDTO, mouldDTO, movementDTO } from "../utils/serializers.js";
import { audit, changes } from "../lib/audit.js";
import { normalizeMachineCode } from "../lib/machines.js";
import { planInitialLocation, planMove, planShots, planStatus, serviceDueChange } from "../lib/workflow.js";
import { can } from "../lib/permissions.js";
import { resolveProblem } from "./workLogController.js";
import { photosFromDataUrls, saveRendered } from "../lib/images.js";
import { mouldStateError, toolTypeFilter } from "../lib/mouldState.js";

const NUMERIC_SORT = { locale: "en", numericOrdering: true };
const SERVICE_STATUSES = ["NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR"];
const MOULD_FIELDS = ["toolId", "toolType", "toolSetCount", "size", "owner", "capableMachines", "shotsToService", "notes"];
const ITEM_FIELDS = ["itemId", "description", "cavities", "qas", "materialId", "materialDescription", "masterbatchId", "masterbatchDescription", "notes", "sortOrder"];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toolKey = (s) => String(s).toUpperCase().replace(/\s+/g, "");
// Spaces optional between characters, each character escaped on its own (split first, then escape).
const spacedPattern = (s) => [...toolKey(s)].map(escapeRegex).join("\\s*");
const byId = (docs) => new Map(docs.map((d) => [String(d._id), d]));

// Machines, racks and users referenced by these moulds, for the DTOs.
async function refsFor(moulds) {
  const ids = (f) => [...new Set(moulds.map((m) => m[f]).filter(Boolean).map(String))];
  const [machines, racks, users] = await Promise.all([
    Machine.find({ _id: { $in: ids("machineId") } }).lean(),
    Rack.find({ _id: { $in: ids("rackId") } }).lean(),
    User.find({ _id: { $in: ids("lastMovedBy") } }, { name: 1 }).lean()
  ]);
  return { machines: byId(machines), racks: byId(racks), users: byId(users) };
}

async function respondWithMould(res, id, status = 200, extra = {}) {
  const mould = await Mould.findById(id).lean();
  const [refs, items] = await Promise.all([refsFor([mould]), Item.find({ mouldId: id, deletedAt: null }).sort({ sortOrder: 1, itemId: 1 }).lean()]);
  res.status(status).json({ success: true, mould: { ...mouldDTO(mould, refs), items: items.map(itemDTO) }, ...extra });
}

async function loadForUpdate(id, session, version) {
  const mould = await Mould.findById(id).session(session);
  if (!mould) fail(404, "NOT_FOUND", "Mould not found");
  if (version !== undefined && version !== mould.version) fail(409, "STALE", `${mould.toolId} was changed by someone else. Refresh and try again.`);
  return mould;
}

// Current machine and rack, for the "from" side of a movement.
async function withPlace(mould, session) {
  const [machine, rack] = await Promise.all([
    mould.machineId ? Machine.findById(mould.machineId).session(session).lean() : null,
    mould.rackId ? Rack.findById(mould.rackId).session(session).lean() : null
  ]);
  return { ...mould.toObject(), machine, rack };
}

async function rackForMove(rackId, mouldId, session) {
  if (!rackId) return { rack: null, rackOccupancy: 0 };
  const rack = await Rack.findById(rackId).session(session).lean();
  if (!rack) fail(404, "NOT_FOUND", "Rack not found");
  const zone = await Zone.findOne({ code: rack.zone }).session(session).lean();
  const rackOccupancy = await Mould.countDocuments({ rackId: rack._id, deletedAt: null, _id: { $ne: mouldId } }).session(session);
  return { rack: { ...rack, zoneActive: Boolean(zone?.active && !zone?.deletedAt) }, rackOccupancy };
}

// GET /api/moulds - search by Tool ID, Item ID, item description, machine or rack, plus filters.
export async function listMoulds(req, res) {
  const q = req.validQuery;
  const filter = { ...toolTypeFilter(q.toolType), deletedAt: q.deleted === "true" && can(req.user, "moulds.manage") ? { $ne: null } : null };
  if (q.location) filter.location = q.location;
  if (q.status) filter.status = q.status;
  if (q.owner) filter.owner = q.owner.toUpperCase();
  if (q.machineId) filter.machineId = q.machineId;
  if (q.rackId) filter.rackId = q.rackId;
  if (q.awaitingRack) filter.awaitingRack = q.awaitingRack === "true";
  if (q.needsService === "true") filter.status = { $in: SERVICE_STATUSES };
  if (q.problem === "true") filter.openProblem = { $ne: null };
  if (q.zone) filter.rackId = { $in: (await Rack.find({ zone: q.zone.toUpperCase() }, { _id: 1 }).lean()).map((r) => r._id) };

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    const compact = new RegExp(spacedPattern(q.q), "i"); // "FLK 19066" finds "FLK19066" and back
    const rackText = q.q.toUpperCase().replace(/MOULD\s*ROOM/g, "").replace(/[\s·,]+/g, "-").replace(/^-|-$/g, ""); // "FLK A3" -> FLK-A3
    const [itemMoulds, machines, racks] = await Promise.all([
      Item.distinct("mouldId", { deletedAt: null, $or: [{ itemId: compact }, { description: rx }] }),
      Machine.find({ $or: [{ code: rx }, { code: normalizeMachineCode(q.q) }, { name: rx }] }, { _id: 1 }).lean(),
      Rack.find({ deletedAt: null, $or: [{ locationId: new RegExp(escapeRegex(rackText), "i") }, { code: rackText }] }, { _id: 1 }).lean()
    ]);
    filter.$or = [
      { toolId: compact },
      { notes: rx },
      { _id: { $in: itemMoulds } },
      { machineId: { $in: machines.map((m) => m._id) } },
      { rackId: { $in: racks.map((r) => r._id) } },
      { capableMachines: normalizeMachineCode(q.q) }
    ];
  }

  const moulds = await Mould.find(filter).sort({ toolId: 1 }).collation(NUMERIC_SORT).lean();
  const ids = moulds.map((m) => m._id);
  const [refs, itemStats] = await Promise.all([
    refsFor(moulds),
    Item.aggregate([
      { $match: { mouldId: { $in: ids }, deletedAt: null } },
      { $sort: { sortOrder: 1 } },
      { $group: { _id: "$mouldId", itemCount: { $sum: 1 }, itemIds: { $push: "$itemId" }, firstImage: { $first: { $arrayElemAt: ["$images.thumbPath", 0] } }, anyImage: { $push: { $arrayElemAt: ["$images.thumbPath", 0] } } } }
    ])
  ]);
  const stats = new Map(itemStats.map((s) => [String(s._id), s]));
  res.json({
    success: true,
    moulds: moulds.map((m) => {
      const s = stats.get(String(m._id));
      const thumb = s?.firstImage || s?.anyImage?.find(Boolean);
      return mouldDTO(m, refs, { itemCount: s?.itemCount ?? 0, itemIds: s?.itemIds ?? [], thumbUrl: thumb ? `/uploads/${thumb}` : null });
    })
  });
}

// GET /api/moulds/stats - dashboard counts.
export async function mouldStats(req, res) {
  const live = { deletedAt: null, ...toolTypeFilter(req.validQuery?.toolType) };
  const [byLocation, byStatus, awaitingRack, serviceDue, problems] = await Promise.all([
    Mould.aggregate([{ $match: live }, { $group: { _id: "$location", n: { $sum: 1 } } }]),
    Mould.aggregate([{ $match: live }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Mould.countDocuments({ ...live, awaitingRack: true }),
    Mould.countDocuments({ ...live, status: "GOOD", shotsToService: { $gt: 0 }, $expr: { $gte: ["$totalShots", "$shotsToService"] } }),
    Mould.countDocuments({ ...live, openProblem: { $ne: null } })
  ]);
  const toObj = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  const status = toObj(byStatus);
  res.json({
    success: true,
    stats: {
      total: byLocation.reduce((n, r) => n + r.n, 0),
      byLocation: toObj(byLocation),
      byStatus: status,
      needsAttention: SERVICE_STATUSES.reduce((n, s) => n + (status[s] || 0), 0),
      serviceDueNotFlagged: serviceDue,
      awaitingRack,
      problemsReported: problems
    }
  });
}

export async function getMould(req, res) {
  const mould = await Mould.findById(req.params.id).lean();
  if (!mould || (mould.deletedAt && !can(req.user, "moulds.manage"))) fail(404, "NOT_FOUND", "Mould not found");
  await respondWithMould(res, mould._id);
}

export async function getMouldHistory(req, res) {
  const history = await Movement.find({ mouldId: req.params.id }).sort({ createdAt: -1 }).lean();
  const users = byId(await User.find({ _id: { $in: [...new Set(history.map((h) => String(h.performedBy)))] } }, { name: 1 }).lean());
  res.json({ success: true, history: history.map((h) => movementDTO(h, users)) });
}

async function assertToolIdFree(toolId, exceptId, session) {
  const rx = new RegExp(`^${spacedPattern(toolId)}$`, "i");
  const clash = await Mould.findOne({ toolId: rx, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).session(session).lean();
  if (clash) fail(409, "DUPLICATE_TOOL_ID", `Tool ID ${clash.toolId} already exists${clash.deletedAt ? " (deleted; restore it instead)" : ""}`);
}

const cleanMachines = (list) => (list === undefined ? undefined : [...new Set(list.map(normalizeMachineCode))].sort());

// POST /api/moulds
export async function createMould(req, res) {
  const { items, location, rackId, overrideReason, ...fields } = req.body;
  fields.capableMachines = cleanMachines(fields.capableMachines) ?? [];
  const id = await withTransaction(async (session) => {
    await assertToolIdFree(fields.toolId, null, session);
    const { rack, rackOccupancy } = await rackForMove(rackId, null, session);
    const { set } = planInitialLocation({ user: req.user, location, toolType: fields.toolType, rack, rackOccupancy, owner: fields.owner ?? null, overrideReason });
    const [mould] = await Mould.create([{ ...fields, ...set }], { session });
    if (items.length) await Item.create(items.map((it, i) => ({ sortOrder: i, ...it, mouldId: mould._id })), { session, ordered: true });
    await Movement.create([{ mouldId: mould._id, toolId: mould.toolId, type: "CREATED", toLocation: mould.location, toStatus: mould.status,
      toRackId: rack?._id ?? null, toRackLocationId: rack?.locationId ?? null, overrideReason, performedBy: req.user._id }], { session });
    await audit(req, { action: "mould.created", entityType: "Mould", entityId: mould._id, entityLabel: mould.toolId, after: { ...fields, location, rack: rack?.locationId ?? null, items: items.map((i) => i.itemId) }, reason: overrideReason }, session);
    return mould._id;
  });
  await respondWithMould(res, id, 201);
}

// PATCH /api/moulds/:id - details only; location and status change through move/status.
export async function updateMould(req, res) {
  const { version, remarks, ...fields } = req.body;
  if (fields.capableMachines !== undefined) fields.capableMachines = cleanMachines(fields.capableMachines);
  const id = await withTransaction(async (session) => {
    const mould = await loadForUpdate(req.params.id, session, version);
    if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
    if (fields.toolId && toolKey(fields.toolId) !== toolKey(mould.toolId)) await assertToolIdFree(fields.toolId, mould._id, session);
    const before = mould.toObject();
    Object.assign(mould, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
    const stateError = mouldStateError(mould);
    if (stateError) fail(400, "INVALID_LOCATION", stateError);
    const diff = changes(before, mould.toObject(), MOULD_FIELDS);
    if (!diff.fields.length) fail(400, "NO_CHANGE", "Nothing changed");

    const due = serviceDueChange(mould.toObject(), req.user, "Shot limit changed"); // rule 8
    if (due.statusSet) Object.assign(mould, due.statusSet);
    mould.version += 1;
    await mould.save({ session });
    await Movement.create([{ mouldId: mould._id, toolId: mould.toolId, type: "EDITED", fromLocation: mould.location, toLocation: mould.location,
      fromStatus: before.status, toStatus: before.status, remarks: [`Changed: ${diff.fields.join(", ")}`, remarks].filter(Boolean).join(". "), performedBy: req.user._id }], { session });
    if (due.movement) await Movement.create([due.movement], { session });
    await audit(req, { action: "mould.updated", entityType: "Mould", entityId: mould._id, entityLabel: mould.toolId, before: diff.before, after: diff.after, reason: remarks }, session);
    return mould._id;
  });
  await respondWithMould(res, id);
}

// POST /api/moulds/:id/move
export async function moveMould(req, res) {
  const { to, machineId, machineCode, rackId, status, remarks, overrideReason, version, outOfServiceDetails } = req.body;
  let warnings = [];
  const id = await withTransaction(async (session) => {
    const doc = await loadForUpdate(req.params.id, session, version);
    const mould = await withPlace(doc, session);

    let machine = null, occupant = null;
    if (to === "MACHINE") {
      machine = machineId ? await Machine.findById(machineId).session(session).lean()
        : machineCode ? await Machine.findOne({ code: normalizeMachineCode(machineCode) }).session(session).lean() : null;
      if ((machineId || machineCode) && !machine) fail(404, "NOT_FOUND", "Machine not found");
      if (machine) occupant = await Mould.findOne({ location: "MACHINE", machineId: machine._id, deletedAt: null, _id: { $ne: doc._id } }).session(session).lean();
    }
    const { rack, rackOccupancy } = to === "MOULD_ROOM" ? await rackForMove(rackId, doc._id, session) : { rack: null, rackOccupancy: 0 };

    const plan = planMove({ mould, user: req.user, to, machine, occupant, rack, rackOccupancy, remarks, overrideReason, status, outOfServiceDetails });
    warnings = plan.warnings;
    Object.assign(doc, plan.set);
    if (to === "WORKSHOP") {
      doc.remarks = remarks; // the latest service/repair note shows on the mould
      await resolveProblem(req, doc, remarks, session); // sending it for repair is acting on a reported problem
    }
    doc.version += 1;
    await doc.save({ session });
    await Movement.create([plan.movement], { session });
    await audit(req, {
      action: "mould.moved", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId,
      before: { location: mould.location, status: mould.status, machine: mould.machine?.code ?? null, rack: mould.rack?.locationId ?? null },
      after: { location: doc.location, status: doc.status, machine: machine?.code ?? null, rack: rack?.locationId ?? null, outOfServiceDetails: doc.outOfServiceDetails ?? null },
      reason: [remarks, overrideReason && `Override: ${overrideReason}`].filter(Boolean).join(" | ")
    }, session);
    return doc._id;
  });
  await respondWithMould(res, id, 200, { warnings });
}

// POST /api/moulds/:id/status
export async function changeStatus(req, res) {
  const { status, remarks, version } = req.body;
  const id = await withTransaction(async (session) => {
    const doc = await loadForUpdate(req.params.id, session, version);
    const before = doc.toObject();
    const plan = planStatus({ mould: before, user: req.user, status, remarks });
    Object.assign(doc, plan.set, { remarks });
    doc.version += 1;
    await doc.save({ session });
    await Movement.create([plan.movement], { session });
    await audit(req, { action: "mould.status_changed", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId,
      before: { status: before.status, totalShots: before.totalShots }, after: { status: doc.status, totalShots: doc.totalShots }, reason: remarks }, session);
    return doc._id;
  });
  await respondWithMould(res, id);
}

// POST /api/moulds/:id/shots
export async function recordShots(req, res) {
  const { shots, version } = req.body;
  const id = await withTransaction(async (session) => {
    const doc = await loadForUpdate(req.params.id, session, version);
    const before = doc.toObject();
    const plan = planShots({ mould: before, user: req.user, shots });
    Object.assign(doc, plan.set, plan.statusSet || {});
    doc.version += 1;
    await doc.save({ session });
    if (plan.movement) await Movement.create([plan.movement], { session });
    await audit(req, { action: "mould.shots_recorded", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId,
      before: { totalShots: before.totalShots, status: before.status }, after: { totalShots: doc.totalShots, status: doc.status, added: shots } }, session);
    return doc._id;
  });
  await respondWithMould(res, id);
}

// DELETE /api/moulds/:id - soft delete; history and items stay.
export async function deleteMould(req, res) {
  const { reason } = req.body ?? {};
  await withTransaction(async (session) => {
    const doc = await loadForUpdate(req.params.id, session);
    if (doc.deletedAt) fail(409, "MOULD_DELETED", `${doc.toolId} is already deleted`);
    if (doc.location === "MACHINE") fail(409, "UNMOUNT_FIRST", `Take ${doc.toolId} off the machine before deleting it`);
    doc.deletedAt = new Date();
    doc.deletedBy = req.user._id;
    doc.version += 1;
    await doc.save({ session });
    await Movement.create([{ mouldId: doc._id, toolId: doc.toolId, type: "DELETED", fromLocation: doc.location, fromStatus: doc.status, remarks: reason || "", performedBy: req.user._id }], { session });
    await audit(req, { action: "mould.deleted", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId, reason }, session);
  });
  res.json({ success: true });
}

export async function restoreMould(req, res) {
  const id = await withTransaction(async (session) => {
    const doc = await loadForUpdate(req.params.id, session);
    if (!doc.deletedAt) fail(400, "NO_CHANGE", `${doc.toolId} is not deleted`);
    await assertToolIdFree(doc.toolId, doc._id, session);
    doc.deletedAt = null;
    doc.deletedBy = null;
    doc.version += 1;
    await doc.save({ session });
    await Movement.create([{ mouldId: doc._id, toolId: doc.toolId, type: "RESTORED", toLocation: doc.location, toStatus: doc.status, performedBy: req.user._id }], { session });
    await audit(req, { action: "mould.restored", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId }, session);
    return doc._id;
  });
  await respondWithMould(res, id);
}

// ---- Items ----
async function itemChange(req, mouldId, label, work) {
  return withTransaction(async (session) => {
    const mould = await loadForUpdate(mouldId, session);
    if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
    const result = await work(mould, session);
    mould.version += 1;
    await mould.save({ session });
    await Movement.create([{ mouldId: mould._id, toolId: mould.toolId, type: "EDITED", fromLocation: mould.location, toLocation: mould.location,
      fromStatus: mould.status, toStatus: mould.status, remarks: label(result), performedBy: req.user._id }], { session });
    return mould._id;
  });
}

export async function addItem(req, res) {
  const id = await itemChange(req, req.params.id, (it) => `Item ${it.itemId} added`, async (mould, session) => {
    const count = await Item.countDocuments({ mouldId: mould._id }).session(session);
    const [item] = await Item.create([{ sortOrder: count, ...req.body, mouldId: mould._id }], { session });
    await audit(req, { action: "item.created", entityType: "Item", entityId: item._id, entityLabel: `${mould.toolId} / ${item.itemId}`, after: req.body }, session);
    return item;
  });
  await respondWithMould(res, id, 201);
}

export async function updateItem(req, res) {
  const { photo, ...fields } = req.body;
  let rendered;
  if (photo !== undefined) {
    try { [rendered] = await photosFromDataUrls([photo], "items"); }
    catch (e) { fail(400, "INVALID_PHOTO", e.message); }
  }
  const id = await itemChange(req, req.params.id, (r) => `Item ${r.itemId} changed: ${r.fields.join(", ")}`, async (mould, session) => {
    const item = await Item.findOne({ _id: req.params.itemId, mouldId: mould._id, deletedAt: null }).session(session);
    if (!item) fail(404, "NOT_FOUND", "Item not found");
    const before = item.toObject();
    Object.assign(item, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
    if (rendered) item.images = [saveRendered(rendered), ...item.images.slice(1)];
    const diff = changes(before, item.toObject(), [...ITEM_FIELDS, "images"]);
    if (!diff.fields.length) fail(400, "NO_CHANGE", "Nothing changed");
    await item.save({ session });
    await audit(req, { action: "item.updated", entityType: "Item", entityId: item._id, entityLabel: `${mould.toolId} / ${item.itemId}`, before: diff.before, after: diff.after }, session);
    return { itemId: item.itemId, fields: diff.fields };
  });
  await respondWithMould(res, id);
}

export async function deleteItem(req, res) {
  const id = await itemChange(req, req.params.id, (it) => `Item ${it.itemId} removed`, async (mould, session) => {
    const item = await Item.findOne({ _id: req.params.itemId, mouldId: mould._id, deletedAt: null }).session(session);
    if (!item) fail(404, "NOT_FOUND", "Item not found");
    item.deletedAt = new Date();
    await item.save({ session });
    await audit(req, { action: "item.deleted", entityType: "Item", entityId: item._id, entityLabel: `${mould.toolId} / ${item.itemId}`, reason: req.body?.reason || "" }, session);
    return item;
  });
  await respondWithMould(res, id);
}
