import mongoose from "mongoose";

const toolMovementSchema = new mongoose.Schema(
  {
    toolId: { type: mongoose.Schema.Types.ObjectId, required: true }, // no ref: history outlives deleted tools
    toolCode: { type: String, required: true },
    action: {
      type: String,
      enum: ["created", "edited", "assigned", "returned", "taken_out", "deleted"],
      required: true
    },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },
    fromMachineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null },
    toMachineId: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null },
    note: { type: String, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true, versionKey: false }
);

toolMovementSchema.index({ toolId: 1, createdAt: -1 });

export default mongoose.model("ToolMovement", toolMovementSchema);
