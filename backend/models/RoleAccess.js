import mongoose from "mongoose";
import { CUSTOM_PERMISSIONS, ROLES } from "../lib/permissions.js";

const schema = new mongoose.Schema({
  role: { type: String, enum: ROLES.filter(role => role !== "system_admin"), required: true, unique: true },
  permissions: { type: [{ type: String, enum: CUSTOM_PERMISSIONS }], required: true }
}, { timestamps: true });

export default mongoose.model("RoleAccess", schema);
