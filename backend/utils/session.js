import jwt from "jsonwebtoken";
import { currentSettings, setting } from "../lib/settings.js";

// Session length: the "auth.sessionHours" setting once changed in Settings, else JWT_EXPIRES_IN / 7 days (as before).
function sessionLength() {
  const changed = currentSettings().rows.some((r) => r.kind === "setting" && r.key === "auth.sessionHours");
  if (changed) { const h = setting("auth.sessionHours"); return { expiresIn: `${h}h`, maxAge: h * 3_600_000 }; }
  return { expiresIn: process.env.JWT_EXPIRES_IN || "7d", maxAge: 7 * 24 * 60 * 60 * 1000 };
}

export const sessionCookie = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/",
});

export function setSession(res, user) {
  const { expiresIn, maxAge } = sessionLength();
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn });
  res.cookie("access_token", token, { ...sessionCookie(), maxAge });
}
