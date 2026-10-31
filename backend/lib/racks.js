import Zone from "../models/Zone.js";
import Rack, { rackLocationId } from "../models/Rack.js";
import AuditLog from "../models/AuditLog.js";

export const DEFAULT_ZONES = [
  { code: "FLK", name: "FLK", sortOrder: 1 },
  { code: "CCI", name: "CCI", sortOrder: 2 }
];
export const DEFAULT_LAYOUT = { rowFrom: "A", rowTo: "C", from: 1, to: 10 };

const letters = (fromLetter, toLetter) => {
  const a = fromLetter.toUpperCase().charCodeAt(0);
  const b = toLetter.toUpperCase().charCodeAt(0);
  if (!(a >= 65 && b <= 90 && a <= b)) throw new Error("Rows must be letters A-Z in order");
  return Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i));
};

// Builds the rack list for a bulk-generate request (zone + row letters + number range).
// Used for the preview and for saving, so both always agree.
export function buildRacks({ zone, rowFrom, rowTo, from, to }) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > to || to > 999) {
    throw new Error("Rack numbers must be whole numbers from 1 to 999, in order");
  }
  const z = zone.trim().toUpperCase();
  return letters(rowFrom, rowTo).flatMap((row) =>
    Array.from({ length: to - from + 1 }, (_, i) => {
      const code = `${row}${from + i}`;
      return { zone: z, row, number: from + i, code, locationId: rackLocationId(z, code) };
    })
  );
}

// Bulk-generate preview: which racks are new, which come back from a soft delete, which already exist.
export function planBulkRacks(existing, request) {
  const byLocation = new Map(existing.map((r) => [r.locationId, r]));
  const plan = { create: [], revive: [], existing: [] };
  for (const rack of buildRacks(request)) {
    const found = byLocation.get(rack.locationId);
    if (!found) plan.create.push(rack);
    else if (found.deletedAt) plan.revive.push({ ...rack, _id: found._id });
    else plan.existing.push({ ...rack, _id: found._id });
  }
  return plan;
}

// Racks may only be removed (soft-deleted) when no mould is on them.
export function occupiedRacks(racks, occupancy) {
  return racks.filter((r) => (occupancy.get(String(r._id)) || 0) > 0).map((r) => r.locationId);
}

// First run only: create FLK and CCI with racks A1-C10 each. Once any zone exists this does nothing,
// so whatever the Super Admin changed later is left alone.
export async function ensureDefaultRacks() {
  if (await Zone.exists({})) return { created: false, racks: 0 };

  await Zone.insertMany(DEFAULT_ZONES);
  const racks = DEFAULT_ZONES.flatMap((z) => buildRacks({ zone: z.code, ...DEFAULT_LAYOUT }));
  await Rack.bulkWrite(
    racks.map((r) => ({ updateOne: { filter: { locationId: r.locationId }, update: { $setOnInsert: r }, upsert: true } }))
  );
  await AuditLog.create({
    action: "rack.seeded_defaults",
    entityType: "Rack",
    after: { zones: DEFAULT_ZONES.map((z) => z.code), ...DEFAULT_LAYOUT, racks: racks.length }
  });
  return { created: true, racks: racks.length };
}
