import Zone from "../models/Zone.js";
import Rack, { rackLocationId } from "../models/Rack.js";
import Mould from "../models/Mould.js";
import { withTransaction } from "../config/db.js";
import { fail } from "../utils/ApiError.js";
import { rackRef } from "../utils/serializers.js";
import { audit, changes } from "../lib/audit.js";
import { occupiedRacks, planBulkRacks } from "../lib/racks.js";

const live = { deletedAt: null };
const RACK_SORT = { zone: 1, row: 1, number: 1 };

const zoneDTO = (z) => ({ id: String(z._id), code: z.code, name: z.name, active: z.active, sortOrder: z.sortOrder });
const rackDTO = (r, moulds = []) => ({ ...rackRef(r), capacity: r.capacity ?? null, active: r.active, note: r.note || "", occupancy: moulds.length, moulds });
const mouldChip = (m) => ({ id: String(m._id), toolId: m.toolId, status: m.status, owner: m.owner ?? null });

async function occupancyMap(rackIds, session) {
  const rows = await Mould.aggregate([{ $match: { ...live, rackId: { $in: rackIds } } }, { $group: { _id: "$rackId", n: { $sum: 1 } } }]).session(session ?? null);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function activeZone(code, session) {
  const zone = await Zone.findOne({ code, ...live }).session(session);
  if (!zone) fail(404, "NOT_FOUND", `Zone ${code} not found`);
  return zone;
}

// GET /api/racks?zone=FLK - zones -> racks with the moulds on each, plus moulds still waiting for a rack.
export async function listRacks(req, res) {
  const zoneFilter = req.query.zone ? { code: String(req.query.zone).toUpperCase() } : {};
  const zones = await Zone.find({ ...live, ...zoneFilter }).sort({ sortOrder: 1, code: 1 }).lean();
  const racks = await Rack.find({ ...live, zone: { $in: zones.map((z) => z.code) } }).sort(RACK_SORT).lean();
  const moulds = await Mould.find({ ...live, location: "MOULD_ROOM" }, { toolId: 1, status: 1, owner: 1, rackId: 1, awaitingRack: 1 }).sort({ toolId: 1 }).collation({ locale: "en", numericOrdering: true }).lean();
  const onRack = new Map();
  for (const m of moulds) if (m.rackId) onRack.set(String(m.rackId), [...(onRack.get(String(m.rackId)) || []), mouldChip(m)]);
  res.json({
    success: true,
    zones: zones.map((z) => ({ ...zoneDTO(z), racks: racks.filter((r) => r.zone === z.code).map((r) => rackDTO(r, onRack.get(String(r._id)) || [])) })),
    awaitingRack: moulds.filter((m) => m.awaitingRack).map(mouldChip)
  });
}

export async function getRack(req, res) {
  const rack = await Rack.findById(req.params.id).lean();
  if (!rack || rack.deletedAt) fail(404, "NOT_FOUND", "Rack not found");
  const moulds = await Mould.find({ ...live, rackId: rack._id }).sort({ toolId: 1 }).lean();
  res.json({ success: true, rack: rackDTO(rack, moulds.map(mouldChip)) });
}

// ---- Zones (Super Admin) ----
export async function createZone(req, res) {
  const { code, name, sortOrder } = req.body;
  const zone = await withTransaction(async (session) => {
    let z = await Zone.findOne({ code }).session(session);
    if (z && !z.deletedAt) fail(409, "DUPLICATE", `Zone ${code} already exists`);
    if (z) Object.assign(z, { name, sortOrder, active: true, deletedAt: null });
    else z = new Zone({ code, name, sortOrder });
    await z.save({ session });
    await audit(req, { action: "zone.created", entityType: "Zone", entityId: z._id, entityLabel: code, after: { code, name } }, session);
    return z;
  });
  res.status(201).json({ success: true, zone: zoneDTO(zone) });
}

// Renaming a zone code moves its racks (FLK-A3 -> NEW-A3) and the owner of its moulds with it.
export async function updateZone(req, res) {
  const zone = await withTransaction(async (session) => {
    const z = await Zone.findById(req.params.id).session(session);
    if (!z || z.deletedAt) fail(404, "NOT_FOUND", "Zone not found");
    const before = z.toObject();
    const { code, ...rest } = req.body;
    if (code && code !== z.code) {
      if (await Zone.exists({ code }).session(session)) fail(409, "DUPLICATE", `Zone ${code} already exists`);
      const racks = await Rack.find({ zone: z.code }).session(session);
      for (const r of racks) {
        r.zone = code;
        r.locationId = rackLocationId(code, r.code);
        await r.save({ session });
      }
      await Mould.updateMany({ owner: z.code }, { $set: { owner: code } }, { session });
      z.code = code;
    }
    Object.assign(z, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    const diff = changes(before, z.toObject(), ["code", "name", "active", "sortOrder"]);
    if (!diff.fields.length) fail(400, "NO_CHANGE", "Nothing changed");
    await z.save({ session });
    await audit(req, { action: "zone.updated", entityType: "Zone", entityId: z._id, entityLabel: z.code, before: diff.before, after: diff.after }, session);
    return z;
  });
  res.json({ success: true, zone: zoneDTO(zone) });
}

export async function deleteZone(req, res) {
  await withTransaction(async (session) => {
    const z = await Zone.findById(req.params.id).session(session);
    if (!z || z.deletedAt) fail(404, "NOT_FOUND", "Zone not found");
    const racks = await Rack.find({ ...live, zone: z.code }).session(session).lean();
    const busy = occupiedRacks(racks, await occupancyMap(racks.map((r) => r._id), session));
    if (busy.length) fail(409, "RACK_OCCUPIED", `Move the moulds off ${busy.join(", ")} first`, { racks: busy });
    const now = new Date();
    await Rack.updateMany({ _id: { $in: racks.map((r) => r._id) } }, { $set: { deletedAt: now, active: false } }, { session });
    Object.assign(z, { deletedAt: now, active: false });
    await z.save({ session });
    await audit(req, { action: "zone.deleted", entityType: "Zone", entityId: z._id, entityLabel: z.code, after: { racksRemoved: racks.length } }, session);
  });
  res.json({ success: true });
}

// ---- Racks (Super Admin) ----
export async function createRack(req, res) {
  const { zone, row, number, capacity, note } = req.body;
  const rack = await withTransaction(async (session) => {
    await activeZone(zone, session);
    const code = `${row}${number}`;
    let r = await Rack.findOne({ locationId: rackLocationId(zone, code) }).session(session);
    if (r && !r.deletedAt) fail(409, "DUPLICATE", `Rack ${r.locationId} already exists`);
    if (r) Object.assign(r, { capacity, note, active: true, deletedAt: null });
    else r = new Rack({ zone, row, number, code, capacity, note });
    await r.save({ session });
    await audit(req, { action: "rack.created", entityType: "Rack", entityId: r._id, entityLabel: r.locationId, after: { capacity, note } }, session);
    return r;
  });
  res.status(201).json({ success: true, rack: rackDTO(rack) });
}

// Moulds point at the rack by id, so a rename moves them along; history keeps the old code as text.
export async function updateRack(req, res) {
  const rack = await withTransaction(async (session) => {
    const r = await Rack.findById(req.params.id).session(session);
    if (!r || r.deletedAt) fail(404, "NOT_FOUND", "Rack not found");
    const before = r.toObject();
    Object.assign(r, Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined)));
    r.code = `${r.row}${r.number}`;
    const locationId = rackLocationId(r.zone, r.code);
    if (locationId !== before.locationId && (await Rack.exists({ locationId, _id: { $ne: r._id } }).session(session))) {
      fail(409, "DUPLICATE", `Rack ${locationId} already exists`);
    }
    r.locationId = locationId;
    const diff = changes(before, r.toObject(), ["locationId", "capacity", "active", "note"]);
    if (!diff.fields.length) fail(400, "NO_CHANGE", "Nothing changed");
    await r.save({ session });
    await audit(req, { action: before.locationId !== r.locationId ? "rack.renamed" : "rack.updated", entityType: "Rack", entityId: r._id, entityLabel: r.locationId, before: diff.before, after: diff.after }, session);
    return r;
  });
  const moulds = await Mould.find({ ...live, rackId: rack._id }).lean();
  res.json({ success: true, rack: rackDTO(rack, moulds.map(mouldChip)) });
}

export async function deleteRack(req, res) {
  await withTransaction(async (session) => {
    const r = await Rack.findById(req.params.id).session(session);
    if (!r || r.deletedAt) fail(404, "NOT_FOUND", "Rack not found");
    if (await Mould.exists({ ...live, rackId: r._id }).session(session)) fail(409, "RACK_OCCUPIED", `Rack ${r.locationId} still holds moulds; move them or disable the rack`);
    Object.assign(r, { deletedAt: new Date(), active: false });
    await r.save({ session });
    await audit(req, { action: "rack.deleted", entityType: "Rack", entityId: r._id, entityLabel: r.locationId }, session);
  });
  res.json({ success: true });
}

// POST /api/racks/bulk - preview (default) or create racks for zone + rows + number range.
export async function bulkRacks(req, res) {
  const { preview, capacity, ...request } = req.body;
  let plan;
  try {
    plan = planBulkRacks([], request); // validates the range before any database work
  } catch (e) {
    fail(400, "INVALID_RANGE", e.message);
  }
  const result = await withTransaction(async (session) => {
    await activeZone(request.zone, session);
    const existing = await Rack.find({ zone: request.zone }).session(session).lean();
    plan = planBulkRacks(existing, request);
    if (preview) return plan;
    if (plan.create.length) await Rack.create(plan.create.map((r) => ({ ...r, capacity })), { session, ordered: true });
    for (const r of plan.revive) await Rack.updateOne({ _id: r._id }, { $set: { deletedAt: null, active: true, capacity } }, { session });
    await audit(req, { action: "rack.bulk_generated", entityType: "Rack", entityLabel: request.zone,
      after: { ...request, capacity, created: plan.create.map((r) => r.locationId), revived: plan.revive.map((r) => r.locationId) } }, session);
    return plan;
  });
  const ids = (list) => list.map((r) => r.locationId);
  res.status(preview ? 200 : 201).json({ success: true, preview, create: ids(result.create), revive: ids(result.revive), existing: ids(result.existing) });
}

// POST /api/racks/remove-row - soft-delete a whole row when it is empty.
export async function removeRow(req, res) {
  const { zone, row } = req.body;
  const removed = await withTransaction(async (session) => {
    await activeZone(zone, session);
    const racks = await Rack.find({ ...live, zone, row }).session(session).lean();
    if (!racks.length) fail(404, "NOT_FOUND", `Zone ${zone} has no row ${row}`);
    const busy = occupiedRacks(racks, await occupancyMap(racks.map((r) => r._id), session));
    if (busy.length) fail(409, "RACK_OCCUPIED", `Move the moulds off ${busy.join(", ")} first`, { racks: busy });
    await Rack.updateMany({ _id: { $in: racks.map((r) => r._id) } }, { $set: { deletedAt: new Date(), active: false } }, { session });
    await audit(req, { action: "rack.row_removed", entityType: "Rack", entityLabel: `${zone}-${row}`, after: { racks: racks.map((r) => r.locationId) } }, session);
    return racks.map((r) => r.locationId);
  });
  res.json({ success: true, removed });
}
