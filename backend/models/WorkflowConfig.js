import mongoose from "mongoose";

// One document per config version: draft -> published (only one published) -> archived.
// The content is validated by lib/workflowValidation.js before publishing; Mixed keeps old versions loadable.
const schema = new mongoose.Schema(
  {
    version: { type: Number, required: true, unique: true },
    state: { type: String, enum: ["draft", "published", "archived"], required: true, index: true },
    locations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    statuses: { type: [mongoose.Schema.Types.Mixed], default: [] },
    transitions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    roles: { type: [mongoose.Schema.Types.Mixed], default: [] },
    intendedDestinations: { type: [String], default: [] },
    limitedRunAlertDays: { type: Number, default: 7 },
    reason: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    basedOn: { type: Number, default: null }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("WorkflowConfig", schema);
