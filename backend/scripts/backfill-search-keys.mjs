// Fills / refreshes the normalized searchKey on moulds and items (lib/search.js). Dry run unless --apply.
// Idempotent: only documents whose key differs are written. Safe to run again after imports.
//   node scripts/backfill-search-keys.mjs [--apply]
import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { itemSearchKey, mouldSearchKey } from "../lib/search.js";

// Pure: update operations for documents whose stored key is missing or stale.
export function planSearchKeys(docs, keyOf) {
  return docs.filter((d) => d.searchKey !== keyOf(d)).map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { searchKey: keyOf(d) } } } }));
}

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const db = mongoose.connection.db;
    const out = { mode: apply ? "apply" : "dry-run", database: db.databaseName };
    for (const [name, keyOf, fields] of [["moulds", mouldSearchKey, { toolId: 1, capableMachines: 1, owner: 1, searchKey: 1 }], ["items", itemSearchKey, { itemId: 1, description: 1, materialId: 1, masterbatchId: 1, qas: 1, notes: 1, searchKey: 1 }]]) {
      let ops = [];
      let changed = 0;
      // Streams the collection in batches; never holds every document in memory.
      for await (const doc of db.collection(name).find({}, { projection: fields })) {
        ops.push(...planSearchKeys([doc], keyOf));
        if (ops.length >= 500) { changed += ops.length; if (apply) await db.collection(name).bulkWrite(ops); ops = []; }
      }
      changed += ops.length;
      if (apply && ops.length) await db.collection(name).bulkWrite(ops);
      out[name] = changed;
    }
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
