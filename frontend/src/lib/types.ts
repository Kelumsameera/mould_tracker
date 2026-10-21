import type { Permission, Role } from './permissions';

export type { Role };
export type Location = 'MACHINE' | 'PRODUCTION_FLOOR' | 'WORKSHOP' | 'MOULD_ROOM';
export type MouldStatus = 'GOOD' | 'NEEDS_SERVICE' | 'NEEDS_REPAIR' | 'IN_SERVICE' | 'IN_REPAIR';
export const LOCATIONS: Location[] = ['MACHINE', 'PRODUCTION_FLOOR', 'MOULD_ROOM', 'WORKSHOP'];
export const STATUSES: MouldStatus[] = ['GOOD', 'NEEDS_SERVICE', 'NEEDS_REPAIR', 'IN_SERVICE', 'IN_REPAIR'];
export const SERVICE_STATUSES: MouldStatus[] = ['NEEDS_SERVICE', 'NEEDS_REPAIR', 'IN_SERVICE', 'IN_REPAIR'];

export interface User { id: string; name: string; email: string; role: Role; language: 'en' | 'si'; active: boolean; permissions: Permission[] }

export interface MachineRef { id: string; code: string; name: string }
export interface RackRef { id: string; zone: string; row: string; number: number; code: string; locationId: string }
export interface ItemImage { url: string; thumbUrl: string; width: number | null; height: number | null }

export interface Item {
  id: string; itemId: string; description: string; cavities: number | null; qas: string | null;
  materialId: string | null; materialDescription: string | null; masterbatchId: string | null; masterbatchDescription: string | null;
  notes: string; images: ItemImage[]; sortOrder: number;
}

export interface Mould {
  id: string; toolId: string; toolSetCount: string; size: string; owner: string | null; capableMachines: string[];
  status: MouldStatus; location: Location; machine: MachineRef | null; rack: RackRef | null; awaitingRack: boolean;
  shotsToService: number | null; totalShots: number; serviceDue: boolean; lastServicedAt: string | null;
  notes: string; remarks: string; lastMovedAt: string | null; lastMovedBy: { id: string; name: string } | null;
  lastWork: { type: WorkType; names: string[]; doneAt: string } | null;
  openProblem: { by: { name: string; role: Role }; at: string; text: string } | null;
  deletedAt: string | null; version: number; createdAt: string; updatedAt: string;
  // list view
  itemCount?: number; itemIds?: string[]; thumbUrl?: string | null;
  // detail view
  items?: Item[];
}

export interface Movement {
  id: string; toolId: string; type: 'CREATED' | 'IMPORTED' | 'EDITED' | 'MOVED' | 'STATUS_CHANGED' | 'DELETED' | 'RESTORED';
  fromLocation: Location | null; toLocation: Location | null; fromStatus: MouldStatus | null; toStatus: MouldStatus | null;
  fromMachineCode: string | null; toMachineCode: string | null; fromRackLocationId: string | null; toRackLocationId: string | null;
  remarks: string; overrideReason: string; by: { id: string; name: string } | null; createdAt: string;
}

export interface Machine { id: string; code: string; name: string; active: boolean; mould: { id: string; toolId: string } | null }

export interface MouldChip { id: string; toolId: string; status: MouldStatus; owner: string | null }
export interface Rack extends RackRef { capacity: number | null; active: boolean; note: string; occupancy: number; moulds: MouldChip[] }
export interface Zone { id: string; code: string; name: string; active: boolean; sortOrder: number; racks: Rack[] }

export interface Stats {
  total: number; byLocation: Partial<Record<Location, number>>; byStatus: Partial<Record<MouldStatus, number>>;
  needsAttention: number; serviceDueNotFlagged: number; awaitingRack: number; problemsReported: number;
}

export interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string | null; entityLabel: string;
  actor: { id: string | null; name: string }; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string; createdAt: string;
}

export interface MouldInput {
  toolId?: string; toolSetCount?: string; size?: string; owner?: string | null; capableMachines?: string[]; shotsToService?: number | null; notes?: string;
}
export type ItemInput = Partial<Omit<Item, 'id' | 'images'>> & { itemId?: string };
export interface MoveInput {
  to: Location; machineId?: string; rackId?: string; status?: MouldStatus; remarks?: string; overrideReason?: string; version?: number;
}

export type WorkType = 'REPAIR' | 'SERVICE' | 'MINOR_FIX' | 'INSPECTION' | 'CLEANING' | 'OTHER';
export const WORK_TYPES: WorkType[] = ['REPAIR', 'SERVICE', 'MINOR_FIX', 'INSPECTION', 'CLEANING', 'OTHER'];
export type WorkOutcome = 'OK' | 'NEEDS_REPAIR' | 'NEEDS_SERVICE';
export interface Person { id: string; name: string; role: Role }
export interface WorkLog {
  id: string; mouldId: string; toolId: string; type: WorkType; description: string; partsUsed: string; timeSpentMinutes: number | null;
  doneBy: Person[]; recordedBy: Person; doneAt: string; location: Location; machineCode: string | null; rackLocationId: string | null;
  statusBefore: MouldStatus; statusAfter: MouldStatus; shots: number | null; outcome: WorkOutcome | null; sentToWorkshop: boolean;
  photos: { url: string; thumbUrl: string }[]; correctsId: string | null; corrected: boolean; createdAt: string;
  problemReported: boolean; resolvesProblemId: string | null;
}
export interface WorkLogInput {
  type: WorkType; description: string; partsUsed?: string; timeSpentMinutes?: number | null; doneBy: string[]; doneAt?: string;
  shots?: number | null; outcome?: WorkOutcome | null; sendToWorkshop?: boolean; correctsId?: string; photos?: string[]; version?: number;
}
export type DateRange = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom';
export interface WorkFilter {
  q?: string; toolId?: string; userId?: string; type?: WorkType; machine?: string; outcome?: WorkOutcome | 'NONE'; status?: MouldStatus;
  problem?: 'true'; range?: DateRange; from?: string; to?: string; page?: number; limit?: number;
}
export interface WorkSummary {
  people: { userId: string; name: string; role: Role; total: number; minutes: number; byType: Partial<Record<WorkType, number>> }[];
  moulds: { mouldId: string; toolId: string; count: number; repairs: number; last: string }[];
}
