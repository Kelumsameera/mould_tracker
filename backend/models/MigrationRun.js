import mongoose from "mongoose";

// Marks one-off data migrations as applied so they never run twice.
const migrationRunSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    summary: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("MigrationRun", migrationRunSchema);
