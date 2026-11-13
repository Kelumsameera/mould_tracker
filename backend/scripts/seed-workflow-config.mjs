// Stores the built-in workflow config (identical to the original rules) as published version 1, so it can be
// edited, versioned and rolled back. Dry run unless --apply. Idempotent: does nothing when any version exists.
//   node scripts/seed-workflow-config.mjs [--apply]
import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import WorkflowConfig from "../models/WorkflowConfig.js";
import AuditLog from "../models/AuditLog.js";
import { builtInConfig } from "../lib/configStore.js";

// Pure: the first version document, or null when one exists already.
export function planSeed(existingCount, now = new Date()) {
  if (existingCount > 0) return null;
  const { version, ...content } = builtInConfig();
  void version;
  return { ...content, version: 1, state: "published", reason: "Built-in defaults (seeded)", publishedAt: now, basedOn: null };
}

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const doc = planSeed(await WorkflowConfig.countDocuments());
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", database: mongoose.connection.db.databaseName, seed: doc ? { version: 1, locations: doc.locations.length, statuses: doc.statuses.length, transitions: doc.transitions.length, roles: doc.roles.length } : "already seeded" }, null, 2));
    if (apply && doc) {
      await WorkflowConfig.create(doc);
      await AuditLog.create({ action: "workflow.seeded", entityType: "WorkflowConfig", entityLabel: "v1", after: { version: 1 }, reason: doc.reason });
      console.log("Applied.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
