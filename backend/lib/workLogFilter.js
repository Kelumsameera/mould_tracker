import mongoose from "mongoose";
import { normalizeMachineCode } from "./machines.js";
import { APP_TIMEZONE, dateWindow } from "./dateRange.js";

export const EXPORT_CAP = 5000;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "FLK 19066" finds "FLK19066" and back.
const spacedId = (s) => new RegExp([...s.replace(/\s+/g, "")].map(escapeRegex).join("\\s*"), "i"); // split first, then escape
const oid = (v) => new mongoose.Types.ObjectId(String(v)); // aggregate() does not cast strings

// Report query -> MongoDB filter. itemMouldIds: moulds whose Item ID matches the search (looked up by the caller).
// The same filter feeds the list, the summary and the export, so they always agree.
export function buildWorkLogFilter(q, { itemMouldIds = [], hiddenUserIds = [], now = new Date(), tz = APP_TIMEZONE } = {}) {
  const and = [];
  if (q.userId && hiddenUserIds.map(String).includes(String(q.userId))) return { _id: { $exists: false } };
  const hidden = hiddenUserIds.map(oid);
  if (q.toolId) and.push({ toolId: spacedId(q.toolId) });
  if (q.userId) and.push({ "doneBy.userId": oid(q.userId) });
  if (q.type) and.push({ type: q.type });
  if (q.machine) and.push({ machineCode: normalizeMachineCode(q.machine) });
  if (q.outcome) and.push({ outcome: q.outcome === "NONE" ? null : q.outcome });
  if (q.status) and.push({ statusAfter: q.status });
  if (q.problem === "true") and.push({ problemReported: true });
  const window = dateWindow(q, now, tz);
  if (window) and.push({ doneAt: window });
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q.trim()), "i");
    const machine = normalizeMachineCode(q.q);
    and.push({
      $or: [
        { description: rx }, { partsUsed: rx }, { toolId: spacedId(q.q) }, { machineCode: rx }, ...(machine !== q.q.trim().toUpperCase() ? [{ machineCode: machine }] : []),
        ...(hidden.length ? [
          { doneBy: { $elemMatch: { name: rx, userId: { $nin: hidden } } } },
          { "recordedBy.name": rx, "recordedBy.userId": { $nin: hidden } }
        ] : [{ "doneBy.name": rx }, { "recordedBy.name": rx }]), ...(itemMouldIds.length ? [{ mouldId: { $in: itemMouldIds.map(oid) } }] : [])
      ]
    });
  }
  return and.length ? { $and: and } : {};
}

// What the export was made from, in plain words, so the file explains itself.
export function describeFilters(q, total, now = new Date()) {
  const rows = [
    ["Exported", now.toISOString()],
    ["Rows", String(total)],
    ["Date range", q.range && q.range !== "custom" ? q.range : [q.from || "…", q.to || "…"].join(" to ")],
    ["Time zone", APP_TIMEZONE]
  ];
  for (const [key, label] of [["q", "Search"], ["toolId", "Tool ID"], ["userId", "Person id"], ["type", "Type"], ["machine", "Machine"], ["outcome", "Outcome"], ["status", "Status after"], ["problem", "Problem reported only"]]) {
    if (q[key]) rows.push([label, String(q[key])]);
  }
  return rows;
}
