import type { AuditEntry, ItemInput, Machine, Mould, MouldInput, MoveInput, Movement, Person, Rack, Role, Stats, User, WorkFilter, WorkLog, WorkLogInput, WorkSummary, Zone } from "./types";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';

export type PasskeyInfo = { id: string; name: string; createdAt: string; lastUsedAt?: string };

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  details: Record<string, unknown>;
  constructor(status: number, message: string, code?: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Full URL for a server path such as an item picture ("/uploads/items/x.webp").
export const assetUrl = (path: string | null | undefined) => (path ? BASE + path : '');
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message || "Request failed", data.code, data.details || {});
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<{ user: User }>("/auth/login", "POST", { email, password }),
  logout: () => request<unknown>("/auth/logout", "POST"),
  me: () => request<{ user: User }>("/auth/me"),
  updateProfile: (input: { name: string; email: string; currentPassword: string; newPassword?: string }) => request<{ user: User }>("/auth/me", "PATCH", input),
  changePassword: (currentPassword: string, newPassword: string) => request<unknown>("/auth/password", "POST", { currentPassword, newPassword }),
  passkeyCapabilities: () => request<{ enabled: boolean }>('/auth/passkeys/capabilities'),
  passkeys: () => request<{ passkeys: PasskeyInfo[] }>('/auth/passkeys'),
  passkeyRegistrationOptions: (currentPassword: string, name: string) => request<{ options: PublicKeyCredentialCreationOptionsJSON }>('/auth/passkeys/register/options', 'POST', { currentPassword, name }),
  passkeyRegistrationVerify: (response: RegistrationResponseJSON) => request<unknown>('/auth/passkeys/register/verify', 'POST', { response }),
  passkeyLoginOptions: () => request<{ options: PublicKeyCredentialRequestOptionsJSON }>('/auth/passkeys/login/options', 'POST'),
  passkeyLoginVerify: (response: AuthenticationResponseJSON) => request<{ user: User }>('/auth/passkeys/login/verify', 'POST', { response }),
  removePasskey: (id: string, currentPassword: string) => request<unknown>(`/auth/passkeys/${id}`, 'DELETE', { currentPassword }),

  setLanguage: (language: 'en' | 'si') => request<{ user: User }>("/auth/me/language", "PATCH", { language }),

  moulds: (filter: { q?: string; location?: string; status?: string; owner?: string; zone?: string; awaitingRack?: boolean; needsService?: boolean; problem?: boolean; deleted?: boolean } = {}) =>
    request<{ moulds: Mould[] }>(`/moulds${qs(filter)}`),
  stats: () => request<{ stats: Stats }>("/moulds/stats"),
  mould: (id: string) => request<{ mould: Mould }>(`/moulds/${id}`),
  history: (id: string) => request<{ history: Movement[] }>(`/moulds/${id}/history`),
  createMould: (input: MouldInput & { toolId: string; location: string; rackId?: string; items: ItemInput[] }) => request<{ mould: Mould }>("/moulds", "POST", input),
  updateMould: (id: string, input: MouldInput, version: number) => request<{ mould: Mould }>(`/moulds/${id}`, "PATCH", { ...input, version }),
  deleteMould: (id: string, reason: string) => request<unknown>(`/moulds/${id}`, "DELETE", { reason }),
  restoreMould: (id: string) => request<{ mould: Mould }>(`/moulds/${id}/restore`, "POST"),
  move: (id: string, input: MoveInput) => request<{ mould: Mould; warnings: string[] }>(`/moulds/${id}/move`, "POST", input),
  setStatus: (id: string, status: string, remarks: string, version: number) => request<{ mould: Mould }>(`/moulds/${id}/status`, "POST", { status, remarks, version }),
  recordShots: (id: string, shots: number, version: number) => request<{ mould: Mould }>(`/moulds/${id}/shots`, "POST", { shots, version }),
  addItem: (id: string, item: ItemInput) => request<{ mould: Mould }>(`/moulds/${id}/items`, "POST", item),
  updateItem: (id: string, itemId: string, item: ItemInput) => request<{ mould: Mould }>(`/moulds/${id}/items/${itemId}`, "PATCH", item),
  deleteItem: (id: string, itemId: string) => request<{ mould: Mould }>(`/moulds/${id}/items/${itemId}`, "DELETE", {}),

  machines: () => request<{ machines: Machine[] }>("/machines"),

  racks: (zone?: string) => request<{ zones: Zone[]; awaitingRack: { id: string; toolId: string; status: string; owner: string | null }[] }>(`/racks${qs({ zone })}`),
  rack: (id: string) => request<{ rack: Rack }>(`/racks/${id}`),
  createZone: (z: { code: string; name: string; sortOrder?: number }) => request<unknown>("/racks/zones", "POST", z),
  updateZone: (id: string, z: { code?: string; name?: string; active?: boolean; sortOrder?: number }) => request<unknown>(`/racks/zones/${id}`, "PATCH", z),
  deleteZone: (id: string) => request<unknown>(`/racks/zones/${id}`, "DELETE", {}),
  bulkRacks: (b: { zone: string; rowFrom: string; rowTo: string; from: number; to: number; capacity: number | null; preview: boolean }) =>
    request<{ create: string[]; revive: string[]; existing: string[] }>("/racks/bulk", "POST", b),
  createRack: (r: { zone: string; row: string; number: number; capacity: number | null; note: string }) => request<{ rack: Rack }>("/racks", "POST", r),
  updateRack: (id: string, r: { row?: string; number?: number; capacity?: number | null; active?: boolean; note?: string }) => request<{ rack: Rack }>(`/racks/${id}`, "PATCH", r),
  deleteRack: (id: string) => request<unknown>(`/racks/${id}`, "DELETE", {}),
  removeRow: (zone: string, row: string) => request<{ removed: string[] }>("/racks/remove-row", "POST", { zone, row }),

  workLogs: (mouldId: string) => request<{ workLogs: WorkLog[] }>(`/moulds/${mouldId}/worklogs`),
  createWorkLog: (mouldId: string, input: WorkLogInput) => request<{ workLog: WorkLog; warnings: string[] }>(`/moulds/${mouldId}/worklogs`, "POST", input),
  reportProblem: (mouldId: string, input: { description: string; photos?: string[]; version?: number }) => request<{ workLog: WorkLog }>(`/moulds/${mouldId}/problems`, "POST", input),
  workers: () => request<{ workers: Person[] }>("/worklogs/workers"),
  workReport: (f: WorkFilter) => request<{ total: number; workLogs: WorkLog[] }>(`/worklogs${qs({ ...f })}`),
  workSummary: (f: WorkFilter) => request<WorkSummary>(`/worklogs/summary${qs({ ...f, page: undefined, limit: undefined })}`),
  // Downloads the export with the session cookie and hands it to the browser as a file.
  downloadWorkLogs: async (f: WorkFilter, format: "csv" | "xlsx") => {
    const res = await fetch(`${BASE}/worklogs/export${qs({ ...f, page: undefined, limit: undefined, format })}`, { credentials: "include" });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new ApiError(res.status, data.message || "Export failed", data.code, data.details || {}); }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || `work-log.${format}`;
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },

  audit: (f: { entityType?: string; page?: number; limit?: number }) => request<{ total: number; entries: AuditEntry[] }>(`/audit${qs(f)}`),

  users: () => request<{ users: User[] }>("/users"),
  createUser: (u: { name: string; email: string; password: string; role: Role }) => request<{ user: User }>("/users", "POST", u),
  updateUser: (id: string, patch: { name?: string; email?: string; role?: Role; active?: boolean; password?: string }) => request<{ user: User }>(`/users/${id}`, "PATCH", patch),
  deleteUser: (id: string) => request<unknown>(`/users/${id}`, "DELETE", {}),
};
