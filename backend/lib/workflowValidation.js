// Checks a workflow config before it can be published, and compares two configs. Pure functions.
// Each problem: { code, message, path } — the editor shows the list; publishing is refused while it is not empty.
import { PERMISSIONS, LOCKED_PERMISSIONS } from "./permissions.js";
import { allowsAt } from "./workflowConfig.js";

const KEY = /^[A-Z][A-Z0-9_]{1,39}$/;          // location / status keys
const ROLE_KEY = /^[a-z][a-z0-9_]{1,39}$/;      // role keys
const KINDS = ["machine", "rack", "simple", "transit"];
const REQUIRES = ["remarks", "remarksWhenStatus", "dispatchDetails", "intendedDestination"];
const BUILT_IN_ROLES = ["system_admin", "super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker", "executive"];

export function validateConfig(config, { usedLocations = [], usedStatuses = [], usedRoles = [] } = {}) {
  const problems = [];
  const add = (code, message, path) => problems.push({ code, message, path });
  const locs = config.locations || [], stats = config.statuses || [], trans = config.transitions || [], roles = config.roles || [];
  const active = locs.filter((l) => l.active !== false);
  const activeKeys = active.map((l) => l.key);
  const locKeys = locs.map((l) => l.key);
  const labelsOk = (o) => o?.labels && String(o.labels.en ?? "").trim() && String(o.labels.si ?? "").trim();

  // Keys, labels, duplicates.
  for (const [list, kind, pattern] of [[locs, "location", KEY], [stats, "status", KEY], [roles, "role", ROLE_KEY]]) {
    const seen = new Set();
    list.forEach((x, i) => {
      if (!pattern.test(String(x.key ?? ""))) add("INVALID_KEY", `The ${kind} key "${x.key}" is not valid`, `${kind}s.${i}.key`);
      if (seen.has(x.key)) add("DUPLICATE_KEY", `The ${kind} key "${x.key}" is used twice`, `${kind}s.${i}.key`);
      seen.add(x.key);
      if (!labelsOk(x)) add("MISSING_LABEL", `${kind} "${x.key}" needs an English and a Sinhala label`, `${kind}s.${i}.labels`);
    });
  }

  // Location kinds and the system-critical items.
  locs.forEach((l, i) => { if (!KINDS.includes(l.kind)) add("INVALID_KIND", `Location "${l.key}" has an unknown kind`, `locations.${i}.kind`); });
  if (active.filter((l) => l.kind === "machine").length !== 1) add("MACHINE_LOCATION", "There must be exactly one active machine location", "locations");
  if (!active.some((l) => l.kind === "rack")) add("RACK_LOCATION", "At least one active rack location is required", "locations");
  const good = stats.find((s) => s.key === "GOOD");
  if (!good || good.active === false || !good.isGood) add("GOOD_STATUS", "The GOOD status must exist, be active and be marked as good", "statuses");
  // Things already used in records cannot disappear (disable them instead).
  for (const k of usedLocations) if (!locKeys.includes(k)) add("LOCATION_IN_USE", `Location "${k}" is used by moulds or history; disable it instead of removing it`, "locations");
  for (const k of usedStatuses) if (!stats.some((s) => s.key === k)) add("STATUS_IN_USE", `Status "${k}" is used by moulds or history; disable it instead of removing it`, "statuses");
  for (const k of usedRoles) if (!roles.some((r) => r.key === k)) add("ROLE_IN_USE", `Role "${k}" still has users; reassign them first, or disable the role`, "roles");
  for (const k of BUILT_IN_ROLES) if (!roles.some((r) => r.key === k)) add("BUILT_IN_ROLE", `Built-in role "${k}" cannot be removed`, "roles");

  // Transitions reference real locations; requirements and permissions are known.
  const permissionKeys = new Set([...Object.keys(PERMISSIONS), ...locs.map((l) => l.permission).filter(Boolean)]);
  trans.forEach((t, i) => {
    for (const end of ["from", "to"]) if (t[end] != null && !locKeys.includes(t[end])) add("UNKNOWN_LOCATION", `A rule refers to an unknown location "${t[end]}"`, `transitions.${i}.${end}`);
    if (t.via != null && !locKeys.includes(t.via)) add("UNKNOWN_LOCATION", `A rule goes via an unknown location "${t.via}"`, `transitions.${i}.via`);
    for (const r of t.requires || []) if (!REQUIRES.includes(r)) add("UNKNOWN_REQUIREMENT", `Unknown requirement "${r}"`, `transitions.${i}.requires`);
    for (const g of t.permissions || []) for (const p of g) {
      if (!permissionKeys.has(p)) add("ORPHAN_PERMISSION", `Rule ${t.from ?? "new"} → ${t.to} uses an unknown permission "${p}"`, `transitions.${i}.permissions`);
      if (LOCKED_PERMISSIONS.includes(p)) add("LOCKED_PERMISSION", `"${p}" cannot be used in a move rule`, `transitions.${i}.permissions`);
    }
  });
  const rule = (from, to) => trans.find((t) => (t.from ?? null) === (from ?? null) && t.to === to);

  // "via" chains must end (no cycles) and each hop must itself be possible.
  for (const t of trans) {
    if (!t.via || t.allowed === false) continue;
    const seen = new Set([t.from]);
    let hop = t, ok = true;
    while (hop?.via) {
      if (seen.has(hop.via)) { add("VIA_CYCLE", `Rule ${t.from} → ${t.to} goes round in a circle via ${hop.via}`, "transitions"); ok = false; break; }
      seen.add(hop.via);
      const first = rule(hop.from, hop.via);
      if (!first || first.allowed === false) { add("VIA_UNREACHABLE", `Rule ${t.from} → ${t.to} needs ${hop.via} first, but ${hop.from} → ${hop.via} is not allowed`, "transitions"); ok = false; break; }
      hop = first;
    }
    if (ok && !rule(t.via, t.to)?.allowed) add("VIA_DEAD_END", `Rule ${t.from} → ${t.to} goes via ${t.via}, but ${t.via} → ${t.to} is not allowed`, "transitions");
  }

  // Every active location can be reached and left (directly or via another location).
  const possible = (t) => t && t.allowed !== false && activeKeys.includes(t.to) && (t.from == null || activeKeys.includes(t.from));
  for (const k of activeKeys) {
    const loc = locs.find((l) => l.key === k);
    if (!trans.some((t) => t.to === k && t.from !== k && possible(t)) && !loc.allowNewMoulds) add("UNREACHABLE_LOCATION", `No rule leads into "${k}"`, "transitions");
    if (!trans.some((t) => t.from === k && t.to !== k && possible(t))) add("DEAD_END_LOCATION", `No rule leads out of "${k}"`, "transitions");
  }

  // Every status has somewhere to be and somewhere to go.
  stats.forEach((s, i) => {
    if (s.active === false) return;
    if (s.allowedLocations !== "any" && !(s.allowedLocations || []).some((k) => activeKeys.includes(k))) add("DEAD_END_STATUS", `Status "${s.key}" is not allowed at any active location`, `statuses.${i}.allowedLocations`);
    if (s.moveTo !== "any" && !(s.moveTo || []).some((k) => activeKeys.includes(k))) add("DEAD_END_STATUS", `A mould with status "${s.key}" could not move anywhere`, `statuses.${i}.moveTo`);
    for (const k of [...(Array.isArray(s.allowedLocations) ? s.allowedLocations : []), ...(Array.isArray(s.moveTo) ? s.moveTo : [])]) {
      if (!locKeys.includes(k)) add("UNKNOWN_LOCATION", `Status "${s.key}" refers to an unknown location "${k}"`, `statuses.${i}`);
    }
  });
  if (good && !active.every((l) => allowsAt(good.allowedLocations, l.key))) add("GOOD_STATUS", "GOOD must be allowed at every active location", "statuses");

  // Roles: locked items stay locked; role permissions must exist; assignment never includes system_admin (except for itself).
  roles.forEach((r, i) => {
    for (const p of r.permissions || []) {
      if (r.key !== "system_admin" && LOCKED_PERMISSIONS.includes(p)) add("LOCKED_PERMISSION", `"${p}" cannot be given to a role`, `roles.${i}.permissions`);
      else if (!permissionKeys.has(p)) add("ORPHAN_PERMISSION", `Role "${r.key}" has an unknown permission "${p}"`, `roles.${i}.permissions`);
    }
    if (r.key !== "system_admin" && (r.assignable || []).includes("system_admin")) add("LOCKED_ROLE", "Only a System Administrator may assign the System Administrator role", `roles.${i}.assignable`);
    for (const k of r.assignable || []) if (!roles.some((x) => x.key === k)) add("UNKNOWN_ROLE", `Role "${r.key}" may assign an unknown role "${k}"`, `roles.${i}.assignable`);
  });
  const sys = roles.find((r) => r.key === "system_admin");
  if (sys && (sys.active === false || !sys.locked)) add("LOCKED_ROLE", "The System Administrator role is locked", "roles");

  return problems;
}

// What changed between two configs, per section, by key ("from>to" for rules).
export function diffConfigs(a, b) {
  const keyed = { locations: (x) => x.key, statuses: (x) => x.key, roles: (x) => x.key, transitions: (x) => `${x.from ?? "new"}>${x.to}` };
  const out = {};
  for (const [section, keyOf] of Object.entries(keyed)) {
    const before = new Map((a?.[section] || []).map((x) => [keyOf(x), x]));
    const after = new Map((b?.[section] || []).map((x) => [keyOf(x), x]));
    const added = [...after.keys()].filter((k) => !before.has(k));
    const removed = [...before.keys()].filter((k) => !after.has(k));
    const changed = [...after.keys()].filter((k) => before.has(k) && JSON.stringify(before.get(k)) !== JSON.stringify(after.get(k)))
      .map((k) => ({ key: k, fields: Object.keys({ ...before.get(k), ...after.get(k) }).filter((f) => JSON.stringify(before.get(k)[f]) !== JSON.stringify(after.get(k)[f])) }));
    if (added.length || removed.length || changed.length) out[section] = { added, removed, changed };
  }
  for (const f of ["intendedDestinations", "limitedRunAlertDays"]) if (JSON.stringify(a?.[f]) !== JSON.stringify(b?.[f])) (out.settings ??= []).push(f);
  return out;
}

// Only the editable content (no _id / state / timestamps).
export const configContent = (c) => ({
  locations: c.locations || [], statuses: c.statuses || [], transitions: c.transitions || [], roles: c.roles || [],
  intendedDestinations: c.intendedDestinations || [], limitedRunAlertDays: c.limitedRunAlertDays ?? 7
});
