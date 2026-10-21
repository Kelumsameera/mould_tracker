// Single source of truth for who may do what. The API enforces it; /api/auth/me sends the
// caller's list to the UI so buttons can mirror it.

export const ROLES = ["super_admin", "admin", "production_supervisor", "mould_technician", "mould_maker"];

// Roles from the original app, valid until migrations/upgradeMouldModel.mjs rewrites them.
// "admin" keeps its own name, so before the migration an old admin acts as the new Admin.
export const LEGACY_ROLE_ALIASES = { operator: "mould_technician", viewer: "production_supervisor" };

const ALL = ROLES;
const SA = ["super_admin"];
const ADMINS = ["super_admin", "admin"];

export const PERMISSIONS = {
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
  return Boolean(user) && allowed.includes(resolveRole(user.role));
}

export const permissionsFor = (user) => Object.keys(PERMISSIONS).filter((p) => can(user, p));

// Admins manage users, but only Super Admins may create, edit or appoint a Super Admin.
export function canManageUser(actor, target, nextRole = target?.role) {
  if (!can(actor, "users.manage")) return false;
  if (resolveRole(actor.role) === "super_admin") return true;
  return resolveRole(target?.role) !== "super_admin" && resolveRole(nextRole) !== "super_admin";
}
