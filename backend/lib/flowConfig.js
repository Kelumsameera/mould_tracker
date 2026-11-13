// Workflow thresholds. Defaults below; the live values come from the workflow config (lib/configStore.js).
import { getConfig } from "./configStore.js";
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

// Isolation Area: holding area between Production Floor, Mould Room and Workshop.
export const ISOLATION = "ISOLATION";
// Waiting longer than this is "waiting too long" (amber); twice as long is red.
export const ISOLATION_MAX_WAIT_HOURS = num(process.env.ISOLATION_MAX_WAIT_HOURS, 24);
// Places a mould may be mounted from directly (everything else goes through Isolation first).
export const DIRECT_MOUNT_FROM = ["PRODUCTION_FLOOR", ISOLATION, "MOULD_ROOM", "TOOL_ROOM", "MACHINE"];
// Moves that never pass Isolation: dispatch to / return from external repair.
export const ISOLATION_EXEMPT = ["OUT_OF_SERVICE"];

// Running with blocked cavities (limited run).
export { CONDITIONAL_STATUS as LIMITED_RUN_STATUS } from "./mouldState.js";
export const LIMITED_RUN_LOCATIONS = ["MACHINE", "PRODUCTION_FLOOR", ISOLATION];
// Running limited longer than this (or past expectedFixBy) is red.
export const LIMITED_RUN_ALERT_DAYS = num(process.env.LIMITED_RUN_ALERT_DAYS, 7);

// "Waiting too long" level for a stay that began at `since`: null | "amber" | "red".
// Max wait of the holding (transit) location in the config.
export const isolationMaxWaitHours = (config = getConfig()) => config.locations.find((l) => l.kind === "transit" && l.maxWaitHours > 0)?.maxWaitHours ?? ISOLATION_MAX_WAIT_HOURS;
export function isolationLevel(since, now = new Date(), config = getConfig()) {
  if (!since) return null;
  const hours = (now - new Date(since)) / 3_600_000;
  const max = isolationMaxWaitHours(config);
  if (hours >= max * 2) return "red";
  if (hours >= max) return "amber";
  return null;
}

// Limited-run level: "amber" while running limited, "red" when too long or past the expected fix date.
export function limitedRunLevel(limitedRun, now = new Date(), config = getConfig()) {
  if (!limitedRun?.since) return null;
  const days = (now - new Date(limitedRun.since)) / 86_400_000;
  if (days > (config.limitedRunAlertDays ?? LIMITED_RUN_ALERT_DAYS) || (limitedRun.expectedFixBy && now > new Date(limitedRun.expectedFixBy))) return "red";
  return "amber";
}
