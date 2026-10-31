import mongoose from "mongoose";

export const rackLocationId = (zone, code) => `${zone}-${code}`.toUpperCase();

// One rack in the Mould Room, e.g. zone FLK + code A3 = location FLK-A3.
// Racks are never removed from the database: a soft-deleted code is revived when it is created again.
const rackSchema = new mongoose.Schema(
  {
    zone: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    row: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z]{1,3}$/ },
    number: { type: Number, required: true, min: 1, max: 999 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    locationId: { type: String, unique: true, uppercase: true }, // set from zone + code on validate
    capacity: { type: Number, min: 1, default: null }, // null = unlimited
    active: { type: Boolean, default: true },
    note: { type: String, default: "", trim: true, maxlength: 300 },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

rackSchema.pre("validate", function () {
  if (this.zone && this.code) this.locationId = rackLocationId(this.zone, this.code);
});
rackSchema.index({ zone: 1, row: 1, number: 1 });

export default mongoose.model("Rack", rackSchema);
