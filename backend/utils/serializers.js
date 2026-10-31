import { permissionsFor } from "../lib/permissions.js";
import { isServiceDue } from "../lib/workflow.js";

// Turns Mongoose documents into the flat JSON shape the frontend uses.
const plain = (d) => (d && typeof d.toObject === "function" ? d.toObject() : d);
const idOf = (v) => (v == null ? null : String(v._id ?? v));
const uploadUrl = (p) => (p ? `/uploads/${p}` : null); // relative to the API base

export const machineRef = (m) => (m && m.code ? { id: String(m._id), code: m.code, name: m.name } : null);
export const rackRef = (r) => (r && r.locationId ? { id: String(r._id), zone: r.zone, row: r.row, number: r.number, code: r.code, locationId: r.locationId } : null);
const userRef = (u) => (u && u.name ? { id: String(u._id), name: u.name } : null);

export const userDTO = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  language: u.language || "en",
  active: u.active,
  permissions: permissionsFor(u)
});

export const imageDTO = (i) => ({ url: uploadUrl(i.path), thumbUrl: uploadUrl(i.thumbPath), width: i.width ?? null, height: i.height ?? null });

export function itemDTO(i) {
  const o = plain(i);
  return {
    id: String(o._id),
    itemId: o.itemId,
    description: o.description || "",
    cavities: o.cavities ?? null,
    qas: o.qas ?? null,
    materialId: o.materialId ?? null,
    materialDescription: o.materialDescription ?? null,
    masterbatchId: o.masterbatchId ?? null,
    masterbatchDescription: o.masterbatchDescription ?? null,
    notes: o.notes || "",
    images: (o.images || []).map(imageDTO),
    sortOrder: o.sortOrder ?? 0,
    deletedAt: o.deletedAt ?? null
  };
}

// refs: Maps by id for machines, racks and users; summary: { itemCount, thumbUrl } for list views.
export function mouldDTO(m, refs = {}, summary = {}) {
  const o = plain(m);
  return {
    id: String(o._id),
    toolId: o.toolId,
    toolType: o.toolType || "INJECTION_MOULD",
    toolSetCount: o.toolSetCount || "",
    size: o.size || "",
    owner: o.owner ?? null,
    capableMachines: o.capableMachines || [],
    status: o.status,
    location: o.location,
    machine: machineRef(refs.machines?.get(idOf(o.machineId))),
    rack: rackRef(refs.racks?.get(idOf(o.rackId))),
    awaitingRack: Boolean(o.awaitingRack),
    shotsToService: o.shotsToService ?? null,
    totalShots: o.totalShots ?? 0,
    serviceDue: isServiceDue(o),
    lastServicedAt: o.lastServicedAt ?? null,
    notes: o.notes || "",
    remarks: o.remarks || "",
    outOfServiceDetails: o.outOfServiceDetails ?? null,
    lastMovedAt: o.lastMovedAt ?? null,
    lastMovedBy: userRef(refs.users?.get(idOf(o.lastMovedBy))),
    lastWork: o.lastWork ? { type: o.lastWork.type, names: o.lastWork.names || [], doneAt: o.lastWork.doneAt } : null,
    openProblem: o.openProblem ? { by: { id: idOf(o.openProblem.by?.userId), name: o.openProblem.by?.name, role: o.openProblem.by?.role }, at: o.openProblem.at, text: o.openProblem.text } : null,
    deletedAt: o.deletedAt ?? null,
    version: o.version,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...summary
  };
}

export const movementDTO = (m, users = new Map()) => ({
  id: String(m._id),
  toolId: m.toolId,
  type: m.type,
  fromLocation: m.fromLocation,
  toLocation: m.toLocation,
  fromStatus: m.fromStatus,
  toStatus: m.toStatus,
  fromMachineCode: m.fromMachineCode,
  toMachineCode: m.toMachineCode,
  fromRackLocationId: m.fromRackLocationId,
  toRackLocationId: m.toRackLocationId,
  remarks: m.remarks || "",
  outOfServiceDetails: m.outOfServiceDetails ?? null,
  overrideReason: m.overrideReason || "",
  by: userRef(users.get(idOf(m.performedBy))),
  createdAt: m.createdAt
});

export const auditDTO = (a) => ({
  id: String(a._id),
  action: a.action,
  entityType: a.entityType,
  entityId: a.entityId ? String(a.entityId) : null,
  entityLabel: a.entityLabel || "",
  actor: a.actorId ? { id: String(a.actorId), name: a.actorName } : { id: null, name: a.actorName || "system" },
  before: a.before ?? null,
  after: a.after ?? null,
  reason: a.reason || "",
  createdAt: a.createdAt
});

const person = (p) => ({ id: String(p.userId), name: p.name, role: p.role });
const photoDTO = (p) => ({ url: uploadUrl(p.path), thumbUrl: uploadUrl(p.thumbPath) });

export const workLogDTO = (l, corrected = false) => ({
  id: String(l._id),
  mouldId: String(l.mouldId),
  toolId: l.toolId,
  type: l.type,
  description: l.description,
  partsUsed: l.partsUsed || "",
  timeSpentMinutes: l.timeSpentMinutes ?? null,
  doneBy: (l.doneBy || []).map(person),
  recordedBy: person(l.recordedBy),
  doneAt: l.doneAt,
  location: l.location,
  machineCode: l.machineCode ?? null,
  rackLocationId: l.rackLocationId ?? null,
  statusBefore: l.statusBefore,
  statusAfter: l.statusAfter,
  shots: l.shots ?? null,
  outcome: l.outcome ?? null,
  sentToWorkshop: Boolean(l.sentToWorkshop),
  photos: (l.photos || []).map(photoDTO),
  correctsId: l.correctsId ? String(l.correctsId) : null,
  corrected,
  problemReported: Boolean(l.problemReported),
  resolvesProblemId: l.resolvesProblemId ? String(l.resolvesProblemId) : null,
  createdAt: l.createdAt
});
