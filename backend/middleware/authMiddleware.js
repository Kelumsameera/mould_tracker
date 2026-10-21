import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { can } from "../lib/permissions.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user || !user.active || user.deletedAt) {
      return res.status(401).json({ success: false, message: "Invalid user session" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to do this" });
    }
    next();
  };
}

// Passes when the user holds at least one of the listed permissions (see lib/permissions.js).
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!permissions.some((p) => can(req.user, p))) {
      return res.status(403).json({ success: false, message: "You do not have permission to do this" });
    }
    next();
  };
}
