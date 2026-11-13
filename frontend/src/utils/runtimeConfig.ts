// The published workflow config and general settings, as served by GET /api/config. AppLayout loads it after
// sign-in and on every session refresh, then calls setRuntime(); everything below reads from here so labels,
// lists, colours and move rules match the server. Before it loads, the built-in fallbacks keep the app usable.
import type { Lang } from "./i18n";

export type Labels = { en: string; si: string };
export interface ConfigLocation {
  key: string; labels: Labels; kind: "machine" | "rack" | "simple" | "transit"; active?: boolean; sortOrder?: number; icon?: string; color?: string;
  permission?: string; storage?: boolean; toolTypes?: string[]; external?: boolean; acceptsStatus?: boolean; statusChange?: boolean;
  allowNewMoulds?: boolean; maxWaitHours?: number; capacity?: number | null;
}
export interface ConfigStatus {
  key: string; labels: Labels; active?: boolean; sortOrder?: number; color?: string; isGood?: boolean; needsAttention?: boolean; countsAsAvailable?: boolean;
  limitedRun?: boolean; resetsShotsWhenGood?: boolean; hint?: Labels; allowedLocations: string[] | "any"; moveTo: string[] | "any"; onArrival?: Record<string, string>;
}
export interface ConfigTransition { from: string | null; to: string; allowed?: boolean; via?: string | null; permissions?: string[][]; requires?: string[] }
export interface ConfigRole { key: string; labels: Labels; builtIn?: boolean; active?: boolean; locked?: boolean; permissions?: string[]; assignable?: string[]; sortOrder?: number }
export interface WorkflowConfig {
  version: number; locations: ConfigLocation[]; statuses: ConfigStatus[]; transitions: ConfigTransition[]; roles: ConfigRole[];
  intendedDestinations: string[]; limitedRunAlertDays: number;
}
export interface RuntimeBundle {
  config: WorkflowConfig | null;
  permissions: string[];
  assignableRoles: string[];
  settings: Record<string, unknown>;
  texts: Record<Lang, Record<string, string>>;
  lists: Record<string, { key: string; labels: Labels; active?: boolean; sortOrder?: number }[]>;
}

let bundle: RuntimeBundle = { config: null, permissions: [], assignableRoles: [], settings: {}, texts: { en: {}, si: {} }, lists: {} };
let language: Lang = "en";
export const setRuntime = (next: RuntimeBundle | null, lang: Lang) => {
  if (next) bundle = next;
  language = lang;
};
export const runtime = () => bundle;
export const currentConfig = () => bundle.config;

const pick = (labels: Labels | undefined) => (labels ? labels[language] || labels.en : undefined);
const byOrder = <T extends { sortOrder?: number }>(a: T, b: T) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

export const configLocation = (key: string | null | undefined) => bundle.config?.locations.find((l) => l.key === key) ?? null;
export const configStatus = (key: string | null | undefined) => bundle.config?.statuses.find((s) => s.key === key) ?? null;
export const locationLabel = (key: string | null | undefined) => pick(configLocation(key)?.labels);
export const statusLabel = (key: string | null | undefined) => pick(configStatus(key)?.labels);
export const statusHintText = (key: string | null | undefined) => pick(configStatus(key)?.hint);
export const roleLabel = (key: string | null | undefined) => pick(bundle.config?.roles.find((r) => r.key === key)?.labels);
export const listLabel = (list: string, key: string | null | undefined) => pick(bundle.lists[list]?.find((x) => x.key === key)?.labels);

// Active locations / statuses in display order (null until the config has loaded).
export const activeLocations = () => bundle.config ? bundle.config.locations.filter((l) => l.active !== false).sort(byOrder) : null;
export const activeStatuses = () => bundle.config ? bundle.config.statuses.filter((s) => s.active !== false).sort(byOrder) : null;
export const activeRoles = () => bundle.config ? bundle.config.roles.filter((r) => r.active !== false).sort(byOrder) : null;
export const activeList = (list: string) => (bundle.lists[list] || []).filter((x) => x.active !== false).sort(byOrder);

export const transitionOf = (from: string | null | undefined, to: string) =>
  bundle.config?.transitions.find((t) => (t.from ?? null) === (from ?? null) && t.to === to) ?? null;

// A general setting (thresholds, limits …) with the built-in default as fallback.
export function setting<T>(key: string, fallback: T): T {
  const v = bundle.settings[key];
  return v === undefined || v === null ? fallback : (v as T);
}

// Location / status keys for lists and chips: the config order, or the built-in lists before it loads.
export const locationKeys = <T extends string>(fallback: readonly T[]): T[] => (activeLocations()?.map((l) => l.key as T) ?? [...fallback]);
export const statusKeys = <T extends string>(fallback: readonly T[]): T[] => (activeStatuses()?.map((s) => s.key as T) ?? [...fallback]);

// Auto-refresh interval of lists (Settings > Thresholds & limits: ui.refreshSeconds).
export const refreshMs = () => Math.max(5, Number(setting("ui.refreshSeconds", 10))) * 1000;
