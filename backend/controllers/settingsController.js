// General settings API (Settings screen). Reading: settings.manage or config.manage; changing: settings.manage
// (System Administrator always; grantable via Access Control). Changes apply immediately (no draft), each one
// audited with before/after; invalid values are refused with a clear message; reset = back to the default.
import Setting from "../models/Setting.js";
import WorkLog from "../models/WorkLog.js";
import Mould from "../models/Mould.js";
import { audit } from "../lib/audit.js";
import { DASHBOARD_CARDS, LISTS, SETTINGS, currentSettings, invalidateSettings, validateList, validateSetting, validateText } from "../lib/settings.js";
import { fail } from "../utils/ApiError.js";

const modified = (kind, key) => currentSettings().rows.some((r) => r.kind === kind && r.key === key);

// GET /api/settings - every setting with its default, current value and what it affects.
export async function listSettings(req, res) {
  const state = currentSettings();
  res.json({
    success: true,
    settings: Object.entries(SETTINGS).map(([key, d]) => ({ key, type: d.type, group: d.group, default: d.default, value: state.values[key], min: d.min ?? null, max: d.max ?? null, affects: d.affects, modified: modified("setting", key) })),
    lists: Object.entries(LISTS).map(([key, d]) => ({ key, builtIn: d.builtIn, default: d.default, items: state.lists[key], modified: modified("list", key) })),
    texts: state.texts,
    dashboardCards: DASHBOARD_CARDS
  });
}

async function store(req, kind, key, value, action) {
  const before = currentSettings().rows.find((r) => r.kind === kind && r.key === key)?.value ?? null;
  await Setting.findOneAndUpdate({ kind, key }, { $set: { value, updatedBy: req.user._id } }, { upsert: true, new: true });
  await invalidateSettings();
  await audit(req, { action, entityType: "Setting", entityLabel: `${kind}:${key}`, before: { value: before }, after: { value }, reason: req.body?.reason || "" });
}
async function reset(req, kind, key, action) {
  const before = currentSettings().rows.find((r) => r.kind === kind && r.key === key)?.value ?? null;
  await Setting.deleteOne({ kind, key });
  await invalidateSettings();
  await audit(req, { action, entityType: "Setting", entityLabel: `${kind}:${key}`, before: { value: before }, after: { value: "default" } });
}

// PUT /api/settings/values/:key { value }
export async function putSetting(req, res) {
  const { key } = req.params;
  const error = validateSetting(key, req.body.value);
  if (error) fail(400, "INVALID_SETTING", error, { key });
  await store(req, "setting", key, req.body.value, "setting.updated");
  res.json({ success: true, value: currentSettings().values[key] });
}
export async function resetSetting(req, res) {
  if (!SETTINGS[req.params.key]) fail(404, "NOT_FOUND", "Unknown setting");
  await reset(req, "setting", req.params.key, "setting.reset");
  res.json({ success: true, value: currentSettings().values[req.params.key] });
}

// Keys that records already store, per list (may be disabled, not removed).
async function usedKeys(list) {
  if (list === "workTypes") return (await WorkLog.distinct("type")).filter((k) => !String(k).startsWith("CAVITY_"));
  if (list === "outcomes") return (await WorkLog.distinct("outcome")).filter(Boolean);
  if (list === "owners") return (await Mould.distinct("owner")).filter(Boolean);
  return [];
}
// PUT /api/settings/lists/:list { items }
export async function putList(req, res) {
  const { list } = req.params;
  const items = req.body.items.map((x, i) => ({ key: x.key, labels: { en: x.labels.en.trim(), si: x.labels.si.trim() }, active: x.active !== false, sortOrder: x.sortOrder ?? (i + 1) * 10 }));
  const errors = validateList(list, items, await usedKeys(list));
  if (errors.length) fail(400, "INVALID_LIST", errors[0], { errors });
  await store(req, "list", list, items, "setting.list.updated");
  res.json({ success: true, items: currentSettings().lists[list] });
}
export async function resetList(req, res) {
  if (!LISTS[req.params.list]) fail(404, "NOT_FOUND", "Unknown list");
  const used = await usedKeys(req.params.list);
  const defaults = LISTS[req.params.list].default.map((x) => x.key);
  if (used.some((k) => !defaults.includes(k))) fail(400, "INVALID_LIST", "Some added items are used in records; disable them instead of resetting the list");
  await reset(req, "list", req.params.list, "setting.list.reset");
  res.json({ success: true, items: currentSettings().lists[req.params.list] });
}

// PUT /api/settings/texts/:key { en?, si? }  (empty = no override for that language)
export async function putText(req, res) {
  const { key } = req.params;
  const value = { en: req.body.en?.trim() || undefined, si: req.body.si?.trim() || undefined };
  const error = validateText(key, value);
  if (error) fail(400, "INVALID_TEXT", error);
  if (!value.en && !value.si) await reset(req, "text", key, "setting.text.reset");
  else await store(req, "text", key, value, "setting.text.updated");
  res.json({ success: true, texts: currentSettings().texts });
}
export async function resetText(req, res) {
  await reset(req, "text", req.params.key, "setting.text.reset");
  res.json({ success: true, texts: currentSettings().texts });
}
// GET /api/settings/texts/export, POST /api/settings/texts/import { texts: { key: { en, si } } }
export async function exportTexts(req, res) {
  const { en, si } = currentSettings().texts;
  const keys = [...new Set([...Object.keys(en), ...Object.keys(si)])].sort();
  res.set("Content-Disposition", 'attachment; filename="text-overrides.json"');
  res.json({ format: "mould-tracker-texts", texts: Object.fromEntries(keys.map((k) => [k, { en: en[k], si: si[k] }])) });
}
export async function importTexts(req, res) {
  const entries = Object.entries(req.body.texts);
  for (const [key, value] of entries) { const e = validateText(key, value); if (e) fail(400, "INVALID_TEXT", `${key}: ${e}`); }
  for (const [key, value] of entries) {
    if (value.en?.trim() || value.si?.trim()) await Setting.findOneAndUpdate({ kind: "text", key }, { $set: { value: { en: value.en?.trim() || undefined, si: value.si?.trim() || undefined }, updatedBy: req.user._id } }, { upsert: true });
  }
  await invalidateSettings();
  await audit(req, { action: "setting.texts.imported", entityType: "Setting", entityLabel: "texts", after: { count: entries.length } });
  res.json({ success: true, texts: currentSettings().texts });
}
