import mongoose from "mongoose";
import { immutable } from "../lib/immutable.js";
import { LOCATIONS, MOULD_STATUSES } from "../lib/mouldState.js";

export const WORK_TYPES = ["REPAIR", "SERVICE", "MINOR_FIX", "INSPECTION", "CLEANING", "OTHER"];
export const WORK_OUTCOMES = ["OK", "NEEDS_REPAIR", "NEEDS_SERVICE"];

// Name and role at the time, so the entry stays right if the user is renamed or deleted later.
const personSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  { _id: false }
);

const photoSchema = new mongoose.Schema(
  { path: { type: String, required: true }, thumbPath: { type: String, required: true }, width: Number, height: Number },
  { _id: false }
);

// Work done on a mould wherever it is (on a machine too). It never moves the mould by itself.
// Append-only: a mistake is fixed by a new entry whose correctsId points at the wrong one.
const workLogSchema = new mongoose.Schema(
  {
    mouldId: { type: mongoose.Schema.Types.ObjectId, required: true }, // no ref: history outlives moulds
    toolId: { type: String, required: true },
    type: { type: String, enum: WORK_TYPES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    partsUsed: { type: String, default: "", trim: true, maxlength: 1000 },
    timeSpentMinutes: { type: Number, min: 0, max: 100000, default: null },
    doneBy: { type: [personSchema], validate: [(v) => v.length >= 1 && v.length <= 5, "One to five people"] },
    recordedBy: { type: personSchema, required: true },
    doneAt: { type: Date, required: true },
    // Where the mould was at that time.
    location: { type: String, enum: LOCATIONS, required: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, default: null },
    machineCode: { type: String, default: null },
    rackId: { type: mongoose.Schema.Types.ObjectId, default: null },
    rackLocationId: { type: String, default: null },
    statusBefore: { type: String, enum: MOULD_STATUSES, required: true },
    statusAfter: { type: String, enum: MOULD_STATUSES, required: true },
    shots: { type: Number, min: 0, default: null },
    outcome: { type: String, enum: [...WORK_OUTCOMES, null], default: null },
    sentToWorkshop: { type: Boolean, default: false },
    photos: { type: [photoSchema], default: [], validate: [(v) => v.length <= 3, "Up to three photos"] },
    correctsId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkLog", default: null },
    // A problem reported by anyone (e.g. a production supervisor). It never changes status or location.
    problemReported: { type: Boolean, default: false },
    // Work that dealt with a reported problem points at the report.
    resolvesProblemId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkLog", default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Report filters: every filter is combined with a doneAt range and sorted by doneAt.
workLogSchema.index({ doneAt: -1 });
workLogSchema.index({ mouldId: 1, doneAt: -1 });
workLogSchema.index({ "doneBy.userId": 1, doneAt: -1 });
workLogSchema.index({ type: 1, doneAt: -1 });
workLogSchema.index({ machineCode: 1, doneAt: -1 });
workLogSchema.index({ problemReported: 1, doneAt: -1 });
workLogSchema.index({ correctsId: 1 }, { sparse: true });
workLogSchema.plugin(immutable, { name: "WorkLog" });

export default mongoose.model("WorkLog", workLogSchema);
