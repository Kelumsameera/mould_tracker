import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";

const baseCookie = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/"
});

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  const valid = user?.active && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!valid) throw new ApiError(401, "Invalid email or password");

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
  res.cookie("access_token", token, { ...baseCookie(), maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, user: userDTO(user) });
}

export function logout(req, res) {
  res.clearCookie("access_token", baseCookie());
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
