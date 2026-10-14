export type Role = 'admin' | 'operator' | 'viewer';
export type Status = 'store' | 'machine' | 'taken';

export interface User { id: string; name: string; email: string; role: Role; active: boolean }
export interface Product { pid: string; desc: string; cav: number }
export interface MachineRef { id: string; code: string; name: string }

export interface Tool {
  id: string;
  toolCode: string;
  size: string;
  status: Status;
  machine: MachineRef | null;
  takenAt: string | null;
  takenNote: string;
  notes: string;
  products: Product[];
  version: number;
}

export interface ToolInput { toolCode: string; size: string; products: Product[] }
export interface MachineInfo extends MachineRef { toolCode: string | null }

export interface Movement {
  id: string;
  action: 'created' | 'edited' | 'assigned' | 'returned' | 'taken_out' | 'deleted';
  toStatus: Status | null;
  toMachine: MachineRef | null;
  note: string;
  by: { name: string; email: string } | null;
  createdAt: string;
}
