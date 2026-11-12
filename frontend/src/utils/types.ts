import type { Permission, Role } from "@/utils/permissions";

export type { Role };
export type Location = 'MACHINE' | 'PRODUCTION_FLOOR' | 'ISOLATION' | 'WORKSHOP' | 'MOULD_ROOM' | 'TOOL_ROOM' | 'OUT_OF_SERVICE';
export type ToolType = 'INJECTION_MOULD' | 'EXTRUSION_DIE';
export type MouldStatus = 'GOOD' | 'NEEDS_SERVICE' | 'NEEDS_REPAIR' | 'IN_SERVICE' | 'IN_REPAIR' | 'CONDITIONAL';
// "Conditional": running with blocked cavities / temporary fix (server: CONDITIONAL_STATUS).
export const CONDITIONAL_STATUS = 'CONDITIONAL' as const;
export type AlertLevel = 'amber' | 'red' | null;
export const LOCATIONS: Location[] = ['MACHINE', 'PRODUCTION_FLOOR', 'ISOLATION', 'MOULD_ROOM', 'TOOL_ROOM', 'WORKSHOP', 'OUT_OF_SERVICE'];
// Where a mould waiting in the Isolation Area may be planned to go next.
export const INTENDED_DESTINATIONS: Location[] = ['MACHINE', 'PRODUCTION_FLOOR', 'MOULD_ROOM', 'TOOL_ROOM', 'WORKSHOP'];
export const STATUSES: MouldStatus[] = ['GOOD', 'NEEDS_SERVICE', 'NEEDS_REPAIR', 'IN_SERVICE', 'IN_REPAIR'];
export const SERVICE_STATUSES: MouldStatus[] = ['NEEDS_SERVICE', 'NEEDS_REPAIR', 'IN_SERVICE', 'IN_REPAIR'];

export interface User { id: string; name: string; email: string; role: Role; language: 'en' | 'si'; active: boolean; permissions: Permission[]; mustChangePassword?: boolean; hasAccessOverrides?: boolean }

export interface AccessOverrides { grant: Permission[]; deny: Permission[]; expiresAt: string | null; reason: string; active: boolean }
export interface UserAccess extends User { permissionOverrides: AccessOverrides | null; rolePermissions: Permission[]; effectivePermissions: Permission[] }
export interface RoleAccess { role: Role; customised: boolean; version: number; defaults: Permission[]; permissions: Permission[] }

export interface MachineRef { id: string; code: string; name: string }
export interface RackRef { id: string; zone: string; row: string; number: number; pallet?: number | null; code: string; locationId: string }
export interface ItemImage { key: string; manual: boolean; url: string; thumbUrl: string; width: number | null; height: number | null }

export interface Item {
  id: string; itemId: string; description: string; cavities: number | null; qas: string | null;
  materialId: string | null; materialDescription: string | null; masterbatchId: string | null; masterbatchDescription: string | null;
  notes: string; images: ItemImage[]; sortOrder: number;
}

export interface DispatchDetails { recipientName: string; address: string; repairDetails: string; sentAt: string; returnedAt: string | null }

export interface IsolationStay { since: string; fromLocation: Location | null; intendedDestination: Location | null; remarks: string; level: AlertLevel }
export interface LimitedRun { since: string; reason: string; problemType: string | null; decidedBy: { userId: string | null; name: string } | null; decidedAt: string | null; expectedFixBy: string | null; level: AlertLevel }
export interface Mould {
  outOfServiceDetails: DispatchDetails | null;
  isolation?: IsolationStay | null;
  matchedItem?: { itemId: string; description: string } | null; // search hit through an item
  blockedCavities?: number[];
  totalCavities?: number | null;
  limitedRun?: LimitedRun | null;
  toolType: ToolType;
  id: string; toolId: string; toolSetCount: string; size: string; owner: string | null; capableMachines: string[];
  status: MouldStatus; location: Location; machine: MachineRef | null; rack: RackRef | null; awaitingRack: boolean;
  shotsToService: number | null; totalShots: number; serviceDue: boolean; lastServicedAt: string | null;
  notes: string; remarks: string; lastMovedAt: string | null; lastMovedBy: { id: string | null; name: string } | null;
  lastWork: { type: WorkType; names: string[]; doneAt: string } | null;
  openProblem: { by: { name: string; role: Role | null }; at: string; text: string } | null;
  deletedAt: string | null; version: number; createdAt: string; updatedAt: string;
  // list view
  itemCount?: number; itemIds?: string[]; thumbUrl?: string | null;
  // detail view
  items?: Item[];
}

export interface Movement {
  outOfServiceDetails: DispatchDetails | null;
  id: string; toolId: string; type: 'CREATED' | 'IMPORTED' | 'EDITED' | 'MOVED' | 'STATUS_CHANGED' | 'DELETED' | 'RESTORED' | 'CAVITIES_CHANGED';
  fromLocation: Location | null; toLocation: Location | null; fromStatus: MouldStatus | null; toStatus: MouldStatus | null;
  fromMachineCode: string | null; toMachineCode: string | null; fromRackLocationId: string | null; toRackLocationId: string | null;
  remarks: string; overrideReason: string; by: { id: string | null; name: string } | null; createdAt: string;
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> } | null;
  intendedDestination?: Location | null; dwellMinutes?: number | null; blockedCavities?: number[] | null;
}

export interface Machine { id: string; code: string; name: string; active: boolean; mould: { id: string; toolId: string } | null }

export interface MouldChip { id: string; toolId: string; status: MouldStatus; owner: string | null; size?: string; capableMachines?: string[]; items?: (Pick<Item, 'itemId' | 'description' | 'cavities'> & { thumbUrl?: string | null })[] }
export interface Rack extends RackRef { capacity: number | null; active: boolean; note: string; occupancy: number; moulds: MouldChip[] }
export interface Zone { id: string; code: string; name: string; active: boolean; sortOrder: number; racks: Rack[] }

export interface Stats {
  total: number; byLocation: Partial<Record<Location, number>>; byStatus: Partial<Record<MouldStatus, number>>;
  needsAttention: number; serviceDueNotFlagged: number; awaitingRack: number; problemsReported: number;
  isolation?: number; isolationTooLong?: number; isolationMaxWaitHours?: number; runningWithBlockedCavities?: number;
}

export interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string | null; entityLabel: string;
  actor: { id: string | null; name: string }; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string; createdAt: string;
}

export interface MouldInput {
  toolType?: ToolType;
  toolId?: string; toolSetCount?: string; size?: string; owner?: string | null; capableMachines?: string[]; shotsToService?: number | null; notes?: string;
}
export type ItemInput = Partial<Omit<Item, 'id' | 'images'>> & { itemId?: string; photo?: string };
export interface MoveInput {
  outOfServiceDetails?: Pick<DispatchDetails, "recipientName" | "address" | "repairDetails">;
  to: Location; machineId?: string; rackId?: string; status?: MouldStatus; remarks?: string; overrideReason?: string; version?: number; intendedDestination?: Location | null;
}

export type WorkType = 'REPAIR' | 'SERVICE' | 'MINOR_FIX' | 'INSPECTION' | 'CLEANING' | 'OTHER' | 'CAVITY_BLOCK' | 'CAVITY_RESTORE';
// Types a person picks in the work log form; cavity entries come from "Run with blocked cavities".
export const WORK_TYPES: WorkType[] = ['REPAIR', 'SERVICE', 'MINOR_FIX', 'INSPECTION', 'CLEANING', 'OTHER'];
export const REPORT_WORK_TYPES: WorkType[] = [...WORK_TYPES, 'CAVITY_BLOCK', 'CAVITY_RESTORE'];
// ---- Catalog & Totals ----
export type Process = 'INJECTION' | 'EXTRUSION';
export interface CatalogTotals { moulds: number; uniqueItems: number; itemsPerMouldAvg: number; itemsPerMouldMax: number; mouldsWithMultipleItems: number; itemsInMultipleMoulds: number }
export type CatalogSummary = Record<'all' | Process, CatalogTotals>;
export interface CatalogChip { value: string | null; label: string | null; count: number }
export interface CatalogMould { id: string; toolId: string; process: Process; owner: string | null; capableMachines: string[]; cavities: number; itemCount: number; status: MouldStatus; location: Location; materials: string[] }
export interface CatalogProduct { itemId: string; description: string; thumbUrl: string | null; materialId: string | null; materialDescription: string | null; masterbatchId: string | null; qas: string | null; family: string; processes: Process[]; mouldCount: number; moulds: { id: string; toolId: string }[] }
export interface CatalogFilter { tab: 'moulds' | 'products'; process?: Process; status?: string; owner?: string; machine?: string; material?: string; family?: string; q?: string; sort?: string; page?: number }
export interface CatalogList<T> { total: number; pageSize: number; rows: T[]; breakdown: Record<string, CatalogChip[]> }
export interface CatalogProductDetail { itemId: string; description: string; materialId: string | null; masterbatchId: string | null; qas: string | null; images: ItemImage[]; moulds: { id: string; toolId: string; status: MouldStatus; process: Process; owner: string | null; cavities: number | null }[] }
export interface DowntimePeriod { from: string; to: string | null; cavities: number[]; reason: string; by: string | null }
export type WorkOutcome = 'OK' | 'NEEDS_REPAIR' | 'NEEDS_SERVICE';
export interface Person { id: string; name: string; role: Role }
export interface PrivatePerson { id: null; name: string; role: null }
export interface WorkLog {
  id: string; mouldId: string; toolId: string; type: WorkType; description: string; partsUsed: string; timeSpentMinutes: number | null;
  doneBy: (Person | PrivatePerson)[]; recordedBy: Person | PrivatePerson; doneAt: string; location: Location; machineCode: string | null; rackLocationId: string | null;
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
