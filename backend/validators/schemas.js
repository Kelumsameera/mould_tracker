import { z } from "zod";
import { ROLES } from "../lib/permissions.js";
import { LOCATIONS, MOULD_STATUSES, TOOL_TYPES } from "../lib/mouldState.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const role = z.enum(ROLES);

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
export const updateItemSchema = z.object({ itemId: upperId("Item ID").optional(), ...itemFields, photo: z.string().max(9_000_000).optional() });

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
  location: z.enum(["MOULD_ROOM", "TOOL_ROOM", "PRODUCTION_FLOOR", "WORKSHOP"]).default("MOULD_ROOM"),
  rackId: objectId.optional(),
  overrideReason,
  items: z.array(createItemSchema).max(100).default([])
});
export const updateMouldSchema = z.object({ toolId: upperId("Tool ID").optional(), ...mouldFields, remarks, version });
export const moveMouldSchema = z.object({
  to: z.enum(LOCATIONS),
  machineId: objectId.optional(),
  machineCode: z.string().trim().min(1).max(50).optional(),
  rackId: objectId.optional(),
  status: z.enum(MOULD_STATUSES).optional(),
  remarks,
  overrideReason,
  version
});
export const statusSchema = z.object({ status: z.enum(MOULD_STATUSES), remarks, version });
export const shotsSchema = z.object({ shots: z.number().int().min(1).max(10_000_000), version });
export const reasonSchema = z.object({ reason: z.string().trim().max(1000).default("") });

export const listMouldsQuery = z.object({
  toolType: z.enum(TOOL_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  location: z.enum(LOCATIONS).optional(),
  status: z.enum(MOULD_STATUSES).optional(),
  owner: z.string().trim().max(10).optional(),
  zone: z.string().trim().max(10).optional(),
  rackId: objectId.optional(),
  machineId: objectId.optional(),
  awaitingRack: z.enum(["true", "false"]).optional(),
  needsService: z.enum(["true", "false"]).optional(),
  problem: z.enum(["true", "false"]).optional(),
  deleted: z.enum(["true", "false"]).optional()
});

export const createZoneSchema = z.object({ code: zoneCode, name: z.string().trim().min(1).max(100), sortOrder: z.number().int().min(0).default(0) });
export const updateZoneSchema = z.object({ code: zoneCode.optional(), name: z.string().trim().min(1).max(100).optional(), active: z.boolean().optional(), sortOrder: z.number().int().min(0).optional() });
export const createRackSchema = z.object({ zone: zoneCode, row: rowLetter, number: rackNumber, capacity: z.number().int().min(1).nullable().default(null), note: z.string().trim().max(300).default("") });
export const updateRackSchema = z.object({ row: rowLetter.optional(), number: rackNumber.optional(), capacity: z.number().int().min(1).nullable().optional(), active: z.boolean().optional(), note: z.string().trim().max(300).optional() });
export const bulkRacksSchema = z.object({ zone: zoneCode, rowFrom: rowLetter, rowTo: rowLetter, from: rackNumber, to: rackNumber, capacity: z.number().int().min(1).nullable().default(null), preview: z.boolean().default(true) });
export const removeRowSchema = z.object({ zone: zoneCode, row: rowLetter });

export const auditQuery = z.object({
  entityType: z.string().trim().max(50).optional(),
  entityId: objectId.optional(),
  action: z.string().trim().max(100).optional(),
  actorId: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

// ---- Work log ----
const WORK_TYPES = ["REPAIR", "SERVICE", "MINOR_FIX", "INSPECTION", "CLEANING", "OTHER"];
export const createWorkLogSchema = z.object({
  type: z.enum(WORK_TYPES),
  description: z.string().trim().min(1, "Say what was done").max(2000),
  partsUsed: z.string().trim().max(1000).default(""),
  timeSpentMinutes: z.number().int().min(0).max(100000).nullable().optional(),
  doneBy: z.array(objectId).min(1).max(5).optional(),
  doneAt: z.coerce.date().optional(),
  shots: z.number().int().min(0).nullable().optional(),
  outcome: z.enum(["OK", "NEEDS_REPAIR", "NEEDS_SERVICE"]).nullable().optional(),
  sendToWorkshop: z.boolean().default(false),
  correctsId: objectId.optional(),
  photos: z.array(z.string().max(9_000_000)).max(3).default([]),
  version
});

const localDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const workLogQuery = z.object({
  q: z.string().trim().max(100).optional(),
  toolId: z.string().trim().max(100).optional(),
  userId: objectId.optional(),
  type: z.enum(WORK_TYPES).optional(),
  machine: z.string().trim().max(50).optional(),
  outcome: z.enum(["OK", "NEEDS_REPAIR", "NEEDS_SERVICE", "NONE"]).optional(),
  status: z.enum(MOULD_STATUSES).optional(),
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
