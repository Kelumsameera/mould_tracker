import { z } from "zod";
import { dispatchDetailsSchema } from "../lib/outOfService.js";
import { grantablePermissions, roleKeys } from "../lib/permissions.js";
import { listKeys, setting } from "../lib/settings.js";
import { TOOL_TYPES, isKnownLocation, isKnownStatus } from "../lib/mouldState.js";
// Locations and statuses come from the workflow config (checked at request time, so new ones are accepted).
const locationKey = z.string().trim().min(1).max(40).refine((k) => isKnownLocation(k), "Unknown location");
const statusKey = z.string().trim().min(1).max(40).refine((k) => isKnownStatus(k), "Unknown status");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
// Minimum length from Settings (auth.passwordMinLength, default 8).
const password = z.string().max(128).refine((p) => p.length >= Math.max(8, setting("auth.passwordMinLength") ?? 8), { message: "Password is too short" });
// Roles and permission keys come from the workflow config (built-in + custom), checked at request time.
const role = z.string().trim().min(1).max(40).refine((r) => roleKeys().includes(r), "Unknown role");

export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const passkeyRegistrationSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  name: z.string().trim().min(1).max(80),
});
export const passkeyDeleteSchema = z.object({ currentPassword: z.string().min(1).max(256) });
export const passkeyResponseSchema = z.object({ response: z.object({ id: z.string().min(1).max(2048) }).passthrough() });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  currentPassword: z.string().min(1).max(128),
  newPassword: password.optional()
});

export const languageSchema = z.object({ language: z.enum(["en", "si"]) });

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const createMachineSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150)
});

export const updateMachineSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  active: z.boolean().optional()
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  password,
  role: role.default("mould_technician")
});

const permissionList = z.array(z.string().max(80).refine((p) => grantablePermissions().includes(p), "Unknown permission")).max(500).refine(values => new Set(values).size === values.length, "Duplicate permissions");
const accessReason = z.string().trim().min(3, "A reason is required").max(500);
// Role matrix row: a permission list, or null to go back to the role defaults.
export const roleAccessSchema = z.object({ permissions: permissionList.nullable(), version: z.number().int().min(0).optional(), reason: accessReason }).strict();
// Per-user overrides: extra (grant) and removed (deny) permissions; both empty = reset to role defaults.
export const userAccessSchema = z.object({ grant: permissionList.default([]), deny: permissionList.default([]), expiresAt: z.iso.datetime({ offset: true }).nullable().optional(), reason: accessReason }).strict();

export const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  role: role.optional(),
  active: z.boolean().optional(),
  password: password.optional()
});

// ---- Moulds, items, racks, audit ----
const optText = (max) => z.string().trim().max(max).optional();
const nullableText = (max) => z.string().trim().max(max).nullable().optional();
const upperId = (label) => z.string().trim().min(1, `${label} is required`).max(100).transform((v) => v.toUpperCase());
const zoneCode = z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9]+$/, "Zone code: letters and numbers only").transform((v) => v.toUpperCase());
const rowLetter = z.string().trim().regex(/^[A-Za-z]{1,3}$/, "Row must be letters").transform((v) => v.toUpperCase());
const rackNumber = z.number().int().min(1).max(999);
const version = z.number().int().positive().optional();
const remarks = z.string().trim().max(2000).default("");
const overrideReason = z.string().trim().max(500).default("");
const capableMachines = z.array(z.string().trim().min(1).max(50)).max(50);

const itemFields = {
  description: optText(500),
  cavities: z.number().int().min(0).nullable().optional(),
  qas: nullableText(100),
  materialId: nullableText(100),
  materialDescription: nullableText(300),
  masterbatchId: nullableText(100),
  masterbatchDescription: nullableText(300),
  notes: optText(1000),
  sortOrder: z.number().int().min(0).optional()
};
export const createItemSchema = z.object({ itemId: upperId("Item ID"), ...itemFields });
export const updateItemSchema = z.object({ itemId: upperId("Item ID").optional(), ...itemFields, photo: z.string().max(9_000_000).optional(), version: z.number().int().positive().optional() });
export const itemImageSchema = z.object({ photo: z.string().min(1).max(9_000_000), version: z.number().int().positive().optional() });
export const itemImageOrderSchema = z.object({ order: z.array(z.string().min(1).max(64)).min(1).max(20), version: z.number().int().positive().optional() });
export const optionalReasonSchema = z.object({ reason: z.string().trim().max(500).default(""), version: z.number().int().positive().optional() });
// Item add / edit with the mould's version for stale-edit protection.
export const addItemSchema = createItemSchema.extend({ version: z.number().int().positive().optional() });

const mouldFields = {
  toolType: z.enum(TOOL_TYPES).optional(),
  toolSetCount: optText(50),
  size: optText(50),
  owner: zoneCode.nullable().optional(),
  capableMachines: capableMachines.optional(),
  shotsToService: z.number().int().min(0).nullable().optional(),
  notes: optText(2000)
};
export const createMouldSchema = z.object({
  toolId: upperId("Tool ID"),
  ...mouldFields,
  location: locationKey.default("MOULD_ROOM"), // where a new mould may start is checked by planInitialLocation
  rackId: objectId.optional(),
  overrideReason,
  items: z.array(createItemSchema).max(100).default([])
});
// Run with blocked cavities: the cavity numbers closed now ([] restores all).
export const cavitiesSchema = z.object({
  blocked: z.array(z.number().int().min(1).max(1000)).max(1000),
  reason: z.string().trim().max(1000).default(""),
  problemType: z.string().trim().max(100).nullable().optional(),
  expectedFixBy: z.iso.datetime({ offset: true }).nullable().optional(),
  photo: z.string().max(9_000_000).optional(),
  version: z.number().int().positive().optional()
});
export const updateMouldSchema = z.object({ toolId: upperId("Tool ID").optional(), ...mouldFields, remarks, version });
export const moveMouldSchema = z.object({
  outOfServiceDetails: dispatchDetailsSchema.optional(),
  to: locationKey,
  machineId: objectId.optional(),
  machineCode: z.string().trim().min(1).max(50).optional(),
  rackId: objectId.optional(),
  status: statusKey.optional(),
  intendedDestination: z.enum(["MACHINE", "PRODUCTION_FLOOR", "MOULD_ROOM", "TOOL_ROOM", "WORKSHOP"]).nullable().optional(),
  remarks,
  overrideReason,
  version
}).superRefine((value, context) => {
  if (value.to === "OUT_OF_SERVICE" && !value.outOfServiceDetails) context.addIssue({ code: "custom", path: ["outOfServiceDetails"], message: "Enter recipient name, address and repair details" });
  if (value.to !== "OUT_OF_SERVICE" && value.outOfServiceDetails) context.addIssue({ code: "custom", path: ["outOfServiceDetails"], message: "Dispatch details can only be set when sending Out of Service" });
});
export const statusSchema = z.object({ status: statusKey, remarks, version });
export const shotsSchema = z.object({ shots: z.number().int().min(1).max(10_000_000), version });
export const reasonSchema = z.object({ reason: z.string().trim().max(1000).default("") });

// Search text: any characters are allowed (punctuation is ignored by the search); long input is cut, never rejected.
const searchText = z.string().transform((s) => s.trim().slice(0, 64)).optional();
export const suggestQuery = z.object({ q: searchText, toolType: z.enum(TOOL_TYPES).optional() });
export const listMouldsQuery = z.object({
  toolType: z.enum(TOOL_TYPES).optional(),
  q: searchText,
  location: locationKey.optional(),
  status: statusKey.optional(),
  owner: z.string().trim().max(10).optional(),
  zone: z.string().trim().max(10).optional(),
  rackId: objectId.optional(),
  machineId: objectId.optional(),
  awaitingRack: z.enum(["true", "false"]).optional(),
  needsService: z.enum(["true", "false"]).optional(),
  problem: z.enum(["true", "false"]).optional(),
  limited: z.enum(["true", "false"]).optional(),
  deleted: z.enum(["true", "false"]).optional()
});

export const createZoneSchema = z.object({ code: zoneCode, name: z.string().trim().min(1).max(100), sortOrder: z.number().int().min(0).default(0) });
export const updateZoneSchema = z.object({ code: zoneCode.optional(), name: z.string().trim().min(1).max(100).optional(), active: z.boolean().optional(), sortOrder: z.number().int().min(0).optional() });
const palletNumber = z.number().int().min(1).max(99);
export const createRackSchema = z.object({ zone: zoneCode, row: rowLetter, number: rackNumber, pallet: palletNumber.optional(), capacity: z.number().int().min(1).nullable().default(null), note: z.string().trim().max(300).default("") });
export const updateRackSchema = z.object({ row: rowLetter.optional(), number: rackNumber.optional(), pallet: palletNumber.optional(), capacity: z.number().int().min(1).nullable().optional(), active: z.boolean().optional(), note: z.string().trim().max(300).optional() });
export const bulkRacksSchema = z.object({ zone: zoneCode, rowFrom: rowLetter, rowTo: rowLetter, from: rackNumber, to: rackNumber, palletFrom: palletNumber.optional(), palletTo: palletNumber.optional(), capacity: z.number().int().min(1).nullable().default(null), preview: z.boolean().default(true) });
export const removeRowSchema = z.object({ zone: zoneCode, row: rowLetter });

export const auditQuery = z.object({
  entityType: z.string().trim().max(50).optional(),
  entityId: objectId.optional(),
  action: z.string().trim().max(100).optional(),
  actorId: objectId.optional(),
  category: z.enum(["access", "edits", "images", "cavities"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

// ---- Catalog & Totals ----
const catalogText = z.string().trim().max(64).optional();
export const catalogQuery = z.object({
  tab: z.enum(["moulds", "products"]).default("moulds"),
  process: z.enum(["INJECTION", "EXTRUSION"]).optional(),
  status: statusKey.optional(),
  owner: catalogText, machine: catalogText, material: catalogText, family: catalogText, q: searchText,
  sort: z.enum(["toolId", "items", "status", "itemId", "moulds"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1)
});
export const catalogExportQuery = catalogQuery.extend({ format: z.enum(["csv", "xlsx"]).default("csv") });

// ---- Work log ----
// Work types come from Settings > Lists (active items; built-in ones by default).
const manualWorkType = z.string().max(40).refine((k) => listKeys("workTypes", { activeOnly: true }).includes(k) && !k.startsWith("CAVITY_"), "Unknown work type");
export const createWorkLogSchema = z.object({
  type: manualWorkType,
  description: z.string().trim().min(1, "Say what was done").max(2000),
  partsUsed: z.string().trim().max(1000).default(""),
  timeSpentMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  doneBy: z.array(objectId).min(1).max(5).optional(),
  doneAt: z.coerce.date().optional(),
  shots: z.number().int().min(0).nullable().optional(),
  outcome: z.string().max(40).refine((k) => listKeys("outcomes", { activeOnly: true }).includes(k), "Unknown outcome").nullable().optional(),
  sendToWorkshop: z.boolean().default(false),
  correctsId: objectId.optional(),
  photos: z.array(z.string().max(9_000_000)).max(3).default([]),
  version
});

const localDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const workLogQuery = z.object({
  q: searchText,
  toolId: z.string().trim().max(100).optional(),
  userId: objectId.optional(),
  type: z.string().max(40).refine((k) => [...listKeys("workTypes"), "CAVITY_BLOCK", "CAVITY_RESTORE"].includes(k), "Unknown work type").optional(),
  machine: z.string().trim().max(50).optional(),
  outcome: z.string().max(40).refine((k) => k === "NONE" || listKeys("outcomes").includes(k), "Unknown outcome").optional(),
  status: statusKey.optional(),
  problem: z.enum(["true", "false"]).optional(),
  range: z.enum(["today", "7d", "30d", "month", "all", "custom"]).optional(),
  from: localDay.optional(), // whole local days (Asia/Colombo)
  to: localDay.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  format: z.enum(["csv", "xlsx"]).default("csv")
});

export const reportProblemSchema = z.object({
  description: z.string().trim().min(1, "Describe the problem").max(2000),
  doneAt: z.coerce.date().optional(),
  photos: z.array(z.string().max(9_000_000)).max(3).default([]),
  version
});

// ---- Workflow config ----
const labels = z.object({ en: z.string().max(120), si: z.string().max(120) }).passthrough();
const configBody = z.object({
  locations: z.array(z.object({ key: z.string().max(40), labels }).passthrough()).max(100),
  statuses: z.array(z.object({ key: z.string().max(40), labels }).passthrough()).max(100),
  transitions: z.array(z.object({ from: z.string().max(40).nullable(), to: z.string().max(40) }).passthrough()).max(20000),
  roles: z.array(z.object({ key: z.string().max(40), labels }).passthrough()).max(100),
  intendedDestinations: z.array(z.string().max(40)).max(100).optional(),
  limitedRunAlertDays: z.number().int().min(1).max(365).optional()
}).passthrough();
const configReason = z.string().trim().min(3, "A reason is required").max(500);
export const configDraftSchema = z.object({ config: configBody, draftVersion: z.number().int().optional() });
export const configValidateSchema = z.object({ config: configBody.optional() });
export const configPublishSchema = z.object({ reason: configReason, draftVersion: z.number().int().optional() });
export const configRollbackSchema = z.object({ version: z.number().int().min(1), reason: configReason });
export const configImportSchema = z.object({ config: configBody, reason: configReason });
export const simulateSchema = z.object({
  mouldId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  mould: z.object({ location: z.string().max(40), status: z.string().max(40), toolType: z.string().max(40).optional() }).optional(),
  to: z.string().max(40), status: z.string().max(40).optional(), intendedDestination: z.string().max(40).nullable().optional(),
  remarks: z.string().max(2000).optional(), draft: z.boolean().optional(), role: z.string().max(40).optional()
}).refine((v) => v.mouldId || v.mould, "Choose a mould or a location and status");

// ---- General settings ----
export const settingValueSchema = z.object({ value: z.unknown(), reason: z.string().trim().max(500).optional() });
export const settingListSchema = z.object({ items: z.array(z.object({ key: z.string().max(40), labels: z.object({ en: z.string().max(200), si: z.string().max(200) }), active: z.boolean().optional(), sortOrder: z.number().optional() }).passthrough()).max(200) });
export const settingTextSchema = z.object({ en: z.string().max(2000).optional(), si: z.string().max(2000).optional() });
export const settingTextsImportSchema = z.object({ texts: z.record(z.string(), z.object({ en: z.string().max(2000).optional(), si: z.string().max(2000).optional() })) });
