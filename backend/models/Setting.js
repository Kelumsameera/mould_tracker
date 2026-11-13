import mongoose from "mongoose";

// A changed general setting, master-data list or UI text (kind). Defaults live in lib/settings.js, so only
// changes are stored; deleting a document = "reset to default".
const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["setting", "list", "text"], required: true },
    key: { type: String, required: true, maxlength: 120 },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true, versionKey: false }
);
schema.index({ kind: 1, key: 1 }, { unique: true });

export default mongoose.model("Setting", schema);
