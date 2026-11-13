// Mould workflow rules. Pure functions: the controllers load the documents, these decide what may happen and
// what changes, and the controllers save it with a Movement + AuditLog.
// The rules come from the workflow config (lib/workflowConfig.js; its defaults are the original rules):
//   1. GOOD moulds may be on a Machine, on the Production Floor or on a Mould Room rack.
//   2. Any service/repair status means Workshop; such a mould cannot go into the Mould Room.
//   3/4. Flow follows from 1 and 2: back to GOOD at the Workshop, then out again.
//   5. Mount only on a capable machine, unless an Admin/Super Admin overrides with a reason.
//   6. One mould per machine.
//   7. Every change is recorded; remarks are mandatory for service/repair.
//   8. totalShots >= shotsToService -> NEEDS_SERVICE.
// The original function names and signatures are kept; each takes an optional `config` (default: the published one).
import { dispatchDetailsSchema } from "./outOfService.js";
import { fail } from "../utils/ApiError.js";
import { can } from "./permissions.js";
import { getConfig } from "./configStore.js";
import { evaluateMove, canMoveWith, permissionGroupsFor } from "./evaluateMove.js";
import { isStorageIn, locationOf, statusOf, transitionOf } from "./workflowConfig.js";

// Routing: "ISOLATION_FIRST" when the transition must pass through another location, "NO_CHANGE" for a second
// move into the same holding area, otherwise null.
export function isolationRouteError(from, to, config = getConfig()) {
  const t = transitionOf(config, from ?? null, to);
  if (t?.via) return "ISOLATION_FIRST";
  if (from != null && from === to && locationOf(config, to)?.kind === "transit") return "NO_CHANGE";
  return null;
}
export const INTENDED_DESTINATIONS = ["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP"];

const id = (v) => (v == null ? null : String(v._id ?? v));
const sameId = (a, b) => id(a) === id(b);
const text = (s) => String(s ?? "").trim();

export const isServiceDue = (m) => Number(m.shotsToService) > 0 && Number(m.totalShots || 0) >= Number(m.shotsToService);

// Permissions a move needs; the user must hold one permission from every group.
export const movePermissionGroups = (from, to, config = getConfig()) => permissionGroupsFor(config, from ?? null, to);
export const canMove = (user, from, to, config = getConfig()) => canMoveWith(config, user, from ?? null, to);

function requireRemarks(remarks, what) {
  if (!text(remarks)) fail(400, "REMARKS_REQUIRED", `Remarks are required ${what}`);
}
// Names used in the original messages.
const placeName = (key, loc) => ({ TOOL_ROOM: "Tool Room" })[key] ?? loc?.labels?.en ?? key;

// Decides a move. Input documents are plain objects; returns the fields to set and the Movement to write.
//   machine:  target machine (machine-kind location)     occupant: mould currently on that machine, if any
//   rack:     target rack (rack-kind location), with zoneActive from its zone    rackOccupancy: moulds on it now, this one excluded
//   status:   optional new status, only where the destination accepts one
export function planMove({ mould, user, to, machine = null, occupant = null, rack = null, rackOccupancy = 0, remarks = "", overrideReason = "", status, outOfServiceDetails, intendedDestination, now = new Date(), config = getConfig() }) {
  const verdict = evaluateMove(config, mould, { user, to, status, intendedDestination, remarks, outOfServiceDetails });
  if (!verdict.ok) {
    const e = verdict.errors[0];
    fail(e.httpStatus, e.code, e.message, e.params);
  }
  const from = mould.location;
  const target = locationOf(config, to);
  const source = locationOf(config, from);
  const nextStatus = verdict.nextStatus;
  const warnings = [];
  const set = { location: to, status: nextStatus, machineId: null, rackId: null, awaitingRack: false, isolation: null };
  const movement = {
    mouldId: mould._id, toolId: mould.toolId, type: "MOVED",
    fromLocation: from, toLocation: to, fromStatus: mould.status, toStatus: nextStatus,
    fromMachineId: mould.machineId ?? null, fromMachineCode: mould.machine?.code ?? null,
    fromRackId: mould.rackId ?? null, fromRackLocationId: mould.rack?.locationId ?? null,
    remarks: text(remarks), overrideReason: "", performedBy: user._id
  };

  // External repair: dispatch details going out (validated by evaluateMove), returned date coming back.
  if (target.external) {
    set.outOfServiceDetails = { ...dispatchDetailsSchema.parse(outOfServiceDetails), sentAt: now, returnedAt: null };
    movement.outOfServiceDetails = { ...set.outOfServiceDetails };
  } else if (source?.external && mould.outOfServiceDetails) {
    set.outOfServiceDetails = { ...mould.outOfServiceDetails, returnedAt: now };
    movement.outOfServiceDetails = { ...set.outOfServiceDetails };
  }

  // Holding-area stay: starts when entering, its dwell time is recorded when leaving.
  if (target.kind === "transit") {
    set.isolation = { since: now, fromLocation: from, intendedDestination: intendedDestination ?? null, remarks: text(remarks), by: user._id ?? null };
    movement.intendedDestination = intendedDestination ?? null;
  }
  if (source?.kind === "transit" && mould.isolation?.since) {
    movement.dwellMinutes = Math.max(0, Math.round((now - new Date(mould.isolation.since)) / 60000));
    movement.isolationSince = mould.isolation.since;
  }

  if (target.kind === "machine") {
    if (!machine) fail(400, "MACHINE_REQUIRED", "Choose a machine");
    if (!machine.active) fail(409, "MACHINE_INACTIVE", `${machine.code} is not in use`);
    if (from === to && sameId(mould.machineId, machine)) fail(400, "NO_CHANGE", `${mould.toolId} is already on ${machine.code}`);
    if (isServiceDue(mould)) fail(409, "SERVICE_DUE", `${mould.toolId} has reached its shot limit (${mould.totalShots}/${mould.shotsToService}); send it to the Workshop`); // rule 8
    if (occupant && !sameId(occupant, mould)) fail(409, "MACHINE_OCCUPIED", `${machine.code} already has ${occupant.toolId}; take it off first`, { occupant: occupant.toolId }); // rule 6
    if (!(mould.capableMachines || []).includes(machine.code)) { // rule 5
      if (!can(user, "machines.override")) fail(409, "NOT_CAPABLE", `${mould.toolId} is not listed for ${machine.code}`, { capableMachines: mould.capableMachines || [] });
      if (!text(overrideReason)) fail(400, "OVERRIDE_REASON_REQUIRED", `${mould.toolId} is not listed for ${machine.code}; give a reason to override`);
      movement.overrideReason = text(overrideReason);
      warnings.push("CAPABILITY_OVERRIDDEN");
    }
    set.machineId = machine._id;
    movement.toMachineId = machine._id;
    movement.toMachineCode = machine.code;
  }

  if (target.kind === "rack") {
    if (!rack) fail(400, "RACK_REQUIRED", `Choose a rack in the ${placeName(to, target)}`);
    if (rack.deletedAt || !rack.active || rack.zoneActive === false) fail(409, "RACK_INACTIVE", `Rack ${rack.locationId} is not in use`);
    if (from === to && sameId(mould.rackId, rack)) fail(400, "NO_CHANGE", `${mould.toolId} is already on ${rack.locationId}`);
    if (rack.capacity != null && rackOccupancy >= rack.capacity) fail(409, "RACK_FULL", `Rack ${rack.locationId} is full (${rack.capacity})`);
    if (mould.owner && mould.owner !== rack.zone) {
      if (!text(overrideReason)) fail(409, "OWNER_MISMATCH", `${mould.toolId} belongs to ${mould.owner}, not ${rack.zone}; give a reason to use this rack`, { owner: mould.owner, zone: rack.zone });
      movement.overrideReason = text(overrideReason);
      warnings.push("OWNER_ZONE_OVERRIDDEN");
    }
    set.rackId = rack._id;
    movement.toRackId = rack._id;
    movement.toRackLocationId = rack.locationId;
  }

  // A place where a status is set on arrival: a second move there must change the status; remarks are
  // required where the transition says so (rule 7).
  const requires = transitionOf(config, from ?? null, to)?.requires || [];
  if (!target.external && target.kind !== "transit" && requires.includes("remarks")) {
    if (from === to && status === undefined) fail(400, "NO_CHANGE", `${mould.toolId} is already at the ${placeName(to, target)}`);
    requireRemarks(remarks, `when sending a mould to the ${placeName(to, target)}`);
  }
  // Other simple places: nothing to change when already there.
  if (from === to && target.kind === "simple" && !target.acceptsStatus && !target.external) {
    fail(400, "NO_CHANGE", `${mould.toolId} is already ${to === "PRODUCTION_FLOOR" ? "on" : "in"} the ${placeName(to, target)}`);
  }

  set.lastMovedAt = now;
  set.lastMovedBy = user._id;
  return { set, movement, warnings };
}

// Status change where the location allows it (rules 2, 4, 7, 8).
export function planStatus({ mould, user, status, remarks = "", now = new Date(), config = getConfig() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "status.change")) fail(403, "FORBIDDEN", "You do not have permission to change the status");
  const next = statusOf(config, status);
  if (!next || next.active === false) fail(400, "INVALID_STATUS", "Unknown status");
  if (status === mould.status) fail(400, "NO_CHANGE", `${mould.toolId} is already ${status.replace(/_/g, " ").toLowerCase()}`);
  if (!locationOf(config, mould.location)?.statusChange) fail(409, "NOT_AT_WORKSHOP", `Send ${mould.toolId} to the Workshop before changing its status`);
  requireRemarks(remarks, "for service and repair work");

  const set = { status };
  if (next.isGood && statusOf(config, mould.status)?.resetsShotsWhenGood) {
    set.totalShots = 0; // a completed service starts a new shot count
    set.lastServicedAt = now;
  } else if (next.isGood && isServiceDue(mould)) {
    fail(409, "SERVICE_DUE", `${mould.toolId} is past its shot limit; service it (In service) before marking it good`);
  }
  return {
    set,
    movement: {
      mouldId: mould._id, toolId: mould.toolId, type: "STATUS_CHANGED",
      fromLocation: mould.location, toLocation: mould.location, fromStatus: mould.status, toStatus: status,
      remarks: text(remarks), performedBy: user._id
    }
  };
}

// Shots produced while mounted; rule 8 flags the mould once the limit is reached.
export function planShots({ mould, user, shots, config = getConfig() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "move.machine") && !can(user, "status.change")) fail(403, "FORBIDDEN", "You do not have permission to record shots");
  if (!Number.isInteger(shots) || shots <= 0) fail(400, "INVALID_SHOTS", "Shots must be a whole number above zero");
  if (locationOf(config, mould.location)?.kind !== "machine") fail(409, "NOT_ON_MACHINE", `${mould.toolId} is not on a machine`);
  const next = { ...mould, totalShots: Number(mould.totalShots || 0) + shots };
  return { set: { totalShots: next.totalShots }, ...serviceDueChange(next, user, "Shot limit reached", config) };
}

// Rule 8 after shots or a new limit: GOOD moulds outside storage become NEEDS_SERVICE.
// (In storage the status stays; mounting is then refused with SERVICE_DUE.)
export function serviceDueChange(mould, user, reason, config = getConfig()) {
  if (mould.status !== "GOOD" || isStorageIn(config, mould.location) || !isServiceDue(mould)) return { statusSet: null, movement: null };
  return {
    statusSet: { status: "NEEDS_SERVICE" },
    movement: {
      mouldId: mould._id, toolId: mould.toolId, type: "STATUS_CHANGED",
      fromLocation: mould.location, toLocation: mould.location, fromStatus: "GOOD", toStatus: "NEEDS_SERVICE",
      remarks: `${reason} (${mould.totalShots}/${mould.shotsToService} shots)`, performedBy: user._id
    }
  };
}

// Where a new mould may start: never on a machine or in a holding area (mount it afterwards), always GOOD.
export function planInitialLocation({ user, location, toolType, rack = null, rackOccupancy = 0, owner = null, overrideReason = "", config = getConfig() }) {
  const start = locationOf(config, location);
  if (!start || start.active === false || !start.allowNewMoulds) fail(400, "INVALID_LOCATION", "Choose a storage room, Production Floor or Workshop");
  const probe = { _id: null, toolId: "New mould", toolType, location: null, status: "GOOD", owner, capableMachines: [] };
  const needsRemarks = (transitionOf(config, null, location)?.requires || []).includes("remarks");
  const { set, warnings } = planMove({ mould: probe, user, to: location, rack, rackOccupancy, remarks: needsRemarks ? "New mould" : "", overrideReason, config });
  return { set, warnings };
}
