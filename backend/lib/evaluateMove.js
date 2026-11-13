// ONE pure function deciding whether a move is allowed under a workflow config. Used by the move/status
// endpoints (through lib/workflow.js), by /api/config/simulate and by the UI's allowed-moves list, so buttons,
// forms and error texts always match the server. Location-kind details (which machine / rack) are checked
// afterwards by planMove because they need the chosen machine or rack.
//   request: { user, to, status?, intendedDestination?, remarks?, outOfServiceDetails? }
//   -> { ok, path, requiredFields, errors: [{ code, httpStatus, message, params }], warnings, nextStatus, transition, permissionGroups }
import { dispatchDetailsSchema } from "./outOfService.js";
import { canConfigured as can } from "./permissions.js";
import { allowsAt, locationOf, statusOf, transitionOf } from "./workflowConfig.js";

const LEGACY_STATUS = { RUNNING_LIMITED: "CONDITIONAL" };
const text = (s) => String(s ?? "").trim();
const human = (s) => String(s).replace(/_/g, " ").toLowerCase();

export function permissionGroupsFor(config, from, to) {
  const t = transitionOf(config, from, to);
  if (t) return t.permissions || [];
  const loc = locationOf(config, to);
  return loc?.permission ? [[loc.permission]] : [];
}

export function canMoveWith(config, user, from, to) {
  const t = transitionOf(config, from, to);
  if (t && t.allowed === false) return false;
  return permissionGroupsFor(config, from, to).every((g) => g.some((p) => can(user, p)));
}

// Which fields a form must ask for, from the destination kind and the transition's requirements.
export function requiredFieldsFor(config, from, to, status) {
  const loc = locationOf(config, to);
  const t = transitionOf(config, from, to);
  const req = new Set();
  if (loc?.kind === "machine") req.add("machine");
  if (loc?.kind === "rack") req.add("rack");
  for (const r of t?.requires || []) {
    if (r === "remarksWhenStatus") { if (status !== undefined && status !== "GOOD") req.add("remarks"); }
    else req.add(r);
  }
  return [...req];
}

export function evaluateMove(config, mould, request) {
  const { user, to, status, intendedDestination, remarks = "", outOfServiceDetails } = request;
  const from = mould.location ?? null;
  const errors = [];
  const out = (code, httpStatus, message, params = {}) => ({ ok: false, path: [from, to].filter(Boolean), requiredFields: [], errors: [...errors, { code, httpStatus, message, params }], warnings: [], nextStatus: null, transition: null, permissionGroups: [] });

  if (mould.deletedAt) return out("MOULD_DELETED", 409, `${mould.toolId} is deleted`);
  const target = locationOf(config, to);
  if (!target || target.active === false) return out("INVALID_LOCATION", 400, "Unknown location");
  if (target.storage && !(target.toolTypes || []).includes(mould.toolType ?? "INJECTION_MOULD")) {
    return out("INVALID_LOCATION", 400, "Use the Tool Room for extrusion dies and the Mould Room for injection moulds");
  }
  const transition = transitionOf(config, from, to);
  const permissionGroups = permissionGroupsFor(config, from, to);
  if (!user || !canMoveWith(config, user, from, to)) return out("FORBIDDEN_MOVE", 403, "You do not have permission to make this move");
  if (transition?.via) return { ...out("ISOLATION_FIRST", 409, `Send to ${locationOf(config, transition.via)?.labels?.en ?? transition.via} first`, { via: transition.via }), path: [from, transition.via, to] };
  if (from === to && target.kind === "transit") return out("NO_CHANGE", 400, `${mould.toolId} is already in the ${target.labels?.en ?? to}`);
  if (status !== undefined && !target.acceptsStatus) return out("STATUS_ONLY_AT_WORKSHOP", 400, "A status can only be set when sending a mould to the Workshop or the Isolation Area");
  const statusDef = status !== undefined ? statusOf(config, status) : null;
  if (statusDef?.limitedRun) return out("USE_CAVITY_ACTION", 400, "Use \"Run with blocked cavities\" to run a mould with closed cavities");
  if (intendedDestination !== undefined && intendedDestination !== null && (target.kind !== "transit" || !(config.intendedDestinations || []).includes(intendedDestination))) {
    return out("INVALID_DESTINATION", 400, "A planned destination can only be given when sending to the Isolation Area");
  }
  if (status !== undefined && (!statusDef || statusDef.active === false)) return out("INVALID_STATUS", 400, "Unknown status");

  const fromLoc = locationOf(config, from);
  if (fromLoc?.external && status !== undefined && status !== mould.status) return out("OUT_OF_SERVICE_STATUS", 400, "Return to the Workshop before changing the status");
  const requires = transition?.requires || [];
  if ((target.external || fromLoc?.external) && requires.includes("remarks") && !text(remarks)) return out("REMARKS_REQUIRED", 400, "Remarks are required when sending out or returning from Out of Service");

  // A limited-run mould that reaches the Workshop is in repair (the status's onArrival rule).
  const current = LEGACY_STATUS[mould.status] ?? mould.status;
  const currentDef = statusOf(config, current);
  const nextStatus = status ?? currentDef?.onArrival?.[to] ?? current;
  if (requires.includes("remarksWhenStatus") && status !== undefined && status !== "GOOD" && !text(remarks)) return out("REMARKS_REQUIRED", 400, "Remarks are required when setting a service or repair status");

  if (target.external) {
    if (requires.includes("dispatchDetails") && !dispatchDetailsSchema.safeParse(outOfServiceDetails).success) return out("DISPATCH_DETAILS_REQUIRED", 400, "Enter recipient name, address and repair details");
  } else if (outOfServiceDetails !== undefined) {
    return out("INVALID_DISPATCH_DETAILS", 400, "Dispatch details can only be set when sending Out of Service");
  }

  // Only statuses allowed at the destination may go there (rules 1 and 2).
  const nextDef = statusOf(config, nextStatus);
  if (!nextDef || !allowsAt(nextDef.moveTo, to)) {
    return out("NOT_GOOD", 409, `${mould.toolId} is ${human(nextStatus)}; it can only go to the Workshop`, { status: nextStatus });
  }

  return { ok: true, path: [from, to].filter(Boolean), requiredFields: requiredFieldsFor(config, from, to, status), errors: [], warnings: [], nextStatus, transition, permissionGroups };
}
