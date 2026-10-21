import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    path: { type: String, required: true }, // relative to the upload dir
    thumbPath: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    source: { type: String, default: "" } // e.g. xl/media/image12.png, for re-import
  },
  { _id: false }
);

// A product made by a mould (one Item ID row in the tools list).
const itemSchema = new mongoose.Schema(
  {
    mouldId: { type: mongoose.Schema.Types.ObjectId, ref: "Mould", required: true },
    itemId: { type: String, required: true, trim: true, uppercase: true, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    cavities: { type: Number, min: 0, default: null },
    qas: { type: String, default: null, trim: true, maxlength: 100 },
    materialId: { type: String, default: null, trim: true, maxlength: 100 },
    materialDescription: { type: String, default: null, trim: true, maxlength: 300 },
    masterbatchId: { type: String, default: null, trim: true, maxlength: 100 },
    masterbatchDescription: { type: String, default: null, trim: true, maxlength: 300 },
    images: { type: [imageSchema], default: [] },
    notes: { type: String, default: "", trim: true, maxlength: 1000 }, // e.g. original cavity text "8 but 4 validated"
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

itemSchema.index({ mouldId: 1, itemId: 1 }, { unique: true });
itemSchema.index({ itemId: 1 });

export default mongoose.model("Item", itemSchema);
