import { ApiError } from "../utils/ApiError.js";

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res) {
  res.status(404).json({ success: false, message: "Route not found" });
}

const DUPLICATE_MESSAGES = {
  toolCode: "Tool code already exists",
  toolId: "Tool ID already exists",
  mouldId: "This mould already has that Item ID", // items: unique (mouldId, itemId)
  machineId: "That machine already has another mould",
  locationId: "That rack already exists",
  code: "That code already exists",
  email: "Email already in use"
};

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.details?.code, details: err.details });
  }
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    return res.status(409).json({ success: false, message: DUPLICATE_MESSAGES[key] || "Duplicate value", code: "DUPLICATE", details: { code: "DUPLICATE", field: key } });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: Object.values(err.errors)[0]?.message || "Validation failed" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, code: "TOO_LARGE", message: "Upload is too large", details: { code: "TOO_LARGE" } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message
  });
}
