// Workflow config API: read (everyone signed in), draft/publish/rollback/import/export (System Administrator,
// config.manage), simulate (shares evaluateMove with the move endpoints). Every change is audited with a diff.
import WorkflowConfig from "../models/WorkflowConfig.js";
import Mould from "../models/Mould.js";
import Movement from "../models/Movement.js";
import User from "../models/User.js";
import { audit } from "../lib/audit.js";
import { builtInConfig, getConfig, invalidateConfig } from "../lib/configStore.js";
import { evaluateMove } from "../lib/evaluateMove.js";
import { allPermissionKeys, assignableFor, can } from "../lib/permissions.js";
import { configContent, diffConfigs, validateConfig } from "../lib/workflowValidation.js";
import { fail } from "../utils/ApiError.js";
import { currentSettings } from "../lib/settings.js";

const meta = (d) => ({ version: d.version, state: d.state, reason: d.reason || "", basedOn: d.basedOn ?? null, publishedAt: d.publishedAt ?? null, createdAt: d.createdAt ?? null, updatedAt: d.updatedAt ?? null });
const published = async () => WorkflowConfig.findOne({ state: "published" }).sort({ version: -1 }).lean();
const nextVersion = async () => ((await WorkflowConfig.findOne({}, { version: 1 }).sort({ version: -1 }).lean())?.version ?? 0) + 1;

// Keys that records already use: they may be disabled but not removed from a config.
async function usage() {
  const [ml, ms, fl, tl, ts, roles] = await Promise.all([
    Mould.distinct("location"), Mould.distinct("status"), Movement.distinct("fromLocation"), Movement.distinct("toLocation"), Movement.distinct("toStatus"), User.distinct("role", { deletedAt: null })
  ]);
  const legacy = new Set(["RUNNING_LIMITED"]);
  return { usedLocations: [...new Set([...ml, ...fl, ...tl])].filter(Boolean), usedStatuses: [...new Set([...ms, ...ts])].filter((s) => s && !legacy.has(s)), usedRoles: [...new Set(roles)] };
}

// GET /api/config - the config every screen reads (published, or the built-in default).
export async function getPublishedConfig(req, res) {
  const config = getConfig();
  const { values, texts, lists } = currentSettings();
  res.json({ success: true, config: { version: config.version, ...configContent(config) }, permissions: allPermissionKeys(), assignableRoles: assignableFor(req.user.role), settings: values, texts, lists });
}

// GET /api/config/versions - history (newest first).
export async function listVersions(req, res) {
  const docs = await WorkflowConfig.find({}, { version: 1, state: 1, reason: 1, basedOn: 1, publishedAt: 1, createdAt: 1, updatedAt: 1 }).sort({ version: -1 }).limit(200).lean();
  res.json({ success: true, current: getConfig().version, versions: docs.map(meta) });
}

// GET /api/config/versions/:version (or "draft") - full content.
export async function getVersion(req, res) {
  const doc = req.params.version === "draft" ? await WorkflowConfig.findOne({ state: "draft" }).lean() : await WorkflowConfig.findOne({ version: Number(req.params.version) }).lean();
  if (!doc) fail(404, "NOT_FOUND", "Version not found");
  res.json({ success: true, meta: meta(doc), config: configContent(doc) });
}

// PUT /api/config/draft { config, basedOn? } - create or replace the single draft (validated on publish; problems listed now).
export async function saveDraft(req, res) {
  const content = configContent(req.body.config);
  const base = (await published()) ?? { version: 0, ...builtInConfig() };
  const existing = await WorkflowConfig.findOne({ state: "draft" });
  if (existing && req.body.draftVersion !== undefined && existing.version !== req.body.draftVersion) fail(409, "STALE_CONFIG", "Someone else changed the draft meanwhile. Reload it.");
  let draft;
  if (existing) {
    Object.assign(existing, content, { updatedAt: new Date() });
    for (const k of Object.keys(content)) existing.markModified(k);
    draft = await existing.save();
  } else {
    draft = await WorkflowConfig.create({ ...content, version: await nextVersion(), state: "draft", basedOn: base.version, createdBy: req.user._id });
  }
  await audit(req, { action: "workflow.draft.saved", entityType: "WorkflowConfig", entityLabel: `v${draft.version} (draft)`, after: { diff: diffConfigs(configContent(base), content) } });
  res.json({ success: true, meta: meta(draft), problems: validateConfig(content, await usage()) });
}

// DELETE /api/config/draft - discard the draft.
export async function discardDraft(req, res) {
  const draft = await WorkflowConfig.findOne({ state: "draft" });
  if (!draft) fail(404, "NOT_FOUND", "There is no draft");
  await WorkflowConfig.deleteOne({ _id: draft._id, state: "draft" });
  await audit(req, { action: "workflow.draft.discarded", entityType: "WorkflowConfig", entityLabel: `v${draft.version} (draft)`, reason: req.body?.reason || "" });
  res.json({ success: true });
}

// POST /api/config/validate { config? } - problems for the given config (default: the draft).
export async function validate(req, res) {
  const source = req.body?.config ?? (await WorkflowConfig.findOne({ state: "draft" }).lean());
  if (!source) fail(404, "NOT_FOUND", "There is no draft");
  res.json({ success: true, problems: validateConfig(configContent(source), await usage()) });
}

// GET /api/config/diff?from=&to= (versions or "draft"; default: published -> draft)
export async function diff(req, res) {
  const load = async (v) => (v === "draft" ? WorkflowConfig.findOne({ state: "draft" }).lean() : v === "builtin" ? builtInConfig() : v ? WorkflowConfig.findOne({ version: Number(v) }).lean() : (await published()) ?? builtInConfig());
  const [a, b] = await Promise.all([load(req.query.from), load(req.query.to ?? "draft")]);
  if (!a || !b) fail(404, "NOT_FOUND", "Version not found");
  res.json({ success: true, diff: diffConfigs(configContent(a), configContent(b)) });
}

async function makePublished(req, doc, action, reason) {
  const problems = validateConfig(configContent(doc), await usage());
  if (problems.length) fail(400, "CONFIG_INVALID", "The configuration has problems; fix them before publishing", { problems });
  const before = (await published()) ?? { version: 0, ...builtInConfig() };
  await WorkflowConfig.updateMany({ state: "published" }, { $set: { state: "archived" } });
  doc.state = "published";
  doc.reason = reason;
  doc.publishedAt = new Date();
  doc.publishedBy = req.user._id;
  await doc.save();
  await invalidateConfig(); // every following request uses the new rules
  await audit(req, { action, entityType: "WorkflowConfig", entityLabel: `v${doc.version}`, before: { version: before.version }, after: { version: doc.version, diff: diffConfigs(configContent(before), configContent(doc)) }, reason });
  return doc;
}

// POST /api/config/publish { reason, draftVersion? }
export async function publish(req, res) {
  const draft = await WorkflowConfig.findOne({ state: "draft" });
  if (!draft) fail(404, "NOT_FOUND", "There is no draft to publish");
  if (req.body.draftVersion !== undefined && draft.version !== req.body.draftVersion) fail(409, "STALE_CONFIG", "The draft changed meanwhile. Review it again.");
  const doc = await makePublished(req, draft, "workflow.published", req.body.reason);
  res.json({ success: true, meta: meta(doc) });
}

// POST /api/config/rollback { version, reason } - publishes a copy of an earlier version as a new version.
export async function rollback(req, res) {
  const old = await WorkflowConfig.findOne({ version: req.body.version, state: { $ne: "draft" } }).lean();
  if (!old) fail(404, "NOT_FOUND", "Version not found");
  if (await WorkflowConfig.exists({ state: "draft" })) fail(409, "DRAFT_EXISTS", "Publish or discard the current draft first");
  const copy = new WorkflowConfig({ ...configContent(old), version: await nextVersion(), state: "draft", basedOn: old.version, createdBy: req.user._id });
  const doc = await makePublished(req, copy, "workflow.rolledback", req.body.reason);
  res.json({ success: true, meta: meta(doc) });
}

// GET /api/config/export?version= - JSON file of a version (default: published).
export async function exportConfig(req, res) {
  const doc = req.query.version ? await WorkflowConfig.findOne({ version: Number(req.query.version) }).lean() : (await published()) ?? { version: 0, ...builtInConfig() };
  if (!doc) fail(404, "NOT_FOUND", "Version not found");
  await audit(req, { action: "workflow.exported", entityType: "WorkflowConfig", entityLabel: `v${doc.version}` });
  res.set("Content-Disposition", `attachment; filename="workflow-config-v${doc.version}.json"`);
  res.json({ format: "mould-tracker-workflow", version: doc.version, exportedAt: new Date().toISOString(), config: configContent(doc) });
}

// POST /api/config/import { config, reason } - becomes the draft (validated; never published directly).
export async function importConfig(req, res) {
  const content = configContent(req.body.config);
  const problems = validateConfig(content, await usage());
  if (problems.length) fail(400, "CONFIG_INVALID", "The imported configuration has problems", { problems });
  if (await WorkflowConfig.exists({ state: "draft" })) fail(409, "DRAFT_EXISTS", "Publish or discard the current draft first");
  const base = (await published()) ?? { version: 0 };
  const draft = await WorkflowConfig.create({ ...content, version: await nextVersion(), state: "draft", basedOn: base.version, createdBy: req.user._id, reason: req.body.reason });
  await audit(req, { action: "workflow.imported", entityType: "WorkflowConfig", entityLabel: `v${draft.version} (draft)`, after: { diff: diffConfigs(configContent(base.version ? base : builtInConfig()), content) }, reason: req.body.reason });
  res.json({ success: true, meta: meta(draft), problems: [] });
}

// POST /api/config/simulate { mouldId? | mould: { location, status, toolType }, to, status?, intendedDestination?, remarks?, draft? }
// Same evaluateMove as the move endpoint; answers for the caller (or, for config.manage, a chosen role).
export async function simulate(req, res) {
  const { mouldId, mould: fake, to, status, intendedDestination, remarks, draft, role } = req.body;
  let config = getConfig();
  if (draft) {
    if (!can(req.user, "config.manage")) fail(403, "FORBIDDEN", "Only a System Administrator can simulate the draft");
    const d = await WorkflowConfig.findOne({ state: "draft" }).lean();
    if (!d) fail(404, "NOT_FOUND", "There is no draft");
    config = { ...builtInConfig(), ...configContent(d), version: d.version };
  }
  const mould = mouldId ? await Mould.findById(mouldId).lean() : { _id: null, toolId: "Simulated mould", toolType: "INJECTION_MOULD", ...fake };
  if (!mould) fail(404, "NOT_FOUND", "Mould not found");
  const user = role && can(req.user, "config.manage") ? { _id: req.user._id, role, rolePermissionOverrides: (config.roles.find((r) => r.key === role)?.permissions) ?? [] } : req.user;
  // Remarks default to a placeholder so the answer shows whether the move is possible; requiredFields lists them.
  const verdict = evaluateMove(config, mould, { user, to, status, intendedDestination, remarks: remarks ?? "(simulated remark)" });
  res.json({ success: true, configVersion: config.version, verdict: { ...verdict, transition: undefined } });
}

