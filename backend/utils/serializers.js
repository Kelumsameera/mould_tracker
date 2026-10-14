// Turns Mongoose documents into the flat JSON shape the frontend uses.
const machineRef = (m) =>
  m && typeof m === "object" && m.code ? { id: String(m._id), code: m.code, name: m.name } : null;

export function toolDTO(t) {
  const o = typeof t.toObject === "function" ? t.toObject() : t;
  return {
    id: String(o._id),
    toolCode: o.toolCode,
    size: o.size,
    status: o.status,
    machine: machineRef(o.machineId),
    takenAt: o.takenAt,
    takenNote: o.takenNote || "",
    notes: o.notes,
    products: (o.products || []).map((p) => ({ pid: p.pid, desc: p.desc, cav: p.cav })),
    version: o.version,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

export const userDTO = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active
});

export const movementDTO = (m) => ({
  id: String(m._id),
  toolCode: m.toolCode,
  action: m.action,
  fromStatus: m.fromStatus,
  toStatus: m.toStatus,
  fromMachine: machineRef(m.fromMachineId),
  toMachine: machineRef(m.toMachineId),
  note: m.note || "",
  by: m.performedBy && m.performedBy.email ? { name: m.performedBy.name, email: m.performedBy.email } : null,
  createdAt: m.createdAt
});
