import RoleAccess from "../models/RoleAccess.js";
import { resolveRole } from "./permissions.js";

// Reload on each request so saved role changes affect existing sessions immediately.
export async function loadRoleAccess(user) {
  if (!user || resolveRole(user.role) === "system_admin") return user;
  const config = await RoleAccess.findOne({ role: resolveRole(user.role) });
  user.rolePermissionOverrides = config ? [...config.permissions] : null;
  return user;
}
