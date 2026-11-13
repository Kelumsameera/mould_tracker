import { rackCode, rackLocationId } from "../models/Rack.js";

// The approved conversion: A1..A4 -> A-P1-1..4, A5 -> A-P2-1.
export function planRackPositions(racks, occupancy = new Map()) {
  const locations = new Map(racks.map(r => [r.locationId, String(r._id)]));
  const changes = [], blockers = [], create = [];
  for (const r of racks) {
    if (r.pallet != null) continue;
    const pallet = Math.floor((r.number - 1) / 4) + 1;
    const number = (r.number - 1) % 4 + 1;
    const code = rackCode(r.row, number, pallet);
    const locationId = rackLocationId(r.zone, code);
    if (pallet > 99 || r.code !== `${r.row}${r.number}`) blockers.push(`${r.locationId}: unsupported legacy location`);
    if ((occupancy.get(String(r._id)) || 0) > 1) blockers.push(`${r.locationId}: contains more than one mould`);
    if (locations.has(locationId) && locations.get(locationId) !== String(r._id)) blockers.push(`${r.locationId}: ${locationId} already exists`);
    locations.set(locationId, String(r._id));
    changes.push({ id: r._id, from: r.locationId, to: locationId, set: { pallet, number, code, locationId, capacity: 1 } });
  }
  // Complete each converted rack's final pallet (e.g. ten old positions become twelve).
  const rows = new Map();
  for (const r of racks.filter(r => r.pallet == null && !r.deletedAt)) {
    const key = `${r.zone}:${r.row}`;
    const found = rows.get(key);
    if (!found || found.number < r.number) rows.set(key, r);
  }
  for (const r of rows.values()) {
    const last = Math.ceil(r.number / 4);
    if (last > 99) continue;
    for (let pallet = 1; pallet <= last; pallet++) for (let number = 1; number <= 4; number++) {
      const code = rackCode(r.row, number, pallet);
      const locationId = rackLocationId(r.zone, code);
      if (!locations.has(locationId)) create.push({ zone: r.zone, row: r.row, pallet, number, code, locationId, capacity: 1, active: r.active });
    }
  }
  return { changes, blockers, create };
}
