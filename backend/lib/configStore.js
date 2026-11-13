// The workflow config the server enforces: the PUBLISHED version from the database, cached in memory.
// Until something is published (or before the first load) the built-in default is used, which equals the
// rules the app had before. publish/rollback call invalidateConfig(); a 30 s re-check covers other processes.
import { defaultConfig } from "./workflowConfig.js";
import { seedRoles } from "./permissions.js";

const RECHECK_MS = 30_000;
let current = null;
let loadedAt = 0;
let loading = null;

// Loads the published config document (undefined = no database to ask). Swappable for tests.
async function databaseLoader() {
  const mongoose = (await import("mongoose")).default;
  if (mongoose.connection.readyState !== 1) return undefined; // tests and scripts without a database keep the built-in default
  const { default: WorkflowConfig } = await import("../models/WorkflowConfig.js");
  return WorkflowConfig.findOne({ state: "published" }).sort({ version: -1 }).lean();
}
let loader = databaseLoader;
export function setConfigLoader(fn) {
  loader = fn ?? databaseLoader;
  current = null;
  loadedAt = 0;
}

export function builtInConfig() {
  return defaultConfig(seedRoles());
}

// Synchronous read used by the pure rules (never waits on the database).
export function getConfig() {
  if (!current) current = builtInConfig();
  if (Date.now() - loadedAt > RECHECK_MS) void refreshConfig();
  return current;
}

export async function refreshConfig() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const doc = await loader();
      if (doc === undefined) return current ?? builtInConfig(); // no database: keep what we have
      current = doc ? { ...builtInConfig(), ...doc } : builtInConfig();
      await registerConfigKeys(current);
      return current;
    } catch {
      return current ?? builtInConfig(); // keep enforcing the last good config
    } finally {
      loadedAt = Date.now();
      loading = null;
    }
  })();
  return loading;
}

export function invalidateConfig() {
  loadedAt = 0;
  return refreshConfig();
}

// Tests / simulator: use a specific config for the current process.
export function useConfigForTests(config) {
  current = config;
  loadedAt = Date.now() + 1e12;
}

// Model enums start with the built-in keys; locations/statuses added through the config are appended here so
// write-time validation accepts them (keys are never removed: stored history must stay valid).
export async function registerConfigKeys(config) {
  const [{ default: Mould }, { default: Movement }, { default: WorkLog }] = await Promise.all([import("../models/Mould.js"), import("../models/Movement.js"), import("../models/WorkLog.js")]);
  const add = (model, path, keys) => {
    const type = model.schema.path(path);
    const missing = keys.filter((k) => !type.enumValues.includes(k));
    if (missing.length) type.enum(...missing);
  };
  const locs = config.locations.map((l) => l.key), stats = config.statuses.map((x) => x.key);
  add(Mould, "location", locs); add(Mould, "status", stats);
  for (const pth of ["fromLocation", "toLocation"]) add(Movement, pth, locs);
  for (const pth of ["fromStatus", "toStatus"]) add(Movement, pth, stats);
  add(WorkLog, "location", locs); add(WorkLog, "statusBefore", stats); add(WorkLog, "statusAfter", stats);
  // Custom roles: users and role-matrix rows may use them.
  const [{ default: User }, { default: RoleAccess }] = await Promise.all([import("../models/User.js"), import("../models/RoleAccess.js")]);
  const roleKeys = (config.roles || []).map((r) => r.key);
  add(User, "role", roleKeys); add(RoleAccess, "role", roleKeys.filter((k) => k !== "system_admin"));
}
