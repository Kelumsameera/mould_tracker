import Tool, { TOOL_STATUSES } from "../models/Tool.js";
import Machine from "../models/Machine.js";
import ToolMovement from "../models/ToolMovement.js";
import { withTransaction } from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { movementDTO, toolDTO } from "../utils/serializers.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NUMERIC_SORT = { locale: "en", numericOrdering: true };

const logMovement = (session, tool, userId, data) =>
  ToolMovement.create([{ toolId: tool._id, toolCode: tool.toolCode, performedBy: userId, ...data }], { session });

async function reloadDTO(id) {
  return toolDTO(await Tool.findById(id).populate("machineId", "code name"));
}

// GET /api/tools?q=search&status=store|machine|taken
export async function listTools(req, res) {
  const filter = {};
  const { q, status } = req.query;

  if (typeof status === "string" && TOOL_STATUSES.includes(status)) filter.status = status;
  if (typeof q === "string" && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ toolCode: rx }, { "products.pid": rx }, { "products.desc": rx }];
  }

  const tools = await Tool.find(filter).populate("machineId", "code name").sort({ toolCode: 1 }).collation(NUMERIC_SORT);
  res.json({ success: true, tools: tools.map(toolDTO) });
}

export async function getTool(req, res) {
  const tool = await Tool.findById(req.params.id).populate("machineId", "code name");
  if (!tool) throw new ApiError(404, "Tool not found");
  res.json({ success: true, tool: toolDTO(tool) });
}

export async function getToolHistory(req, res) {
  const history = await ToolMovement.find({ toolId: req.params.id })
    .populate("performedBy", "name email")
    .populate("fromMachineId toMachineId", "code name")
    .sort({ createdAt: -1 });
  res.json({ success: true, history: history.map(movementDTO) });
}

export async function createTool(req, res) {
  const { toolCode, size, products, notes } = req.body;

  const tool = await withTransaction(async (session) => {
    if (await Tool.exists({ toolCode: toolCode.toUpperCase() }).session(session)) {
      throw new ApiError(409, "Tool code already exists");
    }
    const [created] = await Tool.create([{ toolCode, size, products, notes, status: "store" }], { session });
    await logMovement(session, created, req.user._id, { action: "created", toStatus: "store" });
    return created;
  });

  res.status(201).json({ success: true, tool: await reloadDTO(tool._id) });
}

export async function updateTool(req, res) {
  const { toolCode, size, products, notes, version } = req.body;

  const id = await withTransaction(async (session) => {
    const tool = await Tool.findById(req.params.id).session(session);
    if (!tool) throw new ApiError(404, "Tool not found");
    if (version !== undefined && version !== tool.version) {
      throw new ApiError(409, "Tool was changed by someone else. Refresh and try again.");
    }

    if (toolCode !== undefined && toolCode.toUpperCase() !== tool.toolCode) {
      const duplicate = await Tool.exists({ toolCode: toolCode.toUpperCase(), _id: { $ne: tool._id } }).session(session);
      if (duplicate) throw new ApiError(409, "Tool code already exists");
      tool.toolCode = toolCode;
    }
    if (size !== undefined) tool.size = size;
    if (notes !== undefined) tool.notes = notes;
    if (products !== undefined) tool.products = products;

    tool.version += 1;
    await tool.save({ session });
    await logMovement(session, tool, req.user._id, { action: "edited", fromStatus: tool.status, toStatus: tool.status });
    return tool._id;
  });

  res.json({ success: true, tool: await reloadDTO(id) });
}

// Machines are typed by name (e.g. "Machine 3"). A machine record is created the first time a name is used.
async function findOrCreateMachine(name, session) {
  const code = name.trim().replace(/\s+/g, " ").toUpperCase();
  const existing = await Machine.findOne({ code }).session(session);
  if (existing) return existing;
  const [created] = await Machine.create([{ code, name: name.trim().replace(/\s+/g, " ") }], { session });
  return created;
}

// Shared implementation for assign / return / take out.
async function moveTool(req, res, target) {
  const id = await withTransaction(async (session) => {
    const tool = await Tool.findById(req.params.id).session(session);
    if (!tool) throw new ApiError(404, "Tool not found");

    const fromStatus = tool.status;
    const fromMachineId = tool.machineId;
    let machine = null;

    if (target === "machine") {
      machine = await findOrCreateMachine(req.body.machineName, session);

      // Same behaviour as the original app: the tool already on that machine is replaced and marked taken out.
      const occupant = await Tool.findOne({ machineId: machine._id, status: "machine", _id: { $ne: tool._id } }).session(session);
      if (occupant) {
        const note = `Replaced by ${tool.toolCode}`;
        occupant.status = "taken";
        occupant.machineId = null;
        occupant.takenAt = new Date();
        occupant.takenNote = note;
        occupant.version += 1;
        await occupant.save({ session });
        await logMovement(session, occupant, req.user._id, {
          action: "taken_out", fromStatus: "machine", toStatus: "taken", fromMachineId: machine._id, note
        });
      }
    }

    tool.status = target;
    tool.machineId = machine?._id ?? null;
    tool.takenAt = target === "taken" ? new Date() : null;
    tool.takenNote = target === "taken" ? req.body?.note || "" : "";
    tool.version += 1;
    await tool.save({ session });

    const action = target === "machine" ? "assigned" : target === "store" ? "returned" : "taken_out";
    await logMovement(session, tool, req.user._id, {
      action,
      fromStatus,
      toStatus: target,
      fromMachineId,
      toMachineId: machine?._id ?? null,
      note: target === "taken" ? req.body?.note || "" : ""
    });
    return tool._id;
  });

  res.json({ success: true, tool: await reloadDTO(id) });
}

export const assignTool = (req, res) => moveTool(req, res, "machine");
export const returnTool = (req, res) => moveTool(req, res, "store");
export const takeOutTool = (req, res) => moveTool(req, res, "taken");

export async function deleteTool(req, res) {
  await withTransaction(async (session) => {
    const tool = await Tool.findById(req.params.id).session(session);
    if (!tool) throw new ApiError(404, "Tool not found");
    await logMovement(session, tool, req.user._id, {
      action: "deleted",
      fromStatus: tool.status,
      fromMachineId: tool.machineId
    });
    await tool.deleteOne({ session });
  });
  res.json({ success: true });
}
