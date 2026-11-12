// Rewrites stored permission names to the Change Pack 2 keys (e.g. moulds.manage -> mould.create, mould.edit, ...)
// and old per-user overrides (a full permission list) to { grant, deny }. The app already reads old data
// correctly at runtime; this only makes the stored data match. Dry run unless --apply. Idempotent.
//   node scripts/migrate-permissions.mjs [--apply]
import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import RoleAccess from "../models/RoleAccess.js";
import User from "../models/User.js";
import { normalizeOverrides, rolePermissionsFor, upgradePermissions } from "../lib/permissions.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function planRoleRow(row) {
  const next = upgradePermissions(row.permissions);
  return same(next, row.permissions) ? null : { role: row.role, from: row.permissions, to: next };
}

// matrixRow: the user's role row (already migrated) or null.
export function planUserOverrides(user, matrixRow) {
  if (user.permissionOverrides == null) return null;
  const base = rolePermissionsFor({ role: user.role, rolePermissionOverrides: matrixRow ? upgradePermissions(matrixRow.permissions) : null });
  const o = normalizeOverrides(user.permissionOverrides, base);
  const next = o ? { grant: o.grant, deny: o.deny, expiresAt: o.expiresAt, reason: o.reason || "Migrated from the earlier per-user permission list" } : null;
  if (!Array.isArray(user.permissionOverrides) && next && same(next.grant, user.permissionOverrides.grant) && same(next.deny, user.permissionOverrides.deny)) return null;
  return { id: user._id, from: user.permissionOverrides, to: next };
}

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const rows = await RoleAccess.find({}).lean();
    const users = await User.find({ deletedAt: null, permissionOverrides: { $ne: null } }).lean();
    const rolePlans = rows.map(planRoleRow).filter(Boolean);
    const userPlans = users.map((u) => planUserOverrides(u, rows.find((r) => r.role === u.role))).filter(Boolean);
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", database: mongoose.connection.db.databaseName, roleRows: rolePlans.length, users: userPlans.length }, null, 2));
    if (!apply) return;
    for (const p of rolePlans) await RoleAccess.updateOne({ role: p.role }, { $set: { permissions: p.to } });
    for (const p of userPlans) await User.updateOne({ _id: p.id }, { $set: { permissionOverrides: p.to } });
    console.log("Applied.");
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
