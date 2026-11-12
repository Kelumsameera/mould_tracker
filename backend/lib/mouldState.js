// Locations, statuses and the invariants every stored mould must satisfy.
// Workflow rules (who may move what, and from where) live in the API layer.

export const LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION", "WORKSHOP", "MOULD_ROOM", "TOOL_ROOM", "OUT_OF_SERVICE"];
export const TOOL_TYPES = ["INJECTION_MOULD", "EXTRUSION_DIE"];
export const storageLocation = (toolType) => toolType === "EXTRUSION_DIE" ? "TOOL_ROOM" : "MOULD_ROOM";
export const isStorage = (location) => ["MOULD_ROOM", "TOOL_ROOM"].includes(location);
export const toolTypeFilter = (toolType) => toolType ? { toolType: toolType === "INJECTION_MOULD" ? { $ne: "EXTRUSION_DIE" } : toolType } : {};
// "Conditional": running with blocked cavities / temporary fix. The one place this key is defined.
export const CONDITIONAL_STATUS = "CONDITIONAL";
export const MOULD_STATUSES = ["GOOD", "NEEDS_SERVICE", "NEEDS_REPAIR", "IN_SERVICE", "IN_REPAIR", CONDITIONAL_STATUS];
// Older stored values -> current key. History (Movement/WorkLog/AuditLog) is immutable, so it keeps the old
// value and is mapped when shown or exported; moulds are rewritten by scripts/migrate-conditional-status.mjs.
export const LEGACY_STATUS_ALIASES = { RUNNING_LIMITED: CONDITIONAL_STATUS };
export const displayStatus = (s) => LEGACY_STATUS_ALIASES[s] ?? s;
// Values accepted when reading stored documents (current + legacy).
export const STORED_STATUSES = [...MOULD_STATUSES, ...Object.keys(LEGACY_STATUS_ALIASES)];
// Query value for a status that also matches its legacy stored values.
export const statusQuery = (s) => { const all = [s, ...Object.keys(LEGACY_STATUS_ALIASES).filter((k) => LEGACY_STATUS_ALIASES[k] === s)]; return all.length > 1 ? { $in: all } : s; };
// Running with blocked cavities is only possible where a mould can run or wait (see lib/flowConfig.js).
export const LIMITED_RUN_LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION"];
export const WORKSHOP_STATUSES = ["IN_SERVICE", "IN_REPAIR"];

// Returns an error message, or null when the combination is valid.
export function mouldStateError(m) {
  if (isStorage(m.location) && m.location !== storageLocation(m.toolType)) return "Use the Tool Room for extrusion dies and the Mould Room for injection moulds";
  if (m.location === "MACHINE" && !m.machineId) return "A mould on a machine needs a machine";
  if (m.location !== "MACHINE" && m.machineId) return "Only a mould on a machine can reference a machine";
  if (m.location === "MOULD_ROOM" && !m.rackId && !m.awaitingRack) return "A mould in the Mould Room needs a rack";
  if (m.location !== "MOULD_ROOM" && (m.rackId || m.awaitingRack)) return "Only a mould in the Mould Room can have a rack";
  if (m.status !== "GOOD" && isStorage(m.location)) return "A mould that needs service or repair cannot be in the Mould Room or Tool Room";
  if (WORKSHOP_STATUSES.includes(m.status) && !["WORKSHOP", "OUT_OF_SERVICE", "ISOLATION"].includes(m.location)) return "A mould in service or repair must be at the Workshop";
  if (displayStatus(m.status) === CONDITIONAL_STATUS && !LIMITED_RUN_LOCATIONS.includes(m.location)) return "A mould running with blocked cavities can only be on a machine, the Production Floor or in the Isolation Area";
  if (m.location !== "ISOLATION" && m.isolation?.since) return "Only a mould in the Isolation Area can have an isolation stay";
  return null;
}
