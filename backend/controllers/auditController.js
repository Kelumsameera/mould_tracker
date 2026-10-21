import AuditLog from "../models/AuditLog.js";
import { auditDTO } from "../utils/serializers.js";

// GET /api/audit - newest first, filterable, paged.
export async function listAudit(req, res) {
  const { entityType, entityId, action, actorId, from, to, page, limit } = req.validQuery;
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (action) filter.action = action;
  if (actorId) filter.actorId = actorId;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const [total, entries] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  res.json({ success: true, total, page, limit, entries: entries.map(auditDTO) });
}
