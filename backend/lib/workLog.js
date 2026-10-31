// Work log rules. Pure, like lib/workflow.js: the controller loads documents, saves what this returns.
//  - Allowed for worklog.create (Super Admin, Admin, Mould Technician, Mould Maker), at any location.
//  - The work itself never moves the mould. Only "send to Workshop" does, through the normal move rules.
//  - Rule 2 still holds: a NEEDS_* outcome cannot be stored on a mould in the Mould Room. The entry is
//    saved anyway and a warning asks for the move, so data entry is never blocked by it.
import { fail } from "../utils/ApiError.js";
import { can, canViewUser } from "./permissions.js";
import { canMove, isServiceDue, planMove } from "./workflow.js";

const FUTURE_TOLERANCE_MS = 2 * 60 * 1000; // device clocks drift a little
const id = (v) => (v == null ? null : String(v._id ?? v));
export const personSnapshot = (u) => ({ userId: u._id, name: u.name, role: u.role });

// Who may be named as having done the work.
export const canDoWork = (u) => Boolean(u && u.active && !u.deletedAt && can(u, "worklog.create"));

// Where the mould is and how it is, at the moment of the entry.
const placeSnapshot = (mould) => ({
  mouldId: mould._id,
  toolId: mould.toolId,
  location: mould.location,
  machineId: mould.machineId ?? null,
  machineCode: mould.machine?.code ?? null,
  rackId: mould.rackId ?? null,
  rackLocationId: mould.rack?.locationId ?? null,
  statusBefore: mould.status,
  shots: mould.totalShots ?? null
});

function checkDoneAt(input, now) {
  const doneAt = input.doneAt ? new Date(input.doneAt) : now;
  if (Number.isNaN(doneAt.getTime())) fail(400, "INVALID_DATE", "Invalid date");
  if (doneAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) fail(400, "DONE_AT_FUTURE", "The work time cannot be in the future");
  return doneAt;
}

// "Report a problem": anyone may report; the mould keeps its status and location.
// The reporter is both doneBy and recordedBy. The mould gets an openProblem summary for the badge.
export function planProblemReport({ mould, user, input, now = new Date() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "problem.report")) fail(403, "FORBIDDEN", "You do not have permission to report a problem");
  const description = String(input.description ?? "").trim();
  if (!description) fail(400, "DESCRIPTION_REQUIRED", "Describe the problem");
  const doneAt = checkDoneAt(input, now);
  const reporter = personSnapshot(user);
  const log = {
    ...placeSnapshot(mould),
    type: "INSPECTION",
    description,
    partsUsed: "",
    timeSpentMinutes: null,
    doneBy: [reporter],
    recordedBy: reporter,
    doneAt,
    statusAfter: mould.status, // never changes the status
    outcome: null,
    sentToWorkshop: false,
    correctsId: null,
    problemReported: true
  };
  return { log, openProblem: (logId) => ({ workLogId: logId, by: reporter, at: doneAt, text: description }) };
}

export function planWorkLog({ mould, user, input, workers = [], corrected = null, now = new Date() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "worklog.create")) fail(403, "FORBIDDEN", "You do not have permission to log work");
  const description = String(input.description ?? "").trim();
  if (!description) fail(400, "DESCRIPTION_REQUIRED", "Say what was done");

  const ids = [...new Set((input.doneBy?.length ? input.doneBy : [id(user)]).map(String))];
  if (ids.length > 5) fail(400, "TOO_MANY_WORKERS", "Up to five people per entry");
  const doneBy = ids.map((wid) => {
    const w = workers.find((x) => id(x) === wid) ?? (wid === id(user) ? user : null);
    if (!canDoWork(w) || !canViewUser(user, w)) fail(400, "INVALID_WORKER", "Choose people who are allowed to do mould work", { userId: wid });
    return personSnapshot(w);
  });

  const doneAt = checkDoneAt(input, now);

  if (input.correctsId && (!corrected || id(corrected.mouldId) !== id(mould._id))) {
    fail(400, "INVALID_CORRECTION", "The entry being corrected was not found for this mould");
  }

  const warnings = [];
  let statusAfter = mould.status;
  let statusSet = null;
  let move = null;

  if (input.outcome === "OK" && mould.status !== "GOOD") {
    if (input.type === "SERVICE" || !isServiceDue(mould)) statusAfter = "GOOD";
    else warnings.push("SERVICE_STILL_DUE");
  } else if (input.outcome === "NEEDS_REPAIR" || input.outcome === "NEEDS_SERVICE") {
    const target = input.outcome;
    if (input.sendToWorkshop && mould.location !== "WORKSHOP") {
      if (canMove(user, mould.location, "WORKSHOP")) {
        move = planMove({ mould, user, to: "WORKSHOP", status: target, remarks: `${input.type}: ${description}`, now });
        statusAfter = target;
      } else warnings.push("WORKSHOP_MOVE_NOT_ALLOWED");
    }
    if (!move) {
      if (["MOULD_ROOM", "TOOL_ROOM"].includes(mould.location)) warnings.push("WORKSHOP_MOVE_REQUIRED");
      else statusAfter = target; // on a machine / floor it is flagged in place and can only go to the Workshop
    }
  }

  if (statusAfter !== mould.status && !move) statusSet = { status: statusAfter };
  // A completed service starts a new shot count, wherever it was done.
  if (input.type === "SERVICE" && input.outcome === "OK") statusSet = { ...(statusSet ?? {}), totalShots: 0, lastServicedAt: doneAt };

  const log = {
    ...placeSnapshot(mould),
    type: input.type,
    description,
    partsUsed: String(input.partsUsed ?? "").trim(),
    timeSpentMinutes: input.timeSpentMinutes ?? null,
    doneBy,
    recordedBy: personSnapshot(user),
    doneAt,
    statusAfter,
    shots: input.shots ?? mould.totalShots ?? null, // overrides the snapshot when a counter reading is given
    outcome: input.outcome ?? null,
    sentToWorkshop: Boolean(move),
    correctsId: input.correctsId ?? null,
    // Work on a mould with an open problem deals with that problem.
    resolvesProblemId: input.correctsId ? null : mould.openProblem?.workLogId ?? null
  };

  // Status changes caused by the work also appear in the movement history.
  const movement = statusSet?.status && statusSet.status !== mould.status ? {
    mouldId: mould._id, toolId: mould.toolId, type: "STATUS_CHANGED",
    fromLocation: mould.location, toLocation: mould.location, fromStatus: mould.status, toStatus: statusSet.status,
    remarks: `Work log ${input.type}: ${description}`, performedBy: user._id
  } : null;

  return { log, statusSet, move, movement, warnings };
}

// Short summary kept on the mould for cards and the detail header.
export const lastWorkSummary = (log, logId) => ({ workLogId: logId, type: log.type, names: log.doneBy.map((p) => p.name), doneAt: log.doneAt });
