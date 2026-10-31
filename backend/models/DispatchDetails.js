import mongoose from "mongoose";

// A snapshot: later dispatches never rewrite earlier movement history.
export const dispatchDetailsSchema = new mongoose.Schema({
  recipientName: { type: String, required: true, trim: true, maxlength: 150 },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  repairDetails: { type: String, required: true, trim: true, maxlength: 2000 },
  sentAt: { type: Date, required: true },
  returnedAt: { type: Date, default: null }
}, { _id: false });
