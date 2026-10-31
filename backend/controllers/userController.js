import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";
import { CUSTOM_PERMISSIONS, can, canManageUser, canViewUser, rolePermissionsFor, visibleUsersFilter } from "../lib/permissions.js";
import { audit, changes } from "../lib/audit.js";

export async function listUsers(req, res) {
  const users = await User.find({ deletedAt: null, ...visibleUsersFilter(req.user) }).sort({ name: 1 });
  res.json({ success: true, users: users.map(userDTO) });
}

export async function createUser(req, res) {
  const { name, email, password, role } = req.body;
  if (!canManageUser(req.user, { role }, role)) throw new ApiError(403, "You cannot assign that role");
  const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
  await audit(req, { action: "user.created", entityType: "User", entityId: user._id, entityLabel: user.email, after: { name, email: user.email, role } });
  res.status(201).json({ success: true, user: canViewUser(req.user, user) ? userDTO(user) : null });
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
  await audit(req, { action: "user.updated", entityType: "User", entityId: user._id, entityLabel: user.email, before: diff.before, after: diff.after });

  res.json({ success: true, user: canViewUser(req.user, user) ? userDTO(user) : null });
}

// DELETE /api/users/:id - soft delete: the account can no longer sign in, its history stays.
export async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt || !canViewUser(req.user, user)) throw new ApiError(404, "User not found");
  if (user._id.equals(req.user._id)) throw new ApiError(400, "You cannot delete your own account");
  if (!canManageUser(req.user, user)) throw new ApiError(403, "You cannot delete this account");
  user.deletedAt = new Date();
  user.active = false;
  await user.save();
  await audit(req, { action: "user.deleted", entityType: "User", entityId: user._id, entityLabel: user.email, reason: req.body?.reason || "" });
  res.json({ success: true });
}


const accessDTO = user => ({
  ...userDTO(user),
  permissionOverrides: user.permissionOverrides ?? null,
  rolePermissions: rolePermissionsFor(user)
});

export async function listUserAccess(req, res) {
  if (!can(req.user, "access.manage")) throw new ApiError(403, "You cannot manage user access");
  const users = await User.find({ deletedAt: null, role: { $ne: "system_admin" } }).sort({ name: 1 });
  res.json({ success: true, permissions: CUSTOM_PERMISSIONS, users: users.map(accessDTO) });
}

export async function updateUserAccess(req, res) {
  if (!can(req.user, "access.manage")) throw new ApiError(403, "You cannot manage user access");
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt || !canViewUser(req.user, user)) throw new ApiError(404, "User not found");
  if (user.role === "system_admin") throw new ApiError(403, "System Administrator access cannot be restricted");
  // Defend this boundary even when called without route validation.
  const permissions = req.body.permissions;
  if (permissions !== null && (!Array.isArray(permissions) || permissions.some(permission => !CUSTOM_PERMISSIONS.includes(permission)) || new Set(permissions).size !== permissions.length)) {
    throw new ApiError(400, "Invalid permissions");
  }
  if (permissions?.includes("moves.outOfService") && user.role !== "super_admin") throw new ApiError(400, "Out of Service access is reserved for Super Admins");
  const before = user.permissionOverrides ?? null;
  user.permissionOverrides = permissions;
  await user.save();
  await audit(req, { action: "user.access.updated", entityType: "User", entityId: user._id, entityLabel: user.email,
    before: { permissionOverrides: before }, after: { permissionOverrides: permissions } });
  res.json({ success: true, user: accessDTO(user) });
}
