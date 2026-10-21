import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";
import { canManageUser } from "../lib/permissions.js";
import { audit, changes } from "../lib/audit.js";

export async function listUsers(req, res) {
  const users = await User.find({ deletedAt: null }).sort({ name: 1 });
  res.json({ success: true, users: users.map(userDTO) });
}

export async function createUser(req, res) {
  const { name, email, password, role } = req.body;
  if (!canManageUser(req.user, { role }, role)) throw new ApiError(403, "Only a Super Admin can create a Super Admin");
  const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
  await audit(req, { action: "user.created", entityType: "User", entityId: user._id, entityLabel: user.email, after: { name, email: user.email, role } });
  res.status(201).json({ success: true, user: userDTO(user) });
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  if (!canManageUser(req.user, user, req.body.role ?? user.role)) {
    throw new ApiError(403, "Only a Super Admin can change a Super Admin account or role");
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

  res.json({ success: true, user: userDTO(user) });
}

// DELETE /api/users/:id - soft delete: the account can no longer sign in, its history stays.
export async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  if (user._id.equals(req.user._id)) throw new ApiError(400, "You cannot delete your own account");
  if (!canManageUser(req.user, user)) throw new ApiError(403, "Only a Super Admin can delete a Super Admin");
  user.deletedAt = new Date();
  user.active = false;
  await user.save();
  await audit(req, { action: "user.deleted", entityType: "User", entityId: user._id, entityLabel: user.email, reason: req.body?.reason || "" });
  res.json({ success: true });
}
