import { fail } from "../utils/ApiError.js";
import { changes } from "./audit.js";
import { mouldStateError } from "./mouldState.js";

// Master data a user may edit. Editing works at any status and location and never changes either.
export const MOULD_FIELDS = ["toolId", "toolType", "toolSetCount", "size", "owner", "capableMachines", "shotsToService", "notes"];

// Pure: decides an edit. before = current mould (plain), fields = requested changes (undefined = untouched).
// Returns { set, diff }: set never contains location/status/machine/rack.
export function planMouldEdit(before, fields) {
  const set = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== undefined && MOULD_FIELDS.includes(k)));
  const next = { ...before, ...set };
  // Only a tool type change must still fit where the tool is (dies live in the Tool Room, moulds in the Mould Room).
  if (set.toolType !== undefined && set.toolType !== before.toolType) {
    const stateError = mouldStateError(next);
    if (stateError) fail(400, "INVALID_LOCATION", stateError);
  }
  const diff = changes(before, next, MOULD_FIELDS);
  if (!diff.fields.length) fail(400, "NO_CHANGE", "Nothing changed");
  return { set, diff };
}
