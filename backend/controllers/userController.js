import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";
import { CUSTOM_PERMISSIONS, ROLES, ASSIGNABLE_ROLES, resolveRole, can, canManageUser, canViewUser, roleDefaults, rolePermissionsFor, effectivePermissions, normalizeOverrides, overridesActive, upgradePermissions, visibleUsersFilter } from "../lib/permissions.js";
import { audit, changes } from "../lib/audit.js";
import RoleAccess from "../models/RoleAccess.js";
import { invalidateRoleAccess, loadRoleAccess, roleMatrix } from "../lib/roleAccess.js";

export async function listUsers(req, res) {
  const users = await User.find({ deletedAt: null, ...visibleUsersFilter(req.user) }).sort({ name: 1 });
  res.json({ success: true, users: await Promise.all(users.map(async user => userDTO(await loadRoleAccess(user)))) });
}

export async function createUser(req, res) {
  const { name, email, password, role } = req.body;
  if (!canManageUser(req.user, { role }, role)) throw new ApiError(403, "You cannot assign that role");
  const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
  await audit(req, { action: "user.created", entityType: "User", entityId: user._id, entityLabel: user.email, after: { name, email: user.email, role } });
  res.status(201).json({ success: true, user: canViewUser(req.user, user) ? userDTO(await loadRoleAccess(user)) : null });
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt || !canViewUser(req.user, user)) throw new ApiError(404, "User not found");
  if (!canManageUser(req.user, user, req.body.role ?? user.role)) {
    throw new ApiError(403, "You cannot change this account or assign that role");
  }

  const isSelf = user._id.equals(req.user._id);
  if (isSelf && (req.body.active === false || (req.body.role && req.body.role !== user.role))) {
    throw new ApiError(400, "You cannot disable your own account or change your own role");
  }

  if ((req.body.role !== undefined && req.body.role !== user.role) || req.body.active === false) await assertNotLastSystemAdmin(user);
  const before = user.toObject();
  const { name, email, role, active, password } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = active;
  if (password) user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();
  const diff = changes(before, user.toObject(), ["name", "email", "role", "active"]);
  if (password) diff.after.password = "changed"; // never the password itself
  await audit(req, { action: diff.fields.includes("role") ? "user.role.changed" : "user.updated", entityType: "User", entityId: user._id, entityLabel: user.email, before: diff.before, after: diff.after });

  res.json({ success: true, user: canViewUser(req.user, user) ? userDTO(await loadRoleAccess(user)) : null });
}

// DELETE /api/users/:id - soft delete: the account can no longer sign in, its history stays.
export async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt || !canViewUser(req.user, user)) throw new ApiError(404, "User not found");
  if (user._id.equals(req.user._id)) throw new ApiError(400, "You cannot delete your own account");
  if (!canManageUser(req.user, user)) throw new ApiError(403, "You cannot delete this account");
  await assertNotLastSystemAdmin(user);
  user.deletedAt = new Date();
  user.active = false;
  await user.save();
  await audit(req, { action: "user.deleted", entityType: "User", entityId: user._id, entityLabel: user.email, reason: req.body?.reason || "" });
  res.json({ success: true });
}


// There must always be at least one active System Administrator.
export async function assertNotLastSystemAdmin(target) {
  if (target?.role !== "system_admin") return;
  const others = await User.countDocuments({ role: "system_admin", active: true, deletedAt: null, _id: { $ne: target._id } });
  if (!others) throw new ApiError(409, "The last System Administrator cannot be removed, disabled or demoted", { code: "LAST_SYSTEM_ADMIN" });
}

const overridesDTO = (user) => {
  const o = normalizeOverrides(user.permissionOverrides, rolePermissionsFor(user));
  return o ? { grant: o.grant, deny: o.deny, expiresAt: o.expiresAt, reason: o.reason, active: overridesActive(o) } : null;
};

const accessDTO = (user) => ({
  ...userDTO(user),
  permissionOverrides: overridesDTO(user),
  rolePermissions: rolePermissionsFor(user),
  effectivePermissions: effectivePermissions(user)
});

async function rolesDTO() {
  const matrix = await roleMatrix();
  return ROLES.filter((role) => role !== "system_admin").map((role) => {
    const row = matrix.get(role);
    const saved = row ? upgradePermissions(row.permissions) : null;
    return { role, customised: Boolean(row), version: row?.version ?? 0, defaults: roleDefaults(role).filter((p) => p !== "access.manage"),
      permissions: rolePermissionsFor({ role, rolePermissionOverrides: saved }) };
  });
}

// GET /api/users/access - matrix + every non-protected user's overrides (System Administrator only).
export async function listUserAccess(req, res) {
  if (!can(req.user, "access.manage")) throw new ApiError(403, "You cannot manage user access");
  const users = await User.find({ deletedAt: null, role: { $ne: "system_admin" } }).sort({ name: 1 });
  for (const user of users) await loadRoleAccess(user);
  res.json({ success: true, permissions: CUSTOM_PERMISSIONS, assignableRoles: ASSIGNABLE_ROLES, roles: await rolesDTO(), users: users.map(accessDTO) });
}

// PATCH /api/users/roles/:role/access  { permissions: [...] | null (reset to defaults), version?, reason }
export async function updateRoleAccess(req, res) {
  if (!can(req.user, "access.manage")) throw new ApiError(403, "You cannot manage role access");
  const { role } = req.params;
  if (!ROLES.includes(role) || role === "system_admin") throw new ApiError(400, "This role cannot be configured", { code: "ROLE_LOCKED" });
  const { permissions, version, reason } = req.body;
  if (permissions?.includes("move.outOfService") && role !== "super_admin") throw new ApiError(400, "Out of Service access is reserved for Super Admins", { code: "SUPER_ADMIN_ONLY" });
  const previous = await RoleAccess.findOne({ role });
  if (version !== undefined && version !== (previous?.version ?? 0)) throw new ApiError(409, "Someone else changed this role meanwhile", { code: "STALE_ACCESS" });
  const before = previous ? upgradePermissions(previous.permissions) : roleDefaults(role);
  if (permissions === null) await RoleAccess.deleteOne({ role });
  else await RoleAccess.findOneAndUpdate({ role }, { $set: { permissions }, $inc: { version: 1 } }, { upsert: true, runValidators: true });
  invalidateRoleAccess();
  await audit(req, { action: permissions === null ? "role.access.reset" : "role.access.updated", entityType: "RoleAccess", entityLabel: role,
    before: { permissions: before }, after: { permissions: permissions ?? roleDefaults(role) }, reason });
  res.json({ success: true, role: (await rolesDTO()).find((r) => r.role === role) });
}

// PATCH /api/users/:id/access  { grant, deny, expiresAt?, reason }  (empty grant + deny = reset to role defaults)
export async function updateUserAccess(req, res) {
  if (!can(req.user, "access.manage")) throw new ApiError(403, "You cannot manage user access");
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt || !canViewUser(req.user, user)) throw new ApiError(404, "User not found");
  if (user.role === "system_admin") throw new ApiError(403, "System Administrator access is always everything", { code: "ROLE_LOCKED" });
  const grant = req.body.grant ?? [], deny = req.body.deny ?? [];
  const known = (list) => Array.isArray(list) && list.every((p) => CUSTOM_PERMISSIONS.includes(p)) && new Set(list).size === list.length;
  if (!known(grant) || !known(deny) || grant.some((p) => deny.includes(p))) throw new ApiError(400, "Invalid permissions", { code: "INVALID_PERMISSIONS" });
  if (grant.includes("move.outOfService") && resolveRole(user.role) !== "super_admin") throw new ApiError(400, "Out of Service access is reserved for Super Admins", { code: "SUPER_ADMIN_ONLY" });
  const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  if (expiresAt && expiresAt <= new Date()) throw new ApiError(400, "The expiry must be in the future", { code: "INVALID_EXPIRY" });

  await loadRoleAccess(user);
  const before = overridesDTO(user);
  const beforeEffective = effectivePermissions(user);
  const reset = !grant.length && !deny.length;
  user.permissionOverrides = reset ? null : { grant, deny, expiresAt, reason: req.body.reason, updatedAt: new Date(), updatedBy: req.user._id };
  user.markModified("permissionOverrides");
  await user.save();
  await audit(req, { action: reset ? "user.access.reset" : "user.access.updated", entityType: "User", entityId: user._id, entityLabel: user.email,
    before: { overrides: before, effective: beforeEffective }, after: { overrides: overridesDTO(user), effective: effectivePermissions(user) }, reason: req.body.reason });
  res.json({ success: true, user: accessDTO(user) });
}

