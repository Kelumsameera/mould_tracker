import mongoose from "mongoose";

const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  challenge: { type: String, required: true },
  kind: { type: String, enum: ["register", "login"], required: true },
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  expiresAt: { type: Date, required: true, expires: 0 },
});

export default mongoose.model("AuthChallenge", schema);
