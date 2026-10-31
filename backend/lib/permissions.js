// Single source of truth for who may do what. The API enforces it; /api/auth/me sends the
// caller's list to the UI so buttons can mirror it.

export const ROLES = ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker", "system_admin"];

// Roles from the original app, valid until migrations/upgradeMouldModel.mjs rewrites them.
// "admin" keeps its own name, so before the migration an old admin acts as the new Admin.
export const LEGACY_ROLE_ALIASES = { operator: "mould_technician", viewer: "production_supervisor" };

const ALL = ROLES;
const SA = ["super_admin"];
const ADMINS = ["super_admin", "admin"];

export const PERMISSIONS = {
  "moves.outOfService": SA,
  "access.manage": ["system_admin"],
  "settings.manage": SA,       // system settings and language texts
  "racks.manage": SA,
  "racks.view": ALL,           // Admin has view-only rack management; everyone can see the rack view
  "import.run": SA,
  "export.run": SA,
  "audit.view": SA,
  "users.manage": ADMINS,      // Admin cannot touch Super Admins, see canManageUser
  "moulds.manage": ADMINS,     // add / edit / remove moulds and items
  "moves.machine": ["super_admin", "admin", "production_supervisor", "mould_technician"],
  "moves.mouldRoom": ["super_admin", "admin", "mould_maker"],
  "workshop.work": ["super_admin", "admin", "mould_technician", "mould_maker"],
  "machines.override": ADMINS, // mount on a machine outside capableMachines (reason required)
  "worklog.create": ["super_admin", "admin", "mould_technician", "mould_maker"], // repairs/service done anywhere, also on a machine
  "worklog.view": ALL,
  "worklog.report": ADMINS,     // work log report, per-person summary, CSV/XLSX export
  "problem.report": ALL,        // anyone can report a problem; it never changes status or location
  "moulds.view": ALL
};

export const resolveRole = (role) => LEGACY_ROLE_ALIASES[role] ?? role;

export function can(user, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) throw new Error(`Unknown permission: ${permission}`);
  if (!user) return false;
  if (resolveRole(user.role) === "system_admin") return true;
  // Access administration cannot be delegated through a custom permission list.
  if (permission === "access.manage") return false;
  if (permission === "moves.outOfService" && resolveRole(user.role) !== "super_admin") return false;
  if (Array.isArray(user.permissionOverrides)) return user.permissionOverrides.includes(permission);
  return allowed.includes(resolveRole(user.role));
}

export const rolePermissionsFor = user => Object.keys(PERMISSIONS).filter(permission => can({ role: user.role }, permission));
export const CUSTOM_PERMISSIONS = Object.keys(PERMISSIONS).filter(permission => permission !== "access.manage");

export const permissionsFor = (user) => Object.keys(PERMISSIONS).filter((p) => can(user, p));

// A protected account is visible only to its owner, including between System Administrators.
export function canViewUser(actor, target) {
  return target?.role !== "system_admin" || Boolean(actor?._id && target?._id && String(actor._id) === String(target._id));
}

export function visibleUsersFilter(actor) {
  return { $or: [{ role: { $ne: "system_admin" } }, { _id: actor._id }] };
}

// System Administrators have all capabilities; their accounts remain owner-only.
export function canManageUser(actor, target, nextRole = target?.role) {
  if (!can(actor, "users.manage")) return false;
  if (target?._id && !canViewUser(actor, target)) return false;
  if (resolveRole(actor.role) === "system_admin") return true;
  if (target?.role === "system_admin" || nextRole === "system_admin") return false;
  if (resolveRole(actor.role) === "super_admin") return true;
  return resolveRole(target?.role) !== "super_admin" && resolveRole(nextRole) !== "super_admin";
}
