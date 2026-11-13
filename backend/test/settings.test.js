// General settings: thresholds, lists and text overrides change behaviour without code edits; reset restores
// the default; invalid values are refused; values survive a restart (cache dropped and reloaded from storage).
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { find } from "mingo";
import Setting from "../models/Setting.js";
import WorkLog from "../models/WorkLog.js";
import Mould from "../models/Mould.js";
import AuditLog from "../models/AuditLog.js";
import { SETTINGS, LISTS, currentSettings, setSettingsLoader, setting, validateList, validateSetting } from "../lib/settings.js";
import { addImage } from "../lib/itemImages.js";
import { createWorkLogSchema } from "../validators/schemas.js";
import { mouldDTO } from "../utils/serializers.js";
import { settingsRouteTable } from "../routes/settingsRoutes.js";
import * as api from "../controllers/settingsController.js";
import * as config from "../controllers/configController.js";
import { can, effectivePermissions, grantablePermissions } from "../lib/permissions.js";
import { getConfig, useConfigForTests } from "../lib/configStore.js";
import { configContent, validateConfig } from "../lib/workflowValidation.js";
import { userAccessSchema, roleAccessSchema } from "../validators/schemas.js";

test("settings default to System Administrator, with explicit Access Control delegation", () => {
  const previous = getConfig();
  const legacy = structuredClone(previous);
  legacy.roles.find(role => role.key === "super_admin").permissions.push("settings.manage");
  legacy.roles.push({ key: "custom_manager", permissions: ["settings.manage"], active: true });
  useConfigForTests(legacy);
  try {
    for (const role of ["super_admin", "admin", "executive", "custom_manager"]) {
      assert.equal(can({ role }, "settings.manage"), false, role);
      for (const overrides of [
        { rolePermissionOverrides: ["settings.manage"] },
        { permissionOverrides: ["settings.manage"] },
        { permissionOverrides: { grant: ["settings.manage"], deny: [] } }
      ]) {
        const user = { role, ...overrides };
        assert.equal(can(user, "settings.manage"), true, role);
        assert.equal(effectivePermissions(user).includes("settings.manage"), true, role);
        assert.equal(can({ ...user, permissionOverrides: { deny: ["settings.manage"] } }, "settings.manage"), false, role);
      }
    }
    assert.equal(can({ role: "system_admin", permissionOverrides: { deny: ["settings.manage"] } }, "settings.manage"), true);
    assert.equal(grantablePermissions().includes("settings.manage"), true);
    assert.equal(userAccessSchema.safeParse({ grant: ["settings.manage"], reason: "test" }).success, true);
    assert.equal(roleAccessSchema.safeParse({ permissions: ["settings.manage"], reason: "test" }).success, true);
    const editable = configContent(legacy);
    assert.equal(editable.roles.find(role => role.key === "super_admin").permissions.includes("settings.manage"), false);
    assert.equal(validateConfig(editable).some(problem => problem.code === "LOCKED_PERMISSION"), false);
    assert.equal(legacy.roles.find(role => role.key === "super_admin").permissions.includes("settings.manage"), true);
  } finally { useConfigForTests(previous); }
});

const oid = () => new mongoose.Types.ObjectId();
let store, audits;
beforeEach(() => {
  store = []; audits = [];
  mock.method(Setting, "findOneAndUpdate", async (filter, update) => {
    let row = find(store, filter).all()[0];
    if (!row) { row = { ...filter }; store.push(row); }
    Object.assign(row, update.$set);
    return row;
  });
  mock.method(Setting, "deleteOne", async (filter) => { store = store.filter((r) => !(r.kind === filter.kind && r.key === filter.key)); });
  mock.method(WorkLog, "distinct", async () => ["REPAIR"]);
  mock.method(Mould, "distinct", async () => ["FLK"]);
  mock.method(AuditLog, "create", async (e) => audits.push(Array.isArray(e) ? e[0] : e));
  setSettingsLoader(async () => store.map((r) => ({ ...r })));
});
afterEach(() => { mock.restoreAll(); setSettingsLoader(null); });

const sys = { _id: oid(), role: "system_admin" };
const call = async (fn, body = {}, params = {}) => { const r = { body: null, json(b) { r.body = b; return r; }, set() { return r; } }; await fn({ user: sys, body, params, query: {}, ip: "t" }, r); return r.body; };
const img = (h) => ({ path: `items/${h}.webp`, thumbPath: `items/${h}_thumb.webp` });

test("defaults equal the previous behaviour", () => {
  assert.equal(setting("limits.maxItemImages"), 5);
  assert.equal(setting("limits.exportRowCap"), 5000);
  assert.equal(setting("ui.refreshSeconds"), 10);
  assert.deepEqual(LISTS.workTypes.default.map((x) => x.key), ["REPAIR", "SERVICE", "MINOR_FIX", "INSPECTION", "CLEANING", "OTHER"]);
});

test("invalid values are refused with a clear message", () => {
  assert.match(validateSetting("limits.maxItemImages", 0), /from 1 to 20/);
  assert.match(validateSetting("limits.maxItemImages", 2.5), /whole number/);
  assert.match(validateSetting("search.typoTolerance", "yes"), /yes or no/);
  assert.match(validateSetting("nope", 1), /Unknown/);
  assert.match(validateSetting("dashboard.cards", { executive: ["total", "pie"] }), /Unknown/);
  assert.ok(validateList("workTypes", [{ key: "REPAIR", labels: { en: "Repair", si: "" } }]).some((e) => /Sinhala/.test(e)));
  assert.ok(validateList("workTypes", [{ key: "REPAIR", labels: { en: "R", si: "R" } }]).some((e) => /cannot be removed/.test(e)));
  assert.ok(validateList("owners", [{ key: "CCI", labels: { en: "CCI", si: "CCI" } }], ["FLK"]).some((e) => /used in records/.test(e)));
});

test("changing a threshold changes behaviour; reset restores it", async () => {
  const list = [img("a"), img("b")];
  await call(api.putSetting, { value: 2 }, { key: "limits.maxItemImages" });
  assert.throws(() => addImage(list, img("c")), (e) => e.details?.code === "TOO_MANY_IMAGES");
  await assert.rejects(call(api.putSetting, { value: 999 }, { key: "limits.maxItemImages" }), (e) => e.details?.code === "INVALID_SETTING");
  await call(api.resetSetting, {}, { key: "limits.maxItemImages" });
  assert.equal(addImage(list, img("c")).length, 3);
  assert.deepEqual(audits.map((a) => a.action), ["setting.updated", "setting.reset"]);
  assert.ok(audits[0].before && audits[0].after);
});

test("a new work-log type and a standard remark template are accepted everywhere they are used", async () => {
  const items = [...LISTS.workTypes.default, { key: "CALIBRATION", labels: { en: "Calibration", si: "Calibration" }, active: true }];
  await call(api.putList, { items }, { list: "workTypes" });
  assert.equal(createWorkLogSchema.safeParse({ type: "CALIBRATION", description: "x" }).success, true);
  assert.ok(WorkLog.schema.path("type").enumValues.includes("CALIBRATION"), "the model accepts it too");
  await call(api.putList, { items: [...LISTS.remarkTemplates.default, { key: "SPARE_PART", labels: { en: "Waiting for spare part", si: "අමතර කොටස් බලාපොරොත්තුවෙන්" } }] }, { list: "remarkTemplates" });
  const bundle = await call(config.getPublishedConfig);
  assert.ok(bundle.lists.remarkTemplates.some((x) => x.key === "SPARE_PART"));
  assert.ok(bundle.lists.workTypes.some((x) => x.key === "CALIBRATION"));
  // Disabled types are refused for new entries but stay valid in history.
  await call(api.putList, { items: items.map((x) => (x.key === "CALIBRATION" ? { ...x, active: false } : x)) }, { list: "workTypes" });
  assert.equal(createWorkLogSchema.safeParse({ type: "CALIBRATION", description: "x" }).success, false);
});

test("a renamed UI label (EN and SI) is served to every screen; reset removes the override", async () => {
  await call(api.putText, { en: "Find a tool", si: "Tool එකක් සොයන්න" }, { key: "nav.find" });
  let bundle = await call(config.getPublishedConfig);
  assert.deepEqual([bundle.texts.en["nav.find"], bundle.texts.si["nav.find"]], ["Find a tool", "Tool එකක් සොයන්න"]);
  await call(api.resetText, {}, { key: "nav.find" });
  bundle = await call(config.getPublishedConfig);
  assert.equal(bundle.texts.en["nav.find"], undefined);
  await assert.rejects(call(api.putText, { en: "x" }, { key: "bad key!" }), (e) => e.details?.code === "INVALID_TEXT");
});

test("settings survive a restart and are re-read across requests (cache invalidation)", async () => {
  await call(api.putSetting, { value: 30 }, { key: "ui.refreshSeconds" });
  setSettingsLoader(async () => store.map((r) => ({ ...r }))); // "restart": cache dropped
  assert.equal(setting("ui.refreshSeconds"), 10, "before the first load: default");
  const { refreshSettings } = await import("../lib/settings.js");
  await refreshSettings();
  assert.equal(currentSettings().values["ui.refreshSeconds"], 30);
});

test("shots warning level drives the 'service soon' flag", async () => {
  const m = { _id: oid(), toolId: "S1", location: "MACHINE", status: "GOOD", shotsToService: 1000, totalShots: 920 };
  assert.equal(mouldDTO(m).serviceSoon, true);
  await call(api.putSetting, { value: 95 }, { key: "limits.shotsWarnPercent" });
  assert.equal(mouldDTO(m).serviceSoon, false);
});

test("settings routes: reading needs settings.manage or config.manage, changing needs settings.manage", () => {
  const perms = Object.fromEntries(settingsRouteTable.map(([m, p, perm]) => [`${m} ${p}`, perm]));
  assert.deepEqual(perms["get /"], ["settings.manage", "config.manage"]);
  for (const k of ["put /values/:key", "put /lists/:list", "put /texts/:key", "post /texts-import"]) assert.deepEqual(perms[k], ["settings.manage"], k);
  assert.ok(Object.keys(SETTINGS).length >= 10);
});
