import mongoose from "mongoose";

const machineSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 50 },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Machine", machineSchema);
