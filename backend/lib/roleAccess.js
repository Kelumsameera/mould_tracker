import RoleAccess from "../models/RoleAccess.js";
import { isSystemAdmin, resolveRole } from "./permissions.js";

// Role matrix cache: role -> saved permission list (or absent = defaults). Invalidated on every save;
// a short TTL also picks up changes made by another process.
const TTL_MS = 30_000;
let cache = null;
let loadedAt = 0;

export function invalidateRoleAccess() {
  cache = null;
}

export async function roleMatrix() {
  if (!cache || Date.now() - loadedAt > TTL_MS) {
    const rows = await RoleAccess.find({});
    cache = new Map((rows || []).map((r) => [r.role, { permissions: [...r.permissions], version: r.version ?? 1 }]));
    loadedAt = Date.now();
  }
  return cache;
}

// Attaches the role's saved matrix row so can()/permissionsFor() compute EFFECTIVE permissions.
export async function loadRoleAccess(user) {
  if (!user || isSystemAdmin(user)) return user;
  const row = (await roleMatrix()).get(resolveRole(user.role));
  user.rolePermissionOverrides = row ? row.permissions : null;
  return user;
}
