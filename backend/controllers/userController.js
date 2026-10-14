import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";

export async function listUsers(req, res) {
  const users = await User.find().sort({ name: 1 });
  res.json({ success: true, users: users.map(userDTO) });
}

export async function createUser(req, res) {
  const { name, email, password, role } = req.body;
  const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ success: true, user: userDTO(user) });
}

export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");

  const isSelf = user._id.equals(req.user._id);
  if (isSelf && (req.body.active === false || (req.body.role && req.body.role !== "admin"))) {
    throw new ApiError(400, "You cannot disable or demote your own account");
  }

  const { name, role, active, password } = req.body;
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (active !== undefined) user.active = active;
  if (password) user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();

  res.json({ success: true, user: userDTO(user) });
}
