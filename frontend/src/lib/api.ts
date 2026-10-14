import type { MachineInfo, Movement, Role, Tool, ToolInput, User } from "./types";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';

export type PasskeyInfo = { id: string; name: string; createdAt: string; lastUsedAt?: string };

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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
  if (!res.ok) throw new ApiError(res.status, data.message || "Request failed");
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<{ user: User }>("/auth/login", "POST", { email, password }),
  logout: () => request<unknown>("/auth/logout", "POST"),
  me: () => request<{ user: User }>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) => request<unknown>("/auth/password", "POST", { currentPassword, newPassword }),
  passkeyCapabilities: () => request<{ enabled: boolean }>('/auth/passkeys/capabilities'),
  passkeys: () => request<{ passkeys: PasskeyInfo[] }>('/auth/passkeys'),
  passkeyRegistrationOptions: (currentPassword: string, name: string) => request<{ options: PublicKeyCredentialCreationOptionsJSON }>('/auth/passkeys/register/options', 'POST', { currentPassword, name }),
  passkeyRegistrationVerify: (response: RegistrationResponseJSON) => request<unknown>('/auth/passkeys/register/verify', 'POST', { response }),
  passkeyLoginOptions: () => request<{ options: PublicKeyCredentialRequestOptionsJSON }>('/auth/passkeys/login/options', 'POST'),
  passkeyLoginVerify: (response: AuthenticationResponseJSON) => request<{ user: User }>('/auth/passkeys/login/verify', 'POST', { response }),
  removePasskey: (id: string, currentPassword: string) => request<unknown>(`/auth/passkeys/${id}`, 'DELETE', { currentPassword }),

  tools: () => request<{ tools: Tool[] }>("/tools"),
  createTool: (input: ToolInput) => request<{ tool: Tool }>("/tools", "POST", input),
  updateTool: (id: string, input: ToolInput, version: number) => request<{ tool: Tool }>(`/tools/${id}`, "PATCH", { ...input, version }),
  assignTool: (id: string, machineName: string) => request<{ tool: Tool }>(`/tools/${id}/assign`, "POST", { machineName }),
  returnTool: (id: string) => request<{ tool: Tool }>(`/tools/${id}/return`, "POST"),
  takeOutTool: (id: string, note: string) => request<{ tool: Tool }>(`/tools/${id}/taken-out`, "POST", { note }),
  deleteTool: (id: string) => request<unknown>(`/tools/${id}`, "DELETE"),
  history: (id: string) => request<{ history: Movement[] }>(`/tools/${id}/history`),

  machines: () => request<{ machines: MachineInfo[] }>("/machines"),

  users: () => request<{ users: User[] }>("/users"),
  createUser: (u: { name: string; email: string; password: string; role: Role }) => request<{ user: User }>("/users", "POST", u),
  updateUser: (id: string, patch: { role?: Role; active?: boolean; password?: string }) => request<{ user: User }>(`/users/${id}`, "PATCH", patch),
};
