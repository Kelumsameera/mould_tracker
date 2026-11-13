// Renames the mould status RUNNING_LIMITED -> CONDITIONAL. Dry run unless --apply. Idempotent.
// Only Mould documents change. Movement / WorkLog / AuditLog are immutable history: they keep the old value,
// which the API maps to CONDITIONAL when showing or exporting (see LEGACY_STATUS_ALIASES).
//   node scripts/migrate-conditional-status.mjs [--apply]
import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { LEGACY_STATUS_ALIASES } from "../lib/mouldState.js";

// Pure: { filter, update } per legacy value.
export const conditionalStatusPlan = () =>
  Object.entries(LEGACY_STATUS_ALIASES).map(([from, to]) => ({ from, to, filter: { status: from }, update: { $set: { status: to }, $inc: { version: 1 } } }));

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const moulds = mongoose.connection.db.collection("moulds");
    const result = { mode: apply ? "apply" : "dry-run", database: mongoose.connection.db.databaseName, changes: [] };
    for (const p of conditionalStatusPlan()) {
      const count = await moulds.countDocuments(p.filter);
      const entry = { from: p.from, to: p.to, moulds: count };
      if (apply && count) entry.updated = (await moulds.updateMany(p.filter, p.update)).modifiedCount;
      result.changes.push(entry);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
