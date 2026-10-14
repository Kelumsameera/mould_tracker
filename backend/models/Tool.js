import mongoose from "mongoose";

export const TOOL_STATUSES = ["store", "machine", "taken"];

const productSchema = new mongoose.Schema(
  {
    pid: { type: String, required: true, trim: true, uppercase: true, maxlength: 100 },
    desc: { type: String, default: "", trim: true, maxlength: 500 },
    cav: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const toolSchema = new mongoose.Schema(
  {
    toolCode: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 100 },
    size: { type: String, default: "", trim: true, maxlength: 50 },
    status: { type: String, enum: TOOL_STATUSES, default: "store", index: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null },
    takenAt: { type: Date, default: null },
    takenNote: { type: String, default: "", trim: true, maxlength: 300 },
    notes: { type: String, default: "", maxlength: 2000 },
    products: { type: [productSchema], default: [] },
    version: { type: Number, default: 1 } // optimistic locking
  },
  { timestamps: true, versionKey: false }
);

// A machine can hold only one tool at a time (enforced by the database itself).
toolSchema.index({ machineId: 1 }, { unique: true, partialFilterExpression: { status: "machine" } });
toolSchema.index({ "products.pid": 1 });

export default mongoose.model("Tool", toolSchema);
