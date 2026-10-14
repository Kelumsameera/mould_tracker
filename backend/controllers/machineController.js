import Machine from "../models/Machine.js";
import Tool from "../models/Tool.js";

// Machines with the tool currently mounted on each (used for the quick-pick chips).
export async function listMachines(req, res) {
  const machines = await Machine.find({ active: true }).sort({ code: 1 }).collation({ locale: "en", numericOrdering: true });
  const mounted = await Tool.find({ status: "machine" }).select("toolCode machineId");
  const byMachine = new Map(mounted.map((t) => [String(t.machineId), t.toolCode]));

  res.json({
    success: true,
    machines: machines.map((m) => ({ id: String(m._id), code: m.code, name: m.name, toolCode: byMachine.get(String(m._id)) || null }))
  });
}
