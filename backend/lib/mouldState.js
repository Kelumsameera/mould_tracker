// Locations, statuses and the invariants every stored mould must satisfy.
// Workflow rules (who may move what, and from where) live in the API layer.

export const LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", "WORKSHOP", "MOULD_ROOM"];
export const MOULD_STATUSES = ["GOOD", "NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR"];
export const WORKSHOP_STATUSES = ["IN_SERVICE", "IN_REPAIR"];

// Returns an error message, or null when the combination is valid.
export function mouldStateError(m) {
  if (m.location === "MACHINE" && !m.machineId) return "A mould on a machine needs a machine";
  if (m.location !== "MACHINE" && m.machineId) return "Only a mould on a machine can reference a machine";
  if (m.location === "MOULD_ROOM" && !m.rackId && !m.awaitingRack) return "A mould in the Mould Room needs a rack";
  if (m.location !== "MOULD_ROOM" && (m.rackId || m.awaitingRack)) return "Only a mould in the Mould Room can have a rack";
  if (m.status !== "GOOD" && m.location === "MOULD_ROOM") return "A mould that needs service or repair cannot be in the Mould Room";
  if (WORKSHOP_STATUSES.includes(m.status) && m.location !== "WORKSHOP") return "A mould in service or repair must be at the Workshop";
  return null;
}
