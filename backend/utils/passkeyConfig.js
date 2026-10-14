import { isIP } from "node:net";
import { ApiError } from "./ApiError.js";

export function passkeyConfig() {
  const value = process.env.WEBAUTHN_ORIGIN;
  if (!value) return null;
  let origin;
  try { origin = new URL(value); } catch { return null; }
  if (origin.origin !== value || isIP(origin.hostname)) return null;
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost")) return null;
  const rpID = process.env.WEBAUTHN_RP_ID || origin.hostname;
  if (rpID !== origin.hostname) return null;
  return { origin: origin.origin, rpID, rpName: "Tool Tracker" };
}

export function requirePasskeyOrigin(req, res, next) {
  const config = passkeyConfig();
  if (!config) return next(new ApiError(503, "Passkey login needs a configured trusted HTTPS address"));
  if (req.get("origin") !== config.origin) return next(new ApiError(403, "Invalid request origin"));
  req.passkeyConfig = config;
  next();
}
