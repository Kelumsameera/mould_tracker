// Mould workflow rules (upgrade spec, section 3). Pure functions: the controllers load the documents,
// these decide what may happen and what changes, and the controllers save it with a Movement + AuditLog.
//   1. GOOD moulds may be on a Machine, on the Production Floor or on a Mould Room rack.
//   2. Any service/repair status means Workshop; such a mould cannot go into the Mould Room.
//   3/4. Flow follows from 1 and 2: back to GOOD at the Workshop, then out again.
//   5. Mount only on a capable machine, unless an Admin/Super Admin overrides with a reason.
//   6. One mould per machine.
//   7. Every change is recorded; remarks are mandatory for service/repair.
//   8. totalShots >= shotsToService -> NEEDS_SERVICE.
import { dispatchDetailsSchema } from "./outOfService.js";
import { fail } from "../utils/ApiError.js";
import { can } from "./permissions.js";
import { LOCATIONS, MOULD_STATUSES, isStorage, storageLocation } from "./mouldState.js";

const id = (v) => (v == null ? null : String(v._id ?? v));
const sameId = (a, b) => id(a) === id(b);
const text = (s) => String(s ?? "").trim();

export const isServiceDue = (m) => Number(m.shotsToService) > 0 && Number(m.totalShots || 0) >= Number(m.shotsToService);

// Permissions a move needs; the user must hold one permission from every group.
export function movePermissionGroups(from, to) {
  if (from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return [["moves.outOfService"]];
  const groups = [];
  if (isStorage(from) || isStorage(to)) groups.push(["moves.mouldRoom"]);
  if (to === "MACHINE") groups.push(["moves.machine"]);
  if (to === "WORKSHOP") groups.push(["workshop.work"]);
  if (to === "PRODUCTION_FLOOR" && !isStorage(from)) groups.push(from === "WORKSHOP" ? ["moves.machine", "workshop.work"] : ["moves.machine"]);
  return groups;
}

export const canMove = (user, from, to) => {
  if (from === "OUT_OF_SERVICE" && to === "OUT_OF_SERVICE") return false;
  return movePermissionGroups(from, to).every(g => g.some(p => can(user, p)));
};

function requireRemarks(remarks, what) {
  if (!text(remarks)) fail(400, "REMARKS_REQUIRED", `Remarks are required ${what}`);
}

// Decides a move. Input documents are plain objects; returns the fields to set and the Movement to write.
//   machine:  target machine (to MACHINE)            occupant: mould currently on that machine, if any
//   rack:     target rack (to MOULD_ROOM), with zoneActive from its zone    rackOccupancy: moulds on it now, this one excluded
//   status:   optional new status, only when sending to the Workshop
export function planMove({ mould, user, to, machine = null, occupant = null, rack = null, rackOccupancy = 0, remarks = "", overrideReason = "", status, outOfServiceDetails, now = new Date() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!LOCATIONS.includes(to)) fail(400, "INVALID_LOCATION", "Unknown location");
  if (isStorage(to) && to !== storageLocation(mould.toolType)) fail(400, "INVALID_LOCATION", "Use the Tool Room for extrusion dies and the Mould Room for injection moulds");
  const from = mould.location;
  if (!canMove(user, from, to)) fail(403, "FORBIDDEN_MOVE", "You do not have permission to make this move");
  if (status !== undefined && to !== "WORKSHOP") fail(400, "STATUS_ONLY_AT_WORKSHOP", "A status can only be set when sending a mould to the Workshop");
  if (status !== undefined && !MOULD_STATUSES.includes(status)) fail(400, "INVALID_STATUS", "Unknown status");

  if (from === "OUT_OF_SERVICE" && status !== undefined && status !== mould.status) fail(400, "OUT_OF_SERVICE_STATUS", "Return to the Workshop before changing the status");
  if (to === "OUT_OF_SERVICE" || from === "OUT_OF_SERVICE") requireRemarks(remarks, "when sending out or returning from Out of Service");
  const nextStatus = status ?? mould.status;
  const warnings = [];
  const set = { location: to, status: nextStatus, machineId: null, rackId: null, awaitingRack: false };
  const movement = {
    mouldId: mould._id, toolId: mould.toolId, type: "MOVED",
    fromLocation: from, toLocation: to, fromStatus: mould.status, toStatus: nextStatus,
    fromMachineId: mould.machineId ?? null, fromMachineCode: mould.machine?.code ?? null,
    fromRackId: mould.rackId ?? null, fromRackLocationId: mould.rack?.locationId ?? null,
    remarks: text(remarks), overrideReason: "", performedBy: user._id
  };

  if (to === "OUT_OF_SERVICE") {
    const parsed = dispatchDetailsSchema.safeParse(outOfServiceDetails);
    if (!parsed.success) fail(400, "DISPATCH_DETAILS_REQUIRED", "Enter recipient name, address and repair details");
    set.outOfServiceDetails = { ...parsed.data, sentAt: now, returnedAt: null };
    movement.outOfServiceDetails = { ...set.outOfServiceDetails };
  } else {
    if (outOfServiceDetails !== undefined) fail(400, "INVALID_DISPATCH_DETAILS", "Dispatch details can only be set when sending Out of Service");
    if (from === "OUT_OF_SERVICE" && mould.outOfServiceDetails) {
      set.outOfServiceDetails = { ...mould.outOfServiceDetails, returnedAt: now };
      movement.outOfServiceDetails = { ...set.outOfServiceDetails };
    }
  }

  // Rules 1 and 2: only GOOD moulds leave the Workshop.
  if (!["WORKSHOP", "OUT_OF_SERVICE"].includes(to) && nextStatus !== "GOOD") {
    fail(409, "NOT_GOOD", `${mould.toolId} is ${nextStatus.replace(/_/g, " ").toLowerCase()}; it can only go to the Workshop`, { status: nextStatus });
  }

  if (to === "MACHINE") {
    if (!machine) fail(400, "MACHINE_REQUIRED", "Choose a machine");
    if (!machine.active) fail(409, "MACHINE_INACTIVE", `${machine.code} is not in use`);
    if (from === "MACHINE" && sameId(mould.machineId, machine)) fail(400, "NO_CHANGE", `${mould.toolId} is already on ${machine.code}`);
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

  if (to === "MOULD_ROOM") {
    if (!rack) fail(400, "RACK_REQUIRED", "Choose a rack in the Mould Room");
    if (rack.deletedAt || !rack.active || rack.zoneActive === false) fail(409, "RACK_INACTIVE", `Rack ${rack.locationId} is not in use`);
    if (from === "MOULD_ROOM" && sameId(mould.rackId, rack)) fail(400, "NO_CHANGE", `${mould.toolId} is already on ${rack.locationId}`);
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

  if (to === "WORKSHOP") {
    if (from === "WORKSHOP" && status === undefined) fail(400, "NO_CHANGE", `${mould.toolId} is already at the Workshop`);
    requireRemarks(remarks, "when sending a mould to the Workshop"); // rule 7
  }

  if (to === "PRODUCTION_FLOOR" && from === "PRODUCTION_FLOOR") fail(400, "NO_CHANGE", `${mould.toolId} is already on the Production Floor`);
  if (to === "TOOL_ROOM" && from === "TOOL_ROOM") fail(400, "NO_CHANGE", `${mould.toolId} is already in the Tool Room`);

  set.lastMovedAt = now;
  set.lastMovedBy = user._id;
  return { set, movement, warnings };
}

// Status change at the Workshop (rules 2, 4, 7, 8).
export function planStatus({ mould, user, status, remarks = "", now = new Date() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "workshop.work")) fail(403, "FORBIDDEN", "You do not have permission to change the status");
  if (!MOULD_STATUSES.includes(status)) fail(400, "INVALID_STATUS", "Unknown status");
  if (status === mould.status) fail(400, "NO_CHANGE", `${mould.toolId} is already ${status.replace(/_/g, " ").toLowerCase()}`);
  if (mould.location !== "WORKSHOP") fail(409, "NOT_AT_WORKSHOP", `Send ${mould.toolId} to the Workshop before changing its status`);
  requireRemarks(remarks, "for service and repair work");

  const set = { status };
  if (status === "GOOD" && mould.status === "IN_SERVICE") {
    set.totalShots = 0; // a completed service starts a new shot count
    set.lastServicedAt = now;
  } else if (status === "GOOD" && isServiceDue(mould)) {
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
export function planShots({ mould, user, shots }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "moves.machine") && !can(user, "workshop.work")) fail(403, "FORBIDDEN", "You do not have permission to record shots");
  if (!Number.isInteger(shots) || shots <= 0) fail(400, "INVALID_SHOTS", "Shots must be a whole number above zero");
  if (mould.location !== "MACHINE") fail(409, "NOT_ON_MACHINE", `${mould.toolId} is not on a machine`);
  const next = { ...mould, totalShots: Number(mould.totalShots || 0) + shots };
  return { set: { totalShots: next.totalShots }, ...serviceDueChange(next, user, "Shot limit reached") };
}

// Rule 8 after shots or a new limit: GOOD moulds outside the Mould Room become NEEDS_SERVICE.
// (In the Mould Room the status stays; mounting is then refused with SERVICE_DUE.)
export function serviceDueChange(mould, user, reason) {
  if (mould.status !== "GOOD" || isStorage(mould.location) || !isServiceDue(mould)) return { statusSet: null, movement: null };
  return {
    statusSet: { status: "NEEDS_SERVICE" },
    movement: {
      mouldId: mould._id, toolId: mould.toolId, type: "STATUS_CHANGED",
      fromLocation: mould.location, toLocation: mould.location, fromStatus: "GOOD", toStatus: "NEEDS_SERVICE",
      remarks: `${reason} (${mould.totalShots}/${mould.shotsToService} shots)`, performedBy: user._id
    }
  };
}

// Where a new mould may start: never on a machine (mount it afterwards), always GOOD.
export function planInitialLocation({ user, location, toolType, rack = null, rackOccupancy = 0, owner = null, overrideReason = "" }) {
  if (!["MOULD_ROOM", "TOOL_ROOM", "PRODUCTION_FLOOR", "WORKSHOP"].includes(location)) fail(400, "INVALID_LOCATION", "Choose a storage room, Production Floor or Workshop");
  const probe = { _id: null, toolId: "New mould", toolType, location: null, status: "GOOD", owner, capableMachines: [] };
  const { set, warnings } = planMove({ mould: probe, user, to: location, rack, rackOccupancy, remarks: location === "WORKSHOP" ? "New mould" : "", overrideReason });
  return { set, warnings };
}
