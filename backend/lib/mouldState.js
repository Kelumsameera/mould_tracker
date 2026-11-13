// Locations, statuses and the invariants every stored mould must satisfy, read from the workflow config
// (lib/workflowConfig.js defaults = the original fixed lists). The constants below are the built-in keys,
// kept for code that needs them at import time; validation uses the published config (isKnownLocation …).
import { getConfig } from "./configStore.js";
import { allowsAt, locationOf, statusOf, storageFor } from "./workflowConfig.js";

export const LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION", "WORKSHOP", "MOULD_ROOM", "TOOL_ROOM", "OUT_OF_SERVICE"];
export const TOOL_TYPES = ["INJECTION_MOULD", "EXTRUSION_DIE"];
export const storageLocation = (toolType, config = getConfig()) => storageFor(config, toolType ?? "INJECTION_MOULD");
export const isStorage = (location, config = getConfig()) => Boolean(locationOf(config, location)?.storage);
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
// Running with blocked cavities is only possible where a mould can run or wait (the CONDITIONAL status's allowed locations).
export const LIMITED_RUN_LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION"];
export const limitedRunLocations = (config = getConfig()) => {
  const s = config.statuses.find((x) => x.limitedRun);
  return s?.allowedLocations === "any" ? config.locations.map((l) => l.key) : s?.allowedLocations ?? [];
};

// Write-time validation (replaces fixed model enums): any location/status in the published config, plus
// legacy keys and inactive entries so documents already stored keep validating.
export const isKnownLocation = (key, config = getConfig()) => Boolean(locationOf(config, key));
export const isKnownStatus = (key, config = getConfig()) => Boolean(statusOf(config, displayStatus(key)));

// Returns an error message, or null when the combination is valid.
export function mouldStateError(m, config = getConfig()) {
  const loc = locationOf(config, m.location);
  if (!loc) return "Unknown location";
  if (loc.storage && !(loc.toolTypes || []).includes(m.toolType ?? "INJECTION_MOULD")) return "Use the Tool Room for extrusion dies and the Mould Room for injection moulds";
  if (loc.kind === "machine" && !m.machineId) return "A mould on a machine needs a machine";
  if (loc.kind !== "machine" && m.machineId) return "Only a mould on a machine can reference a machine";
  if (loc.kind === "rack" && !m.rackId && !m.awaitingRack) return `A mould in the ${loc.labels?.en ?? m.location} needs a rack`;
  if (loc.kind !== "rack" && (m.rackId || m.awaitingRack)) return "Only a mould in the Mould Room can have a rack";
  const status = statusOf(config, displayStatus(m.status));
  if (!status) return "Unknown status";
  if (!status.isGood && loc.storage) return "A mould that needs service or repair cannot be in the Mould Room or Tool Room";
  if (!allowsAt(status.allowedLocations, m.location)) return status.stateMessage || `${status.labels?.en ?? m.status} is not allowed in the ${loc.labels?.en ?? m.location}`;
  if (loc.kind !== "transit" && m.isolation?.since) return "Only a mould in the Isolation Area can have an isolation stay";
  return null;
}
