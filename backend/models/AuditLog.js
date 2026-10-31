import mongoose from "mongoose";
import { immutable } from "../lib/immutable.js";

// Append-only record of every change: who, what, before and after.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = system / script
    actorName: { type: String, default: "system" },
    action: { type: String, required: true, maxlength: 100 }, // e.g. "mould.moved", "rack.renamed"
    entityType: { type: String, required: true, maxlength: 50 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityLabel: { type: String, default: "" }, // tool ID or rack location ID at the time
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: "", maxlength: 1000 },
    ip: { type: String, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.plugin(immutable, { name: "AuditLog" });

export default mongoose.model("AuditLog", auditLogSchema);
