import mongoose from "mongoose";
import { ROLES } from "../lib/permissions.js";

// Saved role -> permission matrix row. No row = role defaults. `version` counts saves (stale-edit check).
// Permission names are not enum-checked here so rows saved under older names still load (see upgradePermissions).
const schema = new mongoose.Schema({
  role: { type: String, enum: ROLES.filter(role => role !== "system_admin"), required: true, unique: true },
  permissions: { type: [String], required: true },
  version: { type: Number, default: 1 }
}, { timestamps: true });

export default mongoose.model("RoleAccess", schema);
