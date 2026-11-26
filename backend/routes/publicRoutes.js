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
