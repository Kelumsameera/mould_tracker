import Machine from "../models/Machine.js";
import Mould from "../models/Mould.js";
import { withTransaction } from "../config/db.js";
import { fail } from "../utils/ApiError.js";
import { audit, changes } from "../lib/audit.js";
import { normalizeMachineCode } from "../lib/machines.js";

const machineDTO = (m, mould) => ({ id: String(m._id), code: m.code, name: m.name, active: m.active, mould: mould ? { id: String(mould._id), toolId: mould.toolId } : null });

// Machines with the mould currently mounted on each.
export async function listMachines(req, res) {
  const filter = req.query.all === "true" ? {} : { active: true };
  const machines = await Machine.find(filter).sort({ code: 1 }).collation({ locale: "en", numericOrdering: true }).lean();
  const mounted = await Mould.find({ location: "MACHINE", deletedAt: null }, { toolId: 1, machineId: 1 }).lean();
  const byMachine = new Map(mounted.map((m) => [String(m.machineId), m]));
  res.json({ success: true, machines: machines.map((m) => machineDTO(m, byMachine.get(String(m._id)))) });
}

export async function createMachine(req, res) {
  const code = normalizeMachineCode(req.body.code);
  const machine = await withTransaction(async (session) => {
    if (await Machine.exists({ code }).session(session)) fail(409, "DUPLICATE", `Machine ${code} already exists`);
    const [m] = await Machine.create([{ code, name: req.body.name || code }], { session });
    await audit(req, { action: "machine.created", entityType: "Machine", entityId: m._id, entityLabel: code }, session);
    return m;
  });
  res.status(201).json({ success: true, machine: machineDTO(machine) });
}

export async function updateMachine(req, res) {
  const machine = await withTransaction(async (session) => {
    const m = await Machine.findById(req.params.id).session(session);
    if (!m) fail(404, "NOT_FOUND", "Machine not found");
    if (req.body.active === false && (await Mould.exists({ location: "MACHINE", machineId: m._id, deletedAt: null }).session(session))) {
      fail(409, "MACHINE_OCCUPIED", `Take the mould off ${m.code} before disabling it`);
    }
    const before = m.toObject();
    Object.assign(m, Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined)));
    const diff = changes(before, m.toObject(), ["name", "active"]);
    if (!diff.fields.length) fail(400, "NO_CHANGE", "Nothing changed");
    await m.save({ session });
    await audit(req, { action: "machine.updated", entityType: "Machine", entityId: m._id, entityLabel: m.code, before: diff.before, after: diff.after }, session);
    return m;
  });
  res.json({ success: true, machine: machineDTO(machine) });
}
