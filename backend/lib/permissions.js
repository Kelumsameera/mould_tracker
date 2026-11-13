import { getConfig } from "./configStore.js";
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
  "settings.manage": []             // system_admin only; never grantable
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);
// System-Administrator-only capabilities kept outside the editable table: never grantable, never in a role.
export const LOCKED_PERMISSIONS = ["access.manage", "config.manage", "settings.manage"];
const SYSADMIN_ONLY = new Set(LOCKED_PERMISSIONS);

// Static keys + keys created by the workflow config (move.<locationKey> of each location).
export function allPermissionKeys(config = getConfig()) {
  const dynamic = (config?.locations || []).map((l) => l.permission).filter((p) => p && !PERMISSIONS[p]);
  return [...PERMISSION_KEYS, ...new Set(dynamic)];
}
export const grantablePermissions = (config = getConfig()) => allPermissionKeys(config).filter((p) => !LOCKED_PERMISSIONS.includes(p));
const isKnownPermission = (p) => Boolean(PERMISSIONS[p]) || SYSADMIN_ONLY.has(p) || allPermissionKeys().includes(p);
// Keys that can appear in the matrix or in a user override.
export const CUSTOM_PERMISSIONS = PERMISSION_KEYS.filter((p) => !LOCKED_PERMISSIONS.includes(p));
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
  list == null ? list : [...new Set(list.flatMap((p) => LEGACY_PERMISSIONS[p] ?? [p]))].filter((p) => grantablePermissions().includes(p));

// Who may assign (and manage accounts holding) which role. System Administrator: everything.
export const ASSIGNABLE_ROLES = {
  system_admin: ROLES,
  super_admin: ["admin", "production_supervisor", "mould_technician", "mould_maker", "executive"],
  admin: ["production_supervisor", "mould_technician", "mould_maker", "executive"]
};

// Seed for the configurable roles (workflow config): built-in roles keep their keys and cannot be deleted.
const ROLE_LABELS = {
  system_admin: ["System Administrator", "System Administrator"], super_admin: ["Super Admin", "Super Admin"], admin: ["Admin", "Admin"],
  production_supervisor: ["Production Supervisor", "නිෂ්පාදන අධීක්ෂක"], mould_technician: ["Mould Technician", "Mould තාක්ෂණ ශිල්පී"],
  mould_maker: ["Mould Maker", "Mould සාදන්නා"], executive: ["Executive", "විධායක"]
};
export function seedRoles() {
  return ROLES.map((key, i) => ({
    key, labels: { en: ROLE_LABELS[key][0], si: ROLE_LABELS[key][1] }, builtIn: true, active: true, sortOrder: (i + 1) * 10,
    locked: key === "system_admin", permissions: key === "system_admin" ? [...PERMISSION_KEYS] : staticRoleDefaults(key), assignable: ASSIGNABLE_ROLES[key] ?? []
  }));
}
// Roles defined in the published workflow config (built-in + custom).
export const configRole = (key, config = getConfig()) => (config?.roles || []).find((r) => r.key === key) ?? null;
export const roleKeys = (config = getConfig()) => [...new Set([...ROLES, ...(config?.roles || []).map((r) => r.key)])];

export const resolveRole = (role) => LEGACY_ROLE_ALIASES[role] ?? role;
export const isSystemAdmin = (user) => resolveRole(user?.role) === "system_admin";

const staticRoleDefaults = (role) => PERMISSION_KEYS.filter((p) => PERMISSIONS[p].includes(resolveRole(role)));
// A role's default permissions: from the workflow config (seeded = the static table), else the static table.
export function roleDefaults(role) {
  const r = configRole(resolveRole(role));
  if (!r) return staticRoleDefaults(role);
  if (r.active === false) return [];
  return allPermissionKeys().filter((p) => (r.permissions || []).includes(p));
}

// Role permissions after the editable matrix (user.rolePermissionOverrides = the role's saved list, or null).
export function rolePermissionsFor(user) {
  if (isSystemAdmin(user)) return allPermissionKeys();
  const base = Array.isArray(user?.rolePermissionOverrides) ? upgradePermissions(user.rolePermissionOverrides) : roleDefaults(user?.role);
  return base.filter((p) => allowedForRole(p, user?.role));
}

const allowedForRole = (p, role) => !LOCKED_PERMISSIONS.includes(p) && (!SUPER_ADMIN_ONLY.has(p) || resolveRole(role) === "super_admin");

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
  if (isSystemAdmin(user)) return allPermissionKeys();
  const base = rolePermissionsFor(user);
  const o = normalizeOverrides(user.permissionOverrides, base);
  if (!overridesActive(o, now)) return base;
  const set = new Set([...base, ...o.grant]);
  for (const p of o.deny) set.delete(p);
  return allPermissionKeys().filter((p) => set.has(p) && allowedForRole(p, user.role));
}

export function can(user, permission) {
  if (!isKnownPermission(permission)) throw new Error(`Unknown permission: ${permission}`);
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  if (SYSADMIN_ONLY.has(permission)) return false;
  return effectivePermissions(user).includes(permission);
}

export const permissionsFor = (user) => effectivePermissions(user);

// Permission check that also accepts keys a draft/simulated config defines (not yet published): such keys are
// read straight from the role's list and the user's grants/denies.
export function canConfigured(user, permission) {
  if (isKnownPermission(permission)) return can(user, permission);
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  const o = user.permissionOverrides && !Array.isArray(user.permissionOverrides) && overridesActive(user.permissionOverrides) ? user.permissionOverrides : null;
  if (o?.deny?.includes(permission)) return false;
  if (o?.grant?.includes(permission)) return true;
  if (Array.isArray(user.rolePermissionOverrides)) return user.rolePermissionOverrides.includes(permission);
  return (configRole(resolveRole(user.role))?.permissions || []).includes(permission);
}

// A protected account is visible only to its owner, including between System Administrators.
export function canViewUser(actor, target) {
  return target?.role !== "system_admin" || Boolean(actor?._id && target?._id && String(actor._id) === String(target._id));
}

export function visibleUsersFilter(actor) {
  return { $or: [{ role: { $ne: "system_admin" } }, { _id: actor._id }] };
}

// Who may assign which role: from the workflow config (seeded = ASSIGNABLE_ROLES). The System Administrator
// may assign every role; nobody else may ever assign system_admin.
export function assignableFor(actorRole, config = getConfig()) {
  const key = resolveRole(actorRole);
  const active = (config?.roles || []).filter((r) => r.active !== false).map((r) => r.key);
  if (key === "system_admin") return [...new Set([...ROLES, ...active])];
  const r = configRole(key, config);
  return (r ? r.assignable || [] : ASSIGNABLE_ROLES[key] ?? []).filter((k) => k !== "system_admin" && (ROLES.includes(k) || active.includes(k)));
}
export const canAssignRole = (actor, role) => assignableFor(actor?.role).includes(resolveRole(role));

// Manage an account (edit / disable / delete) and optionally give it nextRole.
export function canManageUser(actor, target, nextRole = target?.role) {
  if (!can(actor, "users.manage")) return false;
  if (target?._id && !canViewUser(actor, target)) return false;
  if (isSystemAdmin(actor)) return true;
  // Own account: name/email only (role and active are refused for oneself in the controller).
  if (actor?._id && target?._id && String(actor._id) === String(target._id) && resolveRole(nextRole) === resolveRole(target.role)) return true;
  return canAssignRole(actor, target?.role) && canAssignRole(actor, nextRole);
}
