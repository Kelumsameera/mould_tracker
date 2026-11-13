// General settings: thresholds & limits, master-data lists, dashboard cards and UI text overrides.
// Every value has a built-in default (= what the app did before); the database only stores changes.
// Cached in memory, re-read after every change and every 30 s (other processes). Rules: no hard-coded list,
// label, limit or rule in new features — add it here (see CLAUDE.md).

const RECHECK_MS = 30_000;

// key -> { type, default, min?, max?, group, affects }
export const SETTINGS = {
  "limits.maxItemImages": { type: "int", default: 5, min: 1, max: 20, group: "limits", affects: "Pictures per item (mould form, picture upload)" },
  "limits.imageMaxPx": { type: "int", default: 800, min: 200, max: 4000, group: "limits", affects: "Stored picture size in pixels (longest side)" },
  "limits.imageQuality": { type: "int", default: 80, min: 30, max: 100, group: "limits", affects: "Stored picture quality (WebP)" },
  "limits.exportRowCap": { type: "int", default: 5000, min: 100, max: 100000, group: "limits", affects: "Rows per export (Catalog, Work log report)" },
  "limits.pageSize": { type: "int", default: 20, min: 5, max: 200, group: "limits", affects: "Rows per page (Catalog)" },
  "limits.shotsWarnPercent": { type: "int", default: 90, min: 50, max: 100, group: "limits", affects: "'Service soon' badge when shots reach this % of shots-to-service" },
  "ui.refreshSeconds": { type: "int", default: 10, min: 5, max: 300, group: "limits", affects: "Auto-refresh of lists (Find, Workshop, Isolation …)" },
  "auth.sessionHours": { type: "int", default: 168, min: 1, max: 720, group: "limits", affects: "How long a sign-in lasts (new sign-ins; default = JWT_EXPIRES_IN or 7 days)" },
  "auth.passwordMinLength": { type: "int", default: 8, min: 8, max: 64, group: "limits", affects: "Minimum password length (new passwords)" },
  "search.typoTolerance": { type: "bool", default: true, group: "limits", affects: "'Did you mean …?' suggestions" },
  "search.recentCount": { type: "int", default: 6, min: 0, max: 20, group: "limits", affects: "Recent searches remembered per device" },
  "dashboard.cards": { type: "dashboard", default: {}, group: "dashboards", affects: "Dashboard cards per role (missing role = all cards)" }
};
export const DASHBOARD_CARDS = ["total", "limited", "isolationTooLong", "serviceDue", "workThisMonth", "byLocation", "byStatus"];

const L = (key, en, si) => ({ key, labels: { en, si }, active: true });
// Master-data lists with their built-in items (keys are what records store; labels are editable).
export const LISTS = {
  workTypes: { builtIn: true, default: [L("REPAIR", "Repair", "අලුත්වැඩියාව"), L("SERVICE", "Service", "Service"), L("MINOR_FIX", "Minor fix", "සුළු සකස් කිරීම"), L("INSPECTION", "Inspection", "පරීක්ෂාව"), L("CLEANING", "Cleaning", "පිරිසිදු කිරීම"), L("OTHER", "Other", "වෙනත්")] },
  outcomes: { builtIn: true, default: [L("OK", "Mould is OK", "Mould එක හොඳයි"), L("NEEDS_REPAIR", "Needs repair", "අලුත්වැඩියා කළ යුතුයි"), L("NEEDS_SERVICE", "Needs service", "Service කළ යුතුයි")] },
  problemTypes: { builtIn: false, default: [L("CRACK", "Crack", "ඉරිතැලීම"), L("FLASH", "Flash", "Flash"), L("CORE_PIN", "Core pin", "Core pin"), L("COOLING", "Cooling", "සිසිලනය")] },
  remarkTemplates: { builtIn: false, default: [L("ROUTINE_SERVICE", "Routine service after shot limit", "Shot සීමාවෙන් පසු සාමාන්‍ය service"), L("REPAIR_DAMAGE", "Repair of reported damage", "වාර්තා කළ හානිය අලුත්වැඩියාව"), L("TRIAL_MACHINE", "Trial on another machine", "වෙනත් machine එකක අත්හදා බැලීම")] },
  owners: { builtIn: false, default: [L("FLK", "FLK", "FLK"), L("CCI", "CCI", "CCI")] },
  processes: { builtIn: true, default: [L("INJECTION", "Injection", "Injection"), L("EXTRUSION", "Extrusion", "Extrusion")] },
  families: { builtIn: false, default: [L("GP", "GP", "GP"), L("CP", "CP", "CP")] }
};

// ---- Validation (pure) ----
export function validateSetting(key, value) {
  const def = SETTINGS[key];
  if (!def) return "Unknown setting";
  if (def.type === "int") {
    if (!Number.isInteger(value)) return "Enter a whole number";
    if (value < def.min || value > def.max) return `Enter a number from ${def.min} to ${def.max}`;
  }
  if (def.type === "bool" && typeof value !== "boolean") return "Choose yes or no";
  if (def.type === "dashboard") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "Invalid dashboard layout";
    for (const cards of Object.values(value)) {
      if (!Array.isArray(cards) || cards.some((c) => !DASHBOARD_CARDS.includes(c)) || new Set(cards).size !== cards.length) return "Unknown or repeated dashboard card";
    }
  }
  return null;
}
const LIST_KEY = /^[A-Z0-9][A-Z0-9_]{0,39}$/;
// `used`: keys that records already store (they may be disabled, not removed).
export function validateList(list, items, used = []) {
  const def = LISTS[list];
  if (!def) return ["Unknown list"];
  const errors = [];
  if (!Array.isArray(items) || items.length > 200) return ["Invalid list"];
  const keys = new Set();
  for (const it of items) {
    if (!LIST_KEY.test(String(it?.key ?? ""))) errors.push(`"${it?.key}" is not a valid key (capital letters, numbers, _)`);
    if (keys.has(it.key)) errors.push(`"${it.key}" is listed twice`);
    keys.add(it.key);
    if (!String(it?.labels?.en ?? "").trim() || !String(it?.labels?.si ?? "").trim()) errors.push(`"${it.key}" needs an English and a Sinhala label`);
  }
  if (def.builtIn) for (const d of def.default) if (!keys.has(d.key)) errors.push(`Built-in item "${d.key}" cannot be removed; disable it instead`);
  for (const k of used) if (!keys.has(k)) errors.push(`"${k}" is used in records; disable it instead of removing it`);
  if (!items.some((i) => i.active !== false) && def.builtIn) errors.push("At least one item must stay active");
  return errors;
}
export function validateText(key, value) {
  if (!/^[a-zA-Z0-9_.]{1,120}$/.test(key)) return "Invalid text key";
  for (const lang of ["en", "si"]) {
    const v = value?.[lang];
    if (v != null && (typeof v !== "string" || v.length > 2000)) return "Texts must be at most 2000 characters";
  }
  return null;
}

// ---- Cache ----
let cache = null;
let loadedAt = 0;
let loader = defaultLoader;
async function defaultLoader() {
  const mongoose = (await import("mongoose")).default;
  if (mongoose.connection.readyState !== 1) return undefined;
  const { default: Setting } = await import("../models/Setting.js");
  return Setting.find({}).lean();
}
export function setSettingsLoader(fn) {
  loader = fn ?? defaultLoader;
  cache = null;
  loadedAt = 0;
}
function shape(rows) {
  const values = Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.default]));
  const lists = Object.fromEntries(Object.entries(LISTS).map(([k, d]) => [k, d.default.map((x) => ({ ...x }))]));
  const texts = { en: {}, si: {} };
  for (const r of rows || []) {
    if (r.kind === "setting" && SETTINGS[r.key] && validateSetting(r.key, r.value) === null) values[r.key] = r.value;
    if (r.kind === "list" && LISTS[r.key] && Array.isArray(r.value)) lists[r.key] = r.value;
    if (r.kind === "text") for (const lang of ["en", "si"]) if (typeof r.value?.[lang] === "string" && r.value[lang].trim()) texts[lang][r.key] = r.value[lang];
  }
  return { values, lists, texts, rows: rows || [] };
}
export async function refreshSettings() {
  try {
    const rows = await loader();
    if (rows !== undefined) { cache = shape(rows); await registerListKeys(cache); }
  } catch {
    /* keep the last good settings */
  } finally {
    loadedAt = Date.now();
  }
  return cache ?? shape([]);
}
export const invalidateSettings = () => { loadedAt = 0; return refreshSettings(); };
export function currentSettings() {
  if (!cache) cache = shape([]);
  if (Date.now() - loadedAt > RECHECK_MS) void refreshSettings();
  return cache;
}
// Typed getters used by the rules.
export const setting = (key) => currentSettings().values[key] ?? SETTINGS[key]?.default;
export const listItems = (list, { activeOnly = false } = {}) => (currentSettings().lists[list] || []).filter((x) => !activeOnly || x.active !== false);
export const listKeys = (list, opts) => listItems(list, opts).map((x) => x.key);

// Work types / outcomes added in Settings are accepted by the WorkLog model (keys are only ever added).
async function registerListKeys(state) {
  const { default: WorkLog } = await import("../models/WorkLog.js");
  for (const [path, list] of [["type", "workTypes"], ["outcome", "outcomes"]]) {
    const type = WorkLog.schema.path(path);
    const missing = (state.lists[list] || []).map((x) => x.key).filter((k) => !type.enumValues.includes(k));
    if (missing.length) type.enum(...missing);
  }
}
