import { Router } from "express";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { validate } from "../middleware/validate.js";
import { publicMouldsQuery } from "../validators/schemas.js";
import Mould from "../models/Mould.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import Item from "../models/Item.js";
import path from "node:path";
import mongoose from "mongoose";
import { UPLOAD_DIR } from "../lib/uploads.js";
import { searchMoulds } from "../lib/mouldSearch.js";
import { getConfig } from "../lib/configStore.js";
import { setting } from "../lib/settings.js";
import { displayStatus, toolTypeFilter } from "../lib/mouldState.js";
import { rackOverview } from "../controllers/rackController.js";

const router = Router();
// A deliberately small public projection. No history, people, notes or write routes.
router.get("/moulds", validate(publicMouldsQuery, "query"), asyncHandler(async (req, res) => {
  const base = { deletedAt: null, ...toolTypeFilter(req.validQuery.toolType) };
  const filter = { ...base };
  if (req.validQuery.location) filter.location = req.validQuery.location;
  const size = setting("limits.pageSize");
  if (req.validQuery.q) {
    const search = await searchMoulds(req.validQuery.q, filter, { suggest: false });
    filter._id = { $in: search.ranked.map(row => row.id) };
  }
  const moulds = await Mould.find(filter, { toolId: 1, location: 1, status: 1, machineId: 1, rackId: 1 })
    .sort({ toolId: 1 }).skip((req.validQuery.page - 1) * size).limit(size + 1).lean();
  const hasMore = moulds.length > size;
  moulds.splice(size);
  const [machines, racks, counts, total, pictured] = await Promise.all([
    Machine.find({ _id: { $in: moulds.map(m => m.machineId).filter(Boolean) } }, { code: 1 }).lean(),
    Rack.find({ _id: { $in: moulds.map(m => m.rackId).filter(Boolean) } }, { locationId: 1 }).lean(),
    Mould.aggregate([{ $match: base }, { $group: { _id: "$location", count: { $sum: 1 } } }]),
    Mould.countDocuments(filter),
    Item.distinct("mouldId", { mouldId: { $in: moulds.map(m => m._id) }, deletedAt: null, "images.0": { $exists: true } })
  ]);
  const hasPicture = new Set(pictured.map(String));
  const config = getConfig();
  res.set("Cache-Control", "no-store");
  res.json({ success: true, hasMore, total, refreshSeconds: setting("ui.refreshSeconds"),
    locations: config.locations.filter(l => l.active !== false && (!req.validQuery.toolType || !l.toolTypes?.length || l.toolTypes.includes(req.validQuery.toolType))).map(l => ({ key: l.key, labels: l.labels, icon: l.icon, count: counts.find(c => c._id === l.key)?.count ?? 0 })),
    moulds: moulds.map(m => ({
    id: String(m._id), toolId: m.toolId,
    location: config.locations.find(l => l.key === m.location)?.labels ?? { en: m.location, si: m.location },
    locationKey: m.location,
    status: displayStatus(m.status),
    statusLabels: config.statuses.find(s => s.key === displayStatus(m.status))?.labels ?? { en: m.status, si: m.status },
    machine: machines.find(x => String(x._id) === String(m.machineId))?.code ?? null,
    rack: racks.find(x => String(x._id) === String(m.rackId))?.locationId ?? null,
    hasImage: hasPicture.has(String(m._id))
  })) });
}));

// Read-only rack view. Rack notes are left out and pictures go through the public image route.
router.get("/racks", asyncHandler(async (req, res) => {
  const { zones, awaitingRack } = await rackOverview();
  const chip = ({ id, toolId, status, size, capableMachines, items }) => ({ id, toolId, status: displayStatus(status), size, capableMachines,
    items: items.map(({ itemId, description, cavities, thumbUrl }) => ({ itemId, description, cavities, thumbUrl: thumbUrl ? `/public/moulds/${id}/image` : null })) });
  res.set("Cache-Control", "no-store");
  res.json({ success: true, refreshSeconds: setting("ui.refreshSeconds"),
    zones: zones.filter(z => z.active !== false).map(({ racks, ...z }) => ({ ...z, racks: racks.map(({ note, moulds, ...r }) => ({ ...r, note: "", moulds: moulds.map(chip) })) })),
    awaitingRack: awaitingRack.map(({ id, toolId }) => ({ id, toolId })) });
}));

// One mould with its items and machine. Still public-safe: no notes, remarks, people, problems or history.
router.get("/moulds/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Not found" });
  const m = await Mould.findOne({ _id: req.params.id, deletedAt: null }, { toolId: 1, toolType: 1, toolSetCount: 1, size: 1, owner: 1, capableMachines: 1, location: 1, status: 1, machineId: 1, rackId: 1, blockedCavities: 1, lastMovedAt: 1 }).lean();
  if (!m) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Not found" });
  const codes = [...new Set(m.capableMachines || [])];
  const [items, machine, rack, capable] = await Promise.all([
    Item.find({ mouldId: m._id, deletedAt: null }, { itemId: 1, description: 1, cavities: 1, materialId: 1, materialDescription: 1, masterbatchId: 1, masterbatchDescription: 1, "images.0": 1 }).sort({ sortOrder: 1 }).lean(),
    m.machineId ? Machine.findById(m.machineId, { code: 1, name: 1 }).lean() : null,
    m.rackId ? Rack.findById(m.rackId, { locationId: 1 }).lean() : null,
    codes.length ? Machine.find({ code: { $in: codes } }, { code: 1, name: 1 }).lean() : []
  ]);
  const config = getConfig();
  const status = displayStatus(m.status);
  res.set("Cache-Control", "no-store");
  res.json({ success: true, mould: {
    id: String(m._id), toolId: m.toolId, toolType: m.toolType, toolSet: m.toolSetCount || "", size: m.size || "", owner: m.owner ?? null,
    locationKey: m.location, location: config.locations.find(l => l.key === m.location)?.labels ?? { en: m.location, si: m.location },
    status, statusLabels: config.statuses.find(s => s.key === status)?.labels ?? { en: m.status, si: m.status },
    rack: rack?.locationId ?? null, lastMovedAt: m.lastMovedAt ?? null, hasImage: items.some(i => i.images?.length),
    machine: machine ? { code: machine.code, name: machine.name } : null,
    capableMachines: codes.map(code => ({ code, name: capable.find(x => x.code === code)?.name ?? null })),
    totalCavities: items.reduce((sum, i) => sum + (i.cavities > 0 ? i.cavities : 0), 0),
    blockedCavities: (m.blockedCavities || []).length,
    items: items.map(i => ({ itemId: i.itemId, description: i.description || "", cavities: i.cavities ?? null,
      material: [i.materialId, i.materialDescription].filter(Boolean).join(" – ") || null,
      masterbatch: [i.masterbatchId, i.masterbatchDescription].filter(Boolean).join(" – ") || null }))
  } });
}));

// The first item picture of a mould, without sign-in. Only that one file is reachable; no paths are exposed.
router.get("/moulds/:id/image", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const mould = await Mould.exists({ _id: req.params.id, deletedAt: null });
  if (!mould) return res.status(404).end();
  const item = await Item.findOne({ mouldId: req.params.id, deletedAt: null, "images.0": { $exists: true } }, { images: { $slice: 1 } }).sort({ sortOrder: 1 }).lean();
  const image = item?.images?.[0];
  const file = req.query.size === "full" ? image?.path : (image?.thumbPath || image?.path);
  if (!file) return res.status(404).end();
  res.set("Cache-Control", "public, max-age=300");
  res.set("Cross-Origin-Resource-Policy", "same-site");
  res.sendFile(file, { root: path.resolve(UPLOAD_DIR), dotfiles: "deny" }, err => { if (err && !res.headersSent) res.status(404).end(); });
}));
export default router;
