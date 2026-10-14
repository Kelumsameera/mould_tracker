import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  credentialId: { type: String, required: true, unique: true },
  publicKey: { type: Buffer, required: true },
  counter: { type: Number, required: true },
  transports: [String],
  name: { type: String, required: true, maxlength: 80 },
  deviceType: String,
  backedUp: Boolean,
  lastUsedAt: Date,
}, { timestamps: true });

export default mongoose.model("Passkey", schema);
