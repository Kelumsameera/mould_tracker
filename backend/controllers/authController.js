import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";
import { sessionCookie, setSession } from "../utils/session.js";


export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  const valid = user?.active && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!valid) throw new ApiError(401, "Invalid email or password");

  setSession(res, user);
  res.json({ success: true, user: userDTO(user) });
}

export function logout(req, res) {
  res.clearCookie("access_token", sessionCookie());
  res.json({ success: true });
}

export function me(req, res) {
  res.json({ success: true, user: userDTO(req.user) });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new ApiError(400, "Current password is incorrect");
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();
  res.json({ success: true });
}

export async function updateProfile(req, res) {
  const user = await User.findById(req.user._id);
  if (!user || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new ApiError(400, "Current password is incorrect");
  }
  user.name = req.body.name;
  user.email = req.body.email;
  if (req.body.newPassword) user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();
  res.json({ success: true, user: userDTO(user) });
}

// PATCH /api/auth/me/language - the UI language follows the user to every device.
export async function setLanguage(req, res) {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { language: req.body.language } }, { new: true });
  res.json({ success: true, user: userDTO(user) });
}
