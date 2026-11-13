// Configurable workflow (locations, statuses, transitions, roles). This file defines the DEFAULT config,
// generated from the rules the app had before the workflow became configurable, plus small lookup helpers.
// The published config (if any) comes from the database via lib/configStore.js; with nothing published the
// app behaves exactly like this default. Only a fixed set of rule types exists (no expressions):
//   location.kind: machine (needs a machine, one mould per machine) | rack (needs a zone + rack) | simple | transit (holding area)
//   location flags: storage (+ toolTypes), external (dispatch details, own status rules), acceptsStatus,
//                   statusChange ("Allow status changes here"), allowNewMoulds ("Allow new moulds to start here")
//   transition: allowed, via (go through that location first), permissions (one of each group), requires[]
//   status: allowedLocations (at rest), moveTo (destinations while in this status), flags

export const DEFAULT_CONFIG_VERSION = 0; // "built-in defaults" (nothing published yet)

const L = (key, en, si, extra) => ({ key, labels: { en, si }, active: true, ...extra });
export const DEFAULT_LOCATIONS = [
  L("MACHINE", "Machine", "මැෂිම", { kind: "machine", sortOrder: 10, icon: "machine", color: "machine", permission: "move.machine" }),
  L("PRODUCTION_FLOOR", "Production Floor", "Production Floor", { kind: "simple", sortOrder: 20, icon: "floor", color: "floor", permission: "move.floor", allowNewMoulds: true }),
  L("ISOLATION", "Isolation Area", "Isolation කලාපය", { kind: "transit", sortOrder: 30, icon: "clock", color: "warn", permission: "move.isolation", maxWaitHours: Number(process.env.ISOLATION_MAX_WAIT_HOURS) > 0 ? Number(process.env.ISOLATION_MAX_WAIT_HOURS) : 24, acceptsStatus: true }),
  L("MOULD_ROOM", "Mould Room", "Mould කාමරය", { kind: "rack", sortOrder: 40, icon: "mouldRoom", color: "room", permission: "move.mouldroom", storage: true, toolTypes: ["INJECTION_MOULD"], allowNewMoulds: true }),
  L("TOOL_ROOM", "Mould Room – Extrusion", "Mould කාමරය – Extrusion", { kind: "simple", sortOrder: 50, icon: "mouldRoom", color: "room", permission: "move.mouldroom", storage: true, toolTypes: ["EXTRUSION_DIE"], allowNewMoulds: true }),
  L("WORKSHOP", "Workshop", "Workshop", { kind: "simple", sortOrder: 60, icon: "workshop", color: "workshop", permission: "move.workshop", acceptsStatus: true, statusChange: true, allowNewMoulds: true }),
  L("OUT_OF_SERVICE", "Outside Repair", "පිටත repair", { kind: "simple", sortOrder: 70, icon: "attention", color: "danger", permission: "move.outOfService", external: true })
];

const ALL = DEFAULT_LOCATIONS.map((l) => l.key);
const NOT_STORAGE = ALL.filter((k) => !["MOULD_ROOM", "TOOL_ROOM"].includes(k));
const SERVICE_PLACES = ["WORKSHOP", "OUT_OF_SERVICE", "ISOLATION"];
const S = (key, en, si, extra) => ({ key, labels: { en, si }, active: true, ...extra });
export const DEFAULT_STATUSES = [
  S("GOOD", "Good", "හොඳ තත්ත්වයේ", { sortOrder: 10, color: "good", isGood: true, countsAsAvailable: true, allowedLocations: "any", moveTo: "any" }),
  S("NEEDS_SERVICE", "Needs service", "Service කළ යුතුයි", { sortOrder: 20, color: "warn", needsAttention: true, allowedLocations: NOT_STORAGE, moveTo: SERVICE_PLACES,
    stateMessage: "A mould that needs service or repair cannot be in the Mould Room or Tool Room" }),
  S("NEEDS_REPAIR", "Needs repair", "අලුත්වැඩියා කළ යුතුයි", { sortOrder: 30, color: "warn", needsAttention: true, allowedLocations: NOT_STORAGE, moveTo: SERVICE_PLACES,
    stateMessage: "A mould that needs service or repair cannot be in the Mould Room or Tool Room" }),
  S("IN_SERVICE", "In service", "Service වෙමින්", { sortOrder: 40, color: "workshop", needsAttention: true, resetsShotsWhenGood: true, allowedLocations: SERVICE_PLACES, moveTo: SERVICE_PLACES,
    stateMessage: "A mould in service or repair must be at the Workshop" }),
  S("IN_REPAIR", "In repair", "අලුත්වැඩියා වෙමින්", { sortOrder: 50, color: "workshop", needsAttention: true, allowedLocations: SERVICE_PLACES, moveTo: SERVICE_PLACES,
    stateMessage: "A mould in service or repair must be at the Workshop" }),
  S("CONDITIONAL", "Conditional", "කොන්දේසි සහිත", { sortOrder: 60, color: "warn", limitedRun: true, needsAttention: true,
    hint: { en: "Running with blocked cavities / temporary fix", si: "Cavities වසා run වෙනවා / තාවකාලික විසඳුම" },
    allowedLocations: ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION"], moveTo: [...SERVICE_PLACES, "MACHINE", "PRODUCTION_FLOOR"], onArrival: { WORKSHOP: "IN_REPAIR" },
    stateMessage: "A mould running with blocked cavities can only be on a machine, the Production Floor or in the Isolation Area" })
];

// ---- Transitions: generated from the previous hard-coded rules (identical behaviour) ----
const STORAGE = ["MOULD_ROOM", "TOOL_ROOM"];
const DIRECT_MOUNT_FROM = ["PRODUCTION_FLOOR", "ISOLATION", "MOULD_ROOM", "TOOL_ROOM", "MACHINE"];
function legacyPermissionGroups(from, to) {
  if (from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return [["move.outOfService"]];
  const groups = [];
  if ((STORAGE.includes(from) && to !== "MACHINE") || STORAGE.includes(to)) groups.push(["move.mouldroom"]);
  if (to === "ISOLATION") groups.push(["move.isolation"]);
  if (to === "MACHINE") groups.push(["move.machine"]);
  if (to === "WORKSHOP") groups.push(["move.workshop"]);
  if (to === "PRODUCTION_FLOOR" && !STORAGE.includes(from)) groups.push(from === "WORKSHOP" ? ["move.floor", "move.workshop"] : ["move.floor"]);
  return groups;
}
function legacyVia(from, to) {
  if (from == null || from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return null;
  if (to === "MACHINE") return DIRECT_MOUNT_FROM.includes(from) ? null : "ISOLATION";
  if (to === "ISOLATION" || from === to || from === "ISOLATION") return null;
  return "ISOLATION";
}
function legacyRequires(from, to) {
  const r = [];
  if (to === "WORKSHOP" || to === "OUT_OF_SERVICE" || from === "OUT_OF_SERVICE") r.push("remarks");
  if (to === "OUT_OF_SERVICE") r.push("dispatchDetails");
  if (to === "ISOLATION") r.push("remarksWhenStatus");
  return r;
}
export function defaultTransitions() {
  const list = [];
  for (const from of [null, ...ALL]) {
    for (const to of ALL) {
      list.push({
        from, to,
        allowed: !(from === "OUT_OF_SERVICE" && to === "OUT_OF_SERVICE"),
        via: legacyVia(from, to),
        permissions: legacyPermissionGroups(from, to),
        requires: legacyRequires(from, to)
      });
    }
  }
  return list;
}

// Roles and default permissions are seeded from lib/permissions.js (see seedRoles there).
export function defaultConfig(roles = []) {
  return {
    version: DEFAULT_CONFIG_VERSION,
    locations: DEFAULT_LOCATIONS.map((l) => ({ ...l })),
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    transitions: defaultTransitions(),
    roles,
    // Where an intended destination may be planned from a transit location.
    intendedDestinations: ["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP"],
    limitedRunAlertDays: Number(process.env.LIMITED_RUN_ALERT_DAYS) > 0 ? Number(process.env.LIMITED_RUN_ALERT_DAYS) : 7
  };
}

// ---- Lookups (work on any config, default or published) ----
export const locationOf = (config, key) => config.locations.find((l) => l.key === key) ?? null;
export const statusOf = (config, key) => config.statuses.find((s) => s.key === key) ?? null;
export const transitionOf = (config, from, to) => config.transitions.find((t) => (t.from ?? null) === (from ?? null) && t.to === to) ?? null;
export const locationKeys = (config, { activeOnly = false } = {}) => config.locations.filter((l) => !activeOnly || l.active).map((l) => l.key);
export const statusKeys = (config, { activeOnly = false } = {}) => config.statuses.filter((s) => !activeOnly || s.active).map((s) => s.key);
export const storageFor = (config, toolType) => config.locations.find((l) => l.storage && (l.toolTypes || []).includes(toolType ?? "INJECTION_MOULD"))?.key ?? null;
export const isStorageIn = (config, key) => Boolean(locationOf(config, key)?.storage);
export const allowsAt = (list, key) => list === "any" || (Array.isArray(list) && list.includes(key));
export const transitLocation = (config) => config.locations.find((l) => l.kind === "transit" && l.active)?.key ?? null;
