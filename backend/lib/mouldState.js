// Locations, statuses and the invariants every stored mould must satisfy.
// Workflow rules (who may move what, and from where) live in the API layer.

export const LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", "WORKSHOP", "MOULD_ROOM", "TOOL_ROOM", "OUT_OF_SERVICE"];
export const TOOL_TYPES = ["INJECTION_MOULD", "EXTRUSION_DIE"];
export const storageLocation = (toolType) => toolType === "EXTRUSION_DIE" ? "TOOL_ROOM" : "MOULD_ROOM";
export const isStorage = (location) => ["MOULD_ROOM", "TOOL_ROOM"].includes(location);
export const toolTypeFilter = (toolType) => toolType ? { toolType: toolType === "INJECTION_MOULD" ? { $ne: "EXTRUSION_DIE" } : toolType } : {};
export const MOULD_STATUSES = ["GOOD", "NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR"];
export const WORKSHOP_STATUSES = ["IN_SERVICE", "IN_REPAIR"];

// Returns an error message, or null when the combination is valid.
export function mouldStateError(m) {
  if (isStorage(m.location) && m.location !== storageLocation(m.toolType)) return "Use the Tool Room for extrusion dies and the Mould Room for injection moulds";
  if (m.location === "MACHINE" && !m.machineId) return "A mould on a machine needs a machine";
  if (m.location !== "MACHINE" && m.machineId) return "Only a mould on a machine can reference a machine";
  if (m.location === "MOULD_ROOM" && !m.rackId && !m.awaitingRack) return "A mould in the Mould Room needs a rack";
  if (m.location !== "MOULD_ROOM" && (m.rackId || m.awaitingRack)) return "Only a mould in the Mould Room can have a rack";
  if (m.status !== "GOOD" && isStorage(m.location)) return "A mould that needs service or repair cannot be in the Mould Room or Tool Room";
  if (WORKSHOP_STATUSES.includes(m.status) && !["WORKSHOP", "OUT_OF_SERVICE"].includes(m.location)) return "A mould in service or repair must be at the Workshop";
  return null;
}
