import AuditLog from "../models/AuditLog.js";
import { auditDTO } from "../utils/serializers.js";

// Audit log sections (?category=...). "access" = the Access changes section.
export const AUDIT_CATEGORIES = {
  access: ["role.access.updated", "role.access.reset", "user.access.updated", "user.access.reset", "user.role.changed", "user.created", "user.deleted"],
  edits: ["mould.updated", "mould.created", "mould.deleted", "mould.restored", "item.created", "item.updated", "item.deleted"],
  images: ["item.image.added", "item.image.replaced", "item.image.removed", "item.image.reordered", "item.images_imported"],
  cavities: ["mould.cavities.blocked", "mould.cavities.changed", "mould.cavities.restored"]
};

// GET /api/audit - newest first, filterable, paged.
export async function listAudit(req, res) {
  const { entityType, entityId, action, actorId, category, from, to, page, limit } = req.validQuery;
  const hidden = req.accountPrivacy.ids;
  const filter = { $and: [
    { actorId: { $nin: hidden } },
    { $or: [{ entityType: { $ne: "User" } }, { entityId: { $nin: hidden } }] },
    { $or: [
      { "before.role": { $ne: "system_admin" }, "after.role": { $ne: "system_admin" } },
      { entityType: "User", entityId: req.user._id }
    ] }
  ] };
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (action) filter.action = action;
  if (category) filter.$and.push({ action: { $in: AUDIT_CATEGORIES[category] } });
  if (actorId) filter.actorId = actorId;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const [total, entries] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  res.json({ success: true, total, page, limit, entries: entries.map(auditDTO) });
}
