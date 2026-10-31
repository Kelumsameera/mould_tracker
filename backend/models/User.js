import mongoose from "mongoose";
import { CUSTOM_PERMISSIONS, LEGACY_ROLE_ALIASES, ROLES } from "../lib/permissions.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Legacy roles stay valid only so old documents load until the upgrade migration rewrites them.
    role: { type: String, enum: [...ROLES, ...Object.keys(LEGACY_ROLE_ALIASES)], default: "mould_technician" },
    permissionOverrides: { type: [{ type: String, enum: CUSTOM_PERMISSIONS }], default: null },
    language: { type: String, enum: ["en", "si"], default: "en" },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
