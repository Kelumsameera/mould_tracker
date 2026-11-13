// Makes sure a System Administrator exists.
//   SEED_SYSADMIN_EMAIL=<email> [SEED_SYSADMIN_PASSWORD=<temporary password>] node scripts/seed-sysadmin.mjs [--apply]
// - account with that email exists -> promoted to system_admin (nothing else changes)
// - no account -> created from SEED_SYSADMIN_PASSWORD; it must change the password at first sign-in
// Without the env var it prints what to do and changes nothing. Without --apply it is a dry run.
// Never prints or logs the password.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

export function planSysadminSeed({ email, password, existing }) {
  if (!email) return { action: "none", message: "Set SEED_SYSADMIN_EMAIL (and SEED_SYSADMIN_PASSWORD if the account does not exist yet), then run again. Nothing was changed." };
  if (existing) {
    if (existing.role === "system_admin") return { action: "none", message: "That account is already a System Administrator. Nothing was changed." };
    return { action: "promote", message: `Promote the existing account (role ${existing.role}) to System Administrator.` };
  }
  if (!password || password.length < 8) return { action: "none", message: "No account uses SEED_SYSADMIN_EMAIL. Set SEED_SYSADMIN_PASSWORD (8+ characters) to create it. Nothing was changed." };
  return { action: "create", message: "Create a System Administrator account that must change its password at first sign-in." };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const email = String(process.env.SEED_SYSADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_SYSADMIN_PASSWORD || "";
  if (!email) { console.log(planSysadminSeed({}).message); return; }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const existing = await User.findOne({ email, deletedAt: null });
    const plan = planSysadminSeed({ email, password, existing });
    console.log(`${apply ? "" : "[dry run] "}${plan.message}`);
    if (!apply || plan.action === "none") return;
    let user;
    if (plan.action === "promote") {
      const before = existing.role;
      existing.role = "system_admin";
      existing.permissionOverrides = null;
      user = await existing.save();
      await AuditLog.create({ actorId: user._id, actorName: "seed-sysadmin script", action: "user.role.changed", entityType: "User", entityId: user._id, entityLabel: user.email, before: { role: before }, after: { role: "system_admin" }, reason: "SEED_SYSADMIN_EMAIL" });
    } else {
      user = await User.create({ name: "System Administrator", email, role: "system_admin", mustChangePassword: true, passwordHash: await bcrypt.hash(password, 12) });
      await AuditLog.create({ actorId: user._id, actorName: "seed-sysadmin script", action: "user.created", entityType: "User", entityId: user._id, entityLabel: user.email, after: { role: "system_admin" }, reason: "SEED_SYSADMIN_EMAIL" });
    }
    console.log("Done.");
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("System Administrator seed failed (check MONGODB_URI). No password was printed."); process.exitCode = 1; });
}
