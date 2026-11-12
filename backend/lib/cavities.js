// Running with blocked cavities (Change Pack 2, step 5): a controlled, fully recorded exception to
// "repair status -> Workshop". Pure functions; the controller saves Mould + Movement + WorkLog + AuditLog.
import { fail } from "../utils/ApiError.js";
import { can } from "./permissions.js";
import { LIMITED_RUN_LOCATIONS, LIMITED_RUN_STATUS } from "./flowConfig.js";
import { personSnapshot, placeSnapshot } from "./workLog.js";
import { displayStatus } from "./mouldState.js";

const text = (s) => String(s ?? "").trim();
const sameSet = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

// N for a mould = total cavities of its (live) items.
export const totalCavities = (items = []) => items.reduce((n, it) => n + (Number(it.cavities) > 0 ? Number(it.cavities) : 0), 0);

// Decide a change of the blocked set.
//   blocked: cavity numbers to close now ([] = restore all)
// Returns { set, movement, log, action } or throws an ApiError.
export function planCavities({ mould, user, blocked, total, reason, problemType = null, expectedFixBy = null, now = new Date() }) {
  if (mould.deletedAt) fail(409, "MOULD_DELETED", `${mould.toolId} is deleted`);
  if (!can(user, "cavity.manage")) fail(403, "FORBIDDEN", "You do not have permission to block or restore cavities");
  if (!Number.isInteger(total) || total < 1) fail(400, "NO_CAVITIES", "Enter the number of cavities on the items first");
  const next = [...new Set(blocked)].sort((a, b) => a - b);
  if (next.length !== blocked.length) fail(400, "INVALID_CAVITIES", "Each cavity can be listed once");
  if (next.some((n) => !Number.isInteger(n) || n < 1 || n > total)) fail(400, "INVALID_CAVITIES", `Cavities are numbered 1 to ${total}`);
  if (next.length >= total) fail(400, "ALL_CAVITIES_BLOCKED", "At least one cavity must stay active; send the mould to the Workshop instead");
  const current = [...(mould.blockedCavities || [])].sort((a, b) => a - b);
  if (sameSet(current, next)) fail(400, "NO_CHANGE", "Nothing changed");

  const restoring = next.length === 0;
  const atWorkshop = mould.location === "WORKSHOP";
  // Blocking (or changing the set) only where a mould can keep running; the Workshop keeps its list until restored.
  if (!restoring && !LIMITED_RUN_LOCATIONS.includes(mould.location) && !(atWorkshop && current.length)) {
    fail(409, "LIMITED_RUN_LOCATION", "Cavities can only be blocked on a machine, the Production Floor or in the Isolation Area");
  }
  if (!restoring && !text(reason)) fail(400, "REASON_REQUIRED", "Give the reason for running with blocked cavities");
  if (!restoring && ["IN_SERVICE"].includes(mould.status)) fail(409, "LIMITED_RUN_STATUS", "A mould in service cannot run with blocked cavities");
  const fixBy = expectedFixBy ? new Date(expectedFixBy) : null;
  if (fixBy && Number.isNaN(fixBy.getTime())) fail(400, "INVALID_DATE", "Invalid date");

  // Status: running -> CONDITIONAL; at the Workshop it stays (IN_REPAIR); a full restore makes a running mould GOOD.
  let status = mould.status;
  if (!restoring && !atWorkshop) status = LIMITED_RUN_STATUS;
  if (restoring && displayStatus(mould.status) === LIMITED_RUN_STATUS) status = "GOOD";

  const by = personSnapshot(user);
  const limitedRun = restoring ? null : {
    since: mould.limitedRun?.since ?? now,
    reason: text(reason),
    problemType: problemType ? text(problemType) : null,
    decidedBy: { userId: user._id, name: user.name },
    decidedAt: now,
    expectedFixBy: fixBy
  };
  const action = restoring ? "mould.cavities.restored" : current.length ? "mould.cavities.changed" : "mould.cavities.blocked";
  const summary = restoring ? `All ${total} cavities restored` : `${total - next.length} of ${total} cavities active (blocked: ${next.join(", ")})`;
  const description = [summary, text(reason)].filter(Boolean).join(". ");
  return {
    action,
    set: { blockedCavities: next, limitedRun, status },
    movement: {
      mouldId: mould._id, toolId: mould.toolId, type: "CAVITIES_CHANGED", fromLocation: mould.location, toLocation: mould.location,
      fromStatus: mould.status, toStatus: status, remarks: description, performedBy: user._id, blockedCavities: next
    },
    log: {
      ...placeSnapshot(mould), type: restoring ? "CAVITY_RESTORE" : "CAVITY_BLOCK", description, partsUsed: "", timeSpentMinutes: null,
      doneBy: [by], recordedBy: by, doneAt: now, statusAfter: status, outcome: null, sentToWorkshop: false, correctsId: null,
      blockedCavities: next
    },
    before: { blockedCavities: current, status: mould.status },
    after: { blockedCavities: next, status, limitedRun }
  };
}

// Cavity downtime periods from the mould's CAVITIES_CHANGED movements (oldest first).
//   -> [{ from, to|null, cavities: [..], reason, by }]
export function buildDowntime(movements, users = new Map()) {
  const rows = [...movements].filter((m) => m.type === "CAVITIES_CHANGED").sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const periods = [];
  for (const [i, m] of rows.entries()) {
    const cavities = m.blockedCavities || [];
    if (!cavities.length) continue;
    const end = rows[i + 1]?.createdAt ?? null;
    periods.push({ from: m.createdAt, to: end, cavities, reason: m.remarks || "", by: users.get(String(m.performedBy))?.name ?? null });
  }
  return periods.reverse(); // newest first
}
