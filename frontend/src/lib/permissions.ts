// Mirrors backend/lib/permissions.js. The server decides; /api/auth/me returns the caller's
// permission list and the UI only uses it to show or hide controls.
import type { User } from './types';

export const ROLES = ['super_admin', 'admin', 'production_supervisor', 'mould_technician', 'mould_maker'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'settings.manage' | 'racks.manage' | 'racks.view' | 'import.run' | 'export.run' | 'audit.view'
  | 'users.manage' | 'moulds.manage' | 'moves.machine' | 'moves.mouldRoom' | 'workshop.work'
  | 'machines.override' | 'moulds.view' | 'worklog.create' | 'worklog.view' | 'worklog.report' | 'problem.report';

export const can = (user: User | null | undefined, permission: Permission) => Boolean(user?.permissions?.includes(permission));

// Roles an actor may hand out: only a Super Admin can appoint a Super Admin.
export const assignableRoles = (user: User | null | undefined): readonly Role[] =>
  user?.role === 'super_admin' ? ROLES : ROLES.filter((r) => r !== 'super_admin');

// Mirrors movePermissionGroups in backend/lib/workflow.js: one permission from every group is needed.
export function canMoveTo(user: User | null | undefined, from: string, to: string) {
  const groups: Permission[][] = [];
  if (['MOULD_ROOM', 'TOOL_ROOM'].includes(from) || ['MOULD_ROOM', 'TOOL_ROOM'].includes(to)) groups.push(['moves.mouldRoom']);
  if (to === 'MACHINE') groups.push(['moves.machine']);
  if (to === 'WORKSHOP') groups.push(['workshop.work']);
  if (to === 'PRODUCTION_FLOOR' && !['MOULD_ROOM', 'TOOL_ROOM'].includes(from)) groups.push(from === 'WORKSHOP' ? ['moves.machine', 'workshop.work'] : ['moves.machine']);
  return groups.every((g) => g.some((p) => can(user, p)));
}
