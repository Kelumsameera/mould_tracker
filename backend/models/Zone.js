import mongoose from "mongoose";

// A side of the Mould Room (FLK, CCI, ...). Codes are configurable by the Super Admin.
const zoneSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, match: /^[A-Z0-9]{1,10}$/ },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("Zone", zoneSchema);
