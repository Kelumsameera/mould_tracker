// Mirrors backend/lib/permissions.js. The server decides; /api/auth/me returns the caller's EFFECTIVE
// permission list (role matrix + personal grants - denies) and the UI only uses it to show or hide controls.
import type { Mould as MouldT, User } from "@/utils/types";
import { activeLocations, activeStatuses, configLocation, configStatus, transitionOf } from "./runtimeConfig.ts";
import type { PageName } from "./helpers";

export const ROLES = [
  "system_admin",
  "super_admin",
  "admin",
  "production_supervisor",
  "mould_technician",
  "mould_maker",
  "executive",
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "mould.view",
  "catalog.view",
  "mould.create",
  "mould.edit",
  "mould.machines.edit",
  "mould.images.manage",
  "mould.delete",
  "move.machine",
  "move.floor",
  "move.mouldroom",
  "move.workshop",
  "move.isolation",
  "move.outOfService",
  "status.change",
  "machines.override",
  "worklog.create",
  "worklog.view",
  "worklog.report",
  "problem.report",
  "cavity.manage",
  "rack.view",
  "rack.manage",
  "users.manage",
  "access.manage",
  "import.run",
  "audit.view",
  "export.run",
  "settings.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const can = (user: User | null | undefined, permission: Permission) =>
  Boolean(user?.permissions?.includes(permission));
export const canAny = (user: User | null | undefined, ...permissions: Permission[]) => permissions.some((p) => can(user, p));

// Anything in the mould edit form (details, machines, pictures).
export const canEditMoulds = (user: User | null | undefined) => canAny(user, "mould.edit", "mould.machines.edit", "mould.images.manage");

export function canVisitPage(user: User, page: PageName) {
  if (page === "access") return true; // System Administrator edits; everyone else sees their own access
  if (["find", "extrusion", "workshop", "isolation", "dashboard"].includes(page)) return can(user, "mould.view");
  if (page === "racks") return can(user, "rack.view");
  if (page === "catalog") return can(user, "catalog.view");
  if (page === "place") return can(user, "mould.view");
  if (page === "workflow") return can(user, "config.manage" as Permission) || can(user, "users.manage") || can(user, "worklog.report");
  if (page === "settings") return can(user, "settings.manage") || can(user, "config.manage" as Permission);
  if (page === "machines") return can(user, "mould.edit");
  if (page === "audit") return can(user, "audit.view");
  if (page === "workReport") return can(user, "worklog.report");
  if (page === "users") return can(user, "users.manage");
  if (page === "rackAdmin") return can(user, "rack.manage") || can(user, "mould.edit");
  return true;
}

// Mirrors ASSIGNABLE_ROLES in backend/lib/permissions.js.
const ASSIGNABLE: Partial<Record<Role, readonly Role[]>> = {
  system_admin: ROLES,
  super_admin: ["admin", "production_supervisor", "mould_technician", "mould_maker", "executive"],
  admin: ["production_supervisor", "mould_technician", "mould_maker", "executive"],
};
export const assignableRoles = (user: User | null | undefined): readonly Role[] => (user ? ASSIGNABLE[user.role] ?? [] : []);

const STORAGE = ["MOULD_ROOM", "TOOL_ROOM"];

// Mirrors isolationRouteError in backend/lib/workflow.js: non-machine moves go through the Isolation Area.
const DIRECT_MOUNT_FROM = ["PRODUCTION_FLOOR", "ISOLATION", "MOULD_ROOM", "TOOL_ROOM", "MACHINE"];
export function routeAllowed(from: string, to: string) {
  if (from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return true;
  if (to === "MACHINE") return DIRECT_MOUNT_FROM.includes(from);
  if (to === "ISOLATION") return from !== "ISOLATION";
  return from === to || from === "ISOLATION";
}
// Mirrors movePermissionGroups in backend/lib/workflow.js: one permission from every group is needed.
function builtInCanMoveTo(user: User | null | undefined, from: string, to: string) {
  if (from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") return from !== to && can(user, "move.outOfService");
  if (!routeAllowed(from, to)) return false;
  const groups: Permission[][] = [];
  if (to === "ISOLATION") groups.push(["move.isolation"]); // leaving Isolation needs the destination's permission
  if ((STORAGE.includes(from) && to !== "MACHINE") || STORAGE.includes(to)) groups.push(["move.mouldroom"]);
  if (to === "MACHINE") groups.push(["move.machine"]);
  if (to === "WORKSHOP") groups.push(["move.workshop"]);
  if (to === "PRODUCTION_FLOOR" && !STORAGE.includes(from)) groups.push(from === "WORKSHOP" ? ["move.floor", "move.workshop"] : ["move.floor"]);
  return groups.every((g) => g.some((p) => can(user, p)));
}

// ---- Workflow config (GET /api/config): the same transitions the server enforces ----
// canMoveTo above is the built-in fallback; once the config is loaded these decide.

const legacyCanMoveTo = builtInCanMoveTo;
export function canMoveTo(user: User | null | undefined, from: string, to: string) {
  if (!activeLocations()) return legacyCanMoveTo(user, from, to);
  const t = transitionOf(from, to);
  if (!t || t.allowed === false || t.via) return false;
  const perms = user?.permissions as string[] | undefined;
  return (t.permissions || []).every((g) => g.some((p) => perms?.includes(p)));
}
// Places a mould could go next, before permission checks: active, right tool type, allowed for its status.
export function moveTargets(mould: Pick<MouldT, "location" | "status" | "toolType">) {
  const list = activeLocations();
  if (!list) return [];
  const status = configStatus(mould.status);
  return list.filter((loc) => {
    if (loc.storage && !(loc.toolTypes || []).includes(mould.toolType ?? "INJECTION_MOULD")) return false;
    const same = loc.key === mould.location;
    if (same && loc.kind !== "machine" && loc.kind !== "rack") return false; // a status change at the same place is its own action
    const allowed = status?.moveTo === "any" || (Array.isArray(status?.moveTo) && status.moveTo.includes(loc.key)) || Boolean(loc.acceptsStatus);
    return allowed || !status;
  });
}
// Where "Run with blocked cavities" is possible (the limited-run status's allowed locations).
export function limitedRunPlaces() {
  const s = (activeStatuses() || []).find((x) => x.limitedRun);
  if (!s) return ["MACHINE", "PRODUCTION_FLOOR", "ISOLATION"];
  return s.allowedLocations === "any" ? (activeLocations() || []).map((l) => l.key) : s.allowedLocations;
}
export const locationKind = (key: string) => configLocation(key)?.kind ?? ({ MACHINE: "machine", MOULD_ROOM: "rack", ISOLATION: "transit" } as Record<string, string>)[key] ?? "simple";
