import { mouldSearchKey } from "../lib/search.js";
import mongoose from "mongoose";
import { dispatchDetailsSchema } from "./DispatchDetails.js";
import { LOCATIONS, STORED_STATUSES, TOOL_TYPES, mouldStateError } from "../lib/mouldState.js";

// One Tool ID from the tools list. The products it makes are Item documents.
const mouldSchema = new mongoose.Schema(
  {
    toolId: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 100 },
    toolType: { type: String, enum: TOOL_TYPES, default: "INJECTION_MOULD", index: true },
    toolSetCount: { type: String, default: "", trim: true, maxlength: 50 },
    size: { type: String, default: "", trim: true, maxlength: 50 },
    owner: { type: String, default: null, trim: true, uppercase: true, maxlength: 10 }, // zone code, e.g. FLK
    capableMachines: { type: [{ type: String, trim: true, uppercase: true, maxlength: 50 }], default: [] },
    status: { type: String, enum: STORED_STATUSES, default: "GOOD", index: true }, // legacy values load until migrated
    location: {
      type: String,
      enum: LOCATIONS,
      required: true,
      index: true,
      // Cross-field invariants (rack, machine, Workshop). A path validator also runs in validateSync.
      validate: {
        validator() {
          const error = mouldStateError(this);
          if (error) throw new Error(error);
          return true;
        },
        message: (props) => props.reason?.message || "Invalid mould location"
      }
    },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null },
    rackId: { type: mongoose.Schema.Types.ObjectId, ref: "Rack", default: null, index: true },
    // Moulds migrated from the old store have no rack yet; the rack view lists them separately.
    awaitingRack: { type: Boolean, default: false },
    shotsToService: { type: Number, min: 0, default: null },
    totalShots: { type: Number, min: 0, default: 0 },
    lastServicedAt: { type: Date, default: null },
    notes: { type: String, default: "", maxlength: 2000 },
    outOfServiceDetails: { type: dispatchDetailsSchema, default: null },
    // Current Isolation Area stay: { since, fromLocation, intendedDestination, remarks, by }. Null outside Isolation.
    isolation: { type: mongoose.Schema.Types.Mixed, default: null },
    // Running with blocked cavities: cavity numbers 1..N (N = total cavities of the items) that are closed.
    blockedCavities: { type: [{ type: Number, min: 1 }], default: [] },
    // { since, reason, problemType, decidedBy: { userId, name }, decidedAt, expectedFixBy } while cavities are blocked.
    limitedRun: { type: mongoose.Schema.Types.Mixed, default: null },
    remarks: { type: String, default: "", maxlength: 2000 },
    lastMovedAt: { type: Date, default: null },
    lastMovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Latest work log entry, kept here for cards: { workLogId, type, names, doneAt }.
    lastWork: { type: mongoose.Schema.Types.Mixed, default: null },
    // Open problem report: { workLogId, by: { userId, name, role }, at, text }. Cleared when someone acts on it.
    openProblem: { type: mongoose.Schema.Types.Mixed, default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    version: { type: Number, default: 1 }, // optimistic locking
    searchKey: { type: String, default: null } // normalized Tool ID, machines, owner (lib/search.js)
  },
  { timestamps: true, versionKey: false }
);

// One mould per machine at a time (rule 6), enforced by the database.
mouldSchema.index({ machineId: 1 }, { unique: true, partialFilterExpression: { location: "MACHINE" } });
mouldSchema.index({ capableMachines: 1 });
mouldSchema.index({ deletedAt: 1, toolType: 1, toolId: 1 }); // catalog: live moulds per process, sorted
mouldSchema.index({ owner: 1 });
mouldSchema.index({ searchKey: 1 });
mouldSchema.pre("save", function () { this.searchKey = mouldSearchKey(this); });
mouldSchema.index({ "openProblem.at": -1 }, { sparse: true });

export default mongoose.model("Mould", mouldSchema);
