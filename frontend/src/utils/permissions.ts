// Mirrors backend/lib/permissions.js. The server decides; /api/auth/me returns the caller's
// permission list and the UI only uses it to show or hide controls.
import type { User } from "@/utils/types";
import type { PageName } from "./helpers";

export const ROLES = [
  "super_admin",
  "admin",
  "production_supervisor",
  "mould_technician",
  "mould_maker",
  "system_admin",
] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "moves.outOfService"
  | "access.manage"
  | "settings.manage"
  | "racks.manage"
  | "racks.view"
  | "import.run"
  | "export.run"
  | "audit.view"
  | "users.manage"
  | "moulds.manage"
  | "moves.machine"
  | "moves.mouldRoom"
  | "workshop.work"
  | "machines.override"
  | "moulds.view"
  | "worklog.create"
  | "worklog.view"
  | "worklog.report"
  | "problem.report";

export const can = (user: User | null | undefined, permission: Permission) =>
  Boolean(user?.permissions?.includes(permission));

export function canVisitPage(user: User, page: PageName) {
  if (page === "access") return can(user, "access.manage");
  if (["find", "extrusion", "workshop"].includes(page)) return can(user, "moulds.view");
  if (page === "racks") return can(user, "racks.view");
  if (page === "machines") return can(user, "moulds.manage");
  if (page === "audit") return can(user, "audit.view");
  if (page === "workReport") return can(user, "worklog.report");
  if (page === "users") return can(user, "users.manage");
  if (page === "rackAdmin") {
    return can(user, "racks.manage") || can(user, "moulds.manage");
  }
  return true;
}

// Only a System Administrator may assign the protected role.
export const assignableRoles = (
  user: User | null | undefined,
): readonly Role[] =>
  user?.role === "system_admin"
    ? ROLES
    : ROLES.filter((r) => r !== "system_admin" && (r !== "super_admin" || user?.role === "super_admin"));

// Mirrors movePermissionGroups in backend/lib/workflow.js: one permission from every group is needed.
export function canMoveTo(
  user: User | null | undefined,
  from: string,
  to: string,
) {
  if (from === "OUT_OF_SERVICE" || to === "OUT_OF_SERVICE") {
    return from !== to && can(user, "moves.outOfService");
  }
  const groups: Permission[][] = [];
  if (
    ["MOULD_ROOM", "TOOL_ROOM"].includes(from) ||
    ["MOULD_ROOM", "TOOL_ROOM"].includes(to)
  )
    groups.push(["moves.mouldRoom"]);
  if (to === "MACHINE") groups.push(["moves.machine"]);
  if (to === "WORKSHOP") groups.push(["workshop.work"]);
  if (to === "PRODUCTION_FLOOR" && !["MOULD_ROOM", "TOOL_ROOM"].includes(from))
    groups.push(
      from === "WORKSHOP"
        ? ["moves.machine", "workshop.work"]
        : ["moves.machine"],
    );
  return groups.every((g) => g.some((p) => can(user, p)));
}
