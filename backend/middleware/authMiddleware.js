import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { can } from "../lib/permissions.js";
import { loadRoleAccess } from "../lib/roleAccess.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user || !user.active || user.deletedAt) {
      return res.status(401).json({ success: false, message: "Invalid user session" });
    }
    req.user = await loadRoleAccess(user);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
  // Seeded accounts must pick their own password before using anything but their own account.
  if (req.user.mustChangePassword && !String(req.originalUrl || "").startsWith("/api/auth/")) {
    return res.status(403).json({ success: false, code: "PASSWORD_CHANGE_REQUIRED", message: "Change your password first" });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || (req.user.role !== "system_admin" && !roles.includes(req.user.role))) {
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
