// Single source of truth for who may do what. The API enforces it; /api/auth/me sends the
// caller's EFFECTIVE list to the UI so buttons can mirror it.
//
// effective permissions = role defaults (editable matrix, RoleAccess) + user grants - user denies
// (user overrides are ignored after their optional expiresAt). system_admin always has everything.

// Stored role values. "system_admin" is the System Administrator (label only differs).
export const ROLES = ["system_admin", "super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker", "executive"];

// Roles from the original app, valid until migrations/upgradeMouldModel.mjs rewrites them.
export const LEGACY_ROLE_ALIASES = { operator: "mould_technician", viewer: "production_supervisor" };

const SA = ["super_admin"];
const ADMINS = ["super_admin", "admin"];
const ALL_BUT_SYS = ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker", "executive"];
const MAKERS = ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"];

// Default role -> permission table (= the behaviour before access control became editable).
export const PERMISSIONS = {
  "mould.view": ALL_BUT_SYS,
  "catalog.view": ALL_BUT_SYS,      // Catalog & Totals page
  "mould.create": ADMINS,
  "mould.edit": ADMINS,              // details, items, cavities, shots-to-service, notes
  "mould.machines.edit": ADMINS,     // capable machines
  "mould.images.manage": ADMINS,
  "mould.delete": ADMINS,            // remove / restore / see removed moulds
  "move.machine": ["super_admin", "admin", "production_supervisor", "mould_technician"],
  "move.floor": ["super_admin", "admin", "production_supervisor", "mould_technician"],
  "move.mouldroom": ["super_admin", "admin", "mould_maker"],
  "move.workshop": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "move.isolation": ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"],
  "move.outOfService": SA,
  "status.change": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "machines.override": ADMINS,       // mount outside capableMachines (reason required)
  "worklog.create": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "worklog.view": ALL_BUT_SYS,
  "worklog.report": [...ADMINS, "executive"],
  "problem.report": ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"],
  "cavity.manage": MAKERS,
  "rack.view": ALL_BUT_SYS,
  "rack.manage": SA,
  "users.manage": ADMINS,            // limited by ASSIGNABLE_ROLES
  "access.manage": [],               // system_admin only; never grantable
  "import.run": SA,
  "audit.view": SA,
  "export.run": [...SA, "executive"],
  "settings.manage": SA
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);
// Keys that can appear in the matrix or in a user override.
export const CUSTOM_PERMISSIONS = PERMISSION_KEYS.filter((p) => p !== "access.manage");
// Only Super Admins may ever hold this one (dispatch to external repair); not grantable to others.
const SUPER_ADMIN_ONLY = new Set(["move.outOfService"]);

// Old permission names (stored in RoleAccess / user overrides before Change Pack 2) -> new names.
export const LEGACY_PERMISSIONS = {
  "moulds.view": ["mould.view"],
  "moulds.manage": ["mould.create", "mould.edit", "mould.machines.edit", "mould.images.manage", "mould.delete"],
  "moves.machine": ["move.machine", "move.floor"],
  "moves.mouldRoom": ["move.mouldroom"],
  "workshop.work": ["move.workshop", "status.change"],
  "moves.outOfService": ["move.outOfService"],
  "racks.view": ["rack.view"],
  "racks.manage": ["rack.manage"]
};
export const upgradePermissions = (list) =>
  list == null ? list : [...new Set(list.flatMap((p) => LEGACY_PERMISSIONS[p] ?? [p]))].filter((p) => CUSTOM_PERMISSIONS.includes(p));

// Who may assign (and manage accounts holding) which role. System Administrator: everything.
export const ASSIGNABLE_ROLES = {
  system_admin: ROLES,
  super_admin: ["admin", "production_supervisor", "mould_technician", "mould_maker", "executive"],
  admin: ["production_supervisor", "mould_technician", "mould_maker", "executive"]
};

export const resolveRole = (role) => LEGACY_ROLE_ALIASES[role] ?? role;
export const isSystemAdmin = (user) => resolveRole(user?.role) === "system_admin";

export const roleDefaults = (role) => PERMISSION_KEYS.filter((p) => PERMISSIONS[p].includes(resolveRole(role)));

// Role permissions after the editable matrix (user.rolePermissionOverrides = the role's saved list, or null).
export function rolePermissionsFor(user) {
  if (isSystemAdmin(user)) return [...PERMISSION_KEYS];
  const base = Array.isArray(user?.rolePermissionOverrides) ? upgradePermissions(user.rolePermissionOverrides) : roleDefaults(user?.role);
  return base.filter((p) => allowedForRole(p, user?.role));
}

const allowedForRole = (p, role) => p !== "access.manage" && (!SUPER_ADMIN_ONLY.has(p) || resolveRole(role) === "super_admin");

// User overrides, normalised. Accepts the old shape (a full permission list replacing the role) too.
export function normalizeOverrides(raw, base) {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const list = upgradePermissions(raw);
    return { grant: list.filter((p) => !base.includes(p)), deny: base.filter((p) => !list.includes(p)), expiresAt: null, reason: "" };
  }
  const grant = upgradePermissions(raw.grant || []), deny = upgradePermissions(raw.deny || []);
  if (!grant.length && !deny.length) return null;
  return { grant, deny, expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null, reason: raw.reason || "" };
}

export const overridesActive = (o, now = new Date()) => Boolean(o && (!o.expiresAt || new Date(o.expiresAt) > now));

export function effectivePermissions(user, now = new Date()) {
  if (!user) return [];
  if (isSystemAdmin(user)) return [...PERMISSION_KEYS];
  const base = rolePermissionsFor(user);
  const o = normalizeOverrides(user.permissionOverrides, base);
  if (!overridesActive(o, now)) return base;
  const set = new Set([...base, ...o.grant]);
  for (const p of o.deny) set.delete(p);
  return PERMISSION_KEYS.filter((p) => set.has(p) && allowedForRole(p, user.role));
}

export function can(user, permission) {
  if (!PERMISSIONS[permission]) throw new Error(`Unknown permission: ${permission}`);
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return effectivePermissions(user).includes(permission);
}

export const permissionsFor = (user) => effectivePermissions(user);

// A protected account is visible only to its owner, including between System Administrators.
export function canViewUser(actor, target) {
  return target?.role !== "system_admin" || Boolean(actor?._id && target?._id && String(actor._id) === String(target._id));
}

export function visibleUsersFilter(actor) {
  return { $or: [{ role: { $ne: "system_admin" } }, { _id: actor._id }] };
}

export const canAssignRole = (actor, role) => (ASSIGNABLE_ROLES[resolveRole(actor?.role)] ?? []).includes(resolveRole(role));

// Manage an account (edit / disable / delete) and optionally give it nextRole.
export function canManageUser(actor, target, nextRole = target?.role) {
  if (!can(actor, "users.manage")) return false;
  if (target?._id && !canViewUser(actor, target)) return false;
  if (isSystemAdmin(actor)) return true;
  // Own account: name/email only (role and active are refused for oneself in the controller).
  if (actor?._id && target?._id && String(actor._id) === String(target._id) && resolveRole(nextRole) === resolveRole(target.role)) return true;
  return canAssignRole(actor, target?.role) && canAssignRole(actor, nextRole);
}
