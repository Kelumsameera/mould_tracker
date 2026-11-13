import "dotenv/config";
import mongoose from "mongoose";
import Rack from "../models/Rack.js";
import Mould from "../models/Mould.js";
import AuditLog from "../models/AuditLog.js";
import { planRackPositions } from "../lib/rackMigration.js";

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
  const apply = process.argv.includes("--apply");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const racks = await Rack.find({}).session(session).lean();
      const counts = await Mould.aggregate([{ $match: { deletedAt: null, rackId: { $ne: null } } }, { $group: { _id: "$rackId", count: { $sum: 1 } } }]).session(session);
      const plan = planRackPositions(racks, new Map(counts.map(r => [String(r._id), r.count])));
      result = { mode: apply ? "apply" : "preview", changes: plan.changes.map(c => ({ from: c.from, to: c.to })), create: plan.create.map(r => r.locationId), blockers: plan.blockers };
      if (plan.blockers.length || !apply || !plan.changes.length) return;
      for (const c of plan.changes) {
        const updated = await Rack.updateOne({ _id: c.id, locationId: c.from }, { $set: c.set, $inc: { occupancyVersion: 1 } }, { session });
        if (updated.matchedCount !== 1) throw new Error("Rack changed during migration; retry");
      }
      if (plan.create.length) await Rack.create(plan.create, { session, ordered: true });
      await AuditLog.create([{ action: "rack.positions.migrated", entityType: "Migration", actorName: "system", after: { mapping: result.changes, positionsPerPallet: 4 } }], { session });
    });
  } finally { await session.endSession(); }
  console.log(JSON.stringify(result, null, 2));
  if (result.blockers.length) process.exitCode = 1;
} catch (error) {
  console.error(error.name === "MongoServerError" ? "Rack migration failed; no changes committed" : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
