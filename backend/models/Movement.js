import mongoose from "mongoose";
import { dispatchDetailsSchema } from "./DispatchDetails.js";
import { immutable } from "../lib/immutable.js";
import { LOCATIONS, MOULD_STATUSES } from "../lib/mouldState.js";

export const MOVEMENT_TYPES = ["CREATED", "EDITED", "MOVED", "STATUS_CHANGED", "DELETED", "RESTORED", "IMPORTED"];

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null });
const snapshot = { type: String, default: null };

// Append-only mould history. Codes are kept as text snapshots so renames never rewrite the past.
const movementSchema = new mongoose.Schema(
  {
    mouldId: { type: mongoose.Schema.Types.ObjectId, required: true }, // no ref: history outlives moulds
    toolId: { type: String, required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    fromLocation: { type: String, enum: [...LOCATIONS, null], default: null },
    toLocation: { type: String, enum: [...LOCATIONS, null], default: null },
    fromStatus: { type: String, enum: [...MOULD_STATUSES, null], default: null },
    toStatus: { type: String, enum: [...MOULD_STATUSES, null], default: null },
    fromMachineId: ref("Machine"),
    toMachineId: ref("Machine"),
    fromMachineCode: snapshot,
    toMachineCode: snapshot,
    fromRackId: ref("Rack"),
    toRackId: ref("Rack"),
    fromRackLocationId: snapshot,
    toRackLocationId: snapshot,
    outOfServiceDetails: { type: dispatchDetailsSchema, default: null },
    remarks: { type: String, default: "", maxlength: 2000 },
    overrideReason: { type: String, default: "", maxlength: 500 }, // capable-machine or owner/zone override
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    legacyMovementId: { type: mongoose.Schema.Types.ObjectId, default: undefined } // ToolMovement copied from
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

movementSchema.index({ mouldId: 1, createdAt: -1 });
movementSchema.index({ legacyMovementId: 1 }, { unique: true, sparse: true });
movementSchema.plugin(immutable, { name: "Movement" });

export default mongoose.model("Movement", movementSchema);
