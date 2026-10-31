import ExcelJS from "exceljs";
import Mould from "../models/Mould.js";
import Item from "../models/Item.js";
import Machine from "../models/Machine.js";
import Rack from "../models/Rack.js";
import Movement from "../models/Movement.js";
import User from "../models/User.js";
import WorkLog from "../models/WorkLog.js";
import { withTransaction } from "../config/db.js";
import { visibleUsersFilter } from "../lib/permissions.js";
import { fail } from "../utils/ApiError.js";
import { workLogDTO } from "../utils/serializers.js";
import { audit } from "../lib/audit.js";
import { canDoWork, lastWorkSummary, planProblemReport, planWorkLog } from "../lib/workLog.js";
import { EXPORT_CAP, buildWorkLogFilter, describeFilters } from "../lib/workLogFilter.js";
import { photosFromDataUrls, saveRendered } from "../lib/images.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const problemOpenedFrom = (doc) => doc.openProblem?.workLogId;

// Ids of entries that a later entry corrects.
async function correctedIds(logs) {
  const ids = logs.map((l) => l._id);
  const fixes = await WorkLog.find({ correctsId: { $in: ids } }, { correctsId: 1 }).lean();
  return new Set(fixes.map((f) => String(f.correctsId)));
}
const toDTOs = async (logs) => {
  const corrected = await correctedIds(logs);
  return logs.map((l) => workLogDTO(l, corrected.has(String(l._id))));
};

// GET /api/worklogs/workers - who can be named as having done the work.
export async function listWorkers(req, res) {
  const users = await User.find({ active: true, deletedAt: null, ...visibleUsersFilter(req.user) }).sort({ name: 1 }).lean();
  res.json({ success: true, workers: users.filter(canDoWork).map((u) => ({ id: String(u._id), name: u.name, role: u.role })) });
}

// GET /api/moulds/:id/worklogs
export async function listMouldWorkLogs(req, res) {
  const logs = await WorkLog.find({ mouldId: req.params.id }).sort({ doneAt: -1, createdAt: -1 }).lean();
  res.json({ success: true, workLogs: await toDTOs(logs) });
}

// POST /api/moulds/:id/worklogs
export async function createWorkLog(req, res) {
  const { photos: photoUrls, version, ...input } = req.body;
  let rendered;
  try {
    rendered = await photosFromDataUrls(photoUrls); // outside the transaction: image work is slow
  } catch (e) {
    fail(400, e.code || "INVALID_PHOTO", e.message);
  }

  let warnings = [];
  const result = await withTransaction(async (session) => {
    const doc = await Mould.findById(req.params.id).session(session);
    if (!doc) fail(404, "NOT_FOUND", "Mould not found");
    if (version !== undefined && version !== doc.version) fail(409, "STALE", `${doc.toolId} was changed by someone else. Refresh and try again.`);
    const [machine, rack] = await Promise.all([
      doc.machineId ? Machine.findById(doc.machineId).session(session).lean() : null,
      doc.rackId ? Rack.findById(doc.rackId).session(session).lean() : null
    ]);
    const mould = { ...doc.toObject(), machine, rack };
    const workers = input.doneBy?.length ? await User.find({ _id: { $in: input.doneBy }, ...visibleUsersFilter(req.user) }).session(session).lean() : [];
    const corrected = input.correctsId ? await WorkLog.findById(input.correctsId).session(session).lean() : null;

    const plan = planWorkLog({ mould, user: req.user, input, workers, corrected });
    warnings = plan.warnings;
    const photos = rendered.map(saveRendered);
    const [log] = await WorkLog.create([{ ...plan.log, photos }], { session });

    if (plan.log.resolvesProblemId) await resolveProblem(req, doc, `${plan.log.type}: ${plan.log.description}`, session, log._id);
    if (plan.move) Object.assign(doc, plan.move.set, { remarks: plan.log.description });
    if (plan.statusSet) Object.assign(doc, plan.statusSet);
    if (!doc.lastWork || new Date(doc.lastWork.doneAt) <= plan.log.doneAt) doc.lastWork = lastWorkSummary(plan.log, log._id);
    doc.version += 1;
    await doc.save({ session });

    if (plan.move) await Movement.create([plan.move.movement], { session });
    if (plan.movement) await Movement.create([plan.movement], { session });
    await audit(req, {
      action: input.correctsId ? "worklog.corrected" : "worklog.created", entityType: "WorkLog", entityId: log._id, entityLabel: doc.toolId,
      after: {
        type: log.type, doneBy: log.doneBy.map((p) => p.name), doneAt: log.doneAt, location: log.location, machine: log.machineCode, rack: log.rackLocationId,
        statusBefore: log.statusBefore, statusAfter: log.statusAfter, outcome: log.outcome, sentToWorkshop: log.sentToWorkshop, correctsId: log.correctsId
      },
      reason: log.description
    }, session);
    return { logId: log._id, mouldId: doc._id };
  });

  const log = await WorkLog.findById(result.logId).lean();
  res.status(201).json({ success: true, workLog: workLogDTO(log, false), warnings });
}

// Shared filters for the report, the summary and the export (search also looks at the mould's Item IDs).
export async function reportFilter(q, privacy) {
  const itemMouldIds = q.q ? await Item.distinct("mouldId", { deletedAt: null, itemId: new RegExp(escapeRegex(q.q.trim()), "i") }) : [];
  return buildWorkLogFilter(q, { itemMouldIds, hiddenUserIds: privacy?.ids ?? [] });
}

// Clears the mould's open problem; the report entry stays in the history.
export async function resolveProblem(req, doc, remark, session, byWorkLogId = null) {
  const problemId = problemOpenedFrom(doc);
  if (!problemId) return;
  await audit(req, {
    action: "problem.resolved", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId,
    before: { problem: doc.openProblem.text, reportedBy: doc.openProblem.by?.name }, after: { byWorkLogId }, reason: remark
  }, session);
  doc.openProblem = null;
}

// POST /api/moulds/:id/problems - anyone reports; status and location stay as they are.
export async function reportProblem(req, res) {
  const { photos: photoUrls, version, ...input } = req.body;
  let rendered;
  try {
    rendered = await photosFromDataUrls(photoUrls);
  } catch (e) {
    fail(400, e.code || "INVALID_PHOTO", e.message);
  }
  const logId = await withTransaction(async (session) => {
    const doc = await Mould.findById(req.params.id).session(session);
    if (!doc) fail(404, "NOT_FOUND", "Mould not found");
    if (version !== undefined && version !== doc.version) fail(409, "STALE", `${doc.toolId} was changed by someone else. Refresh and try again.`);
    const [machine, rack] = await Promise.all([
      doc.machineId ? Machine.findById(doc.machineId).session(session).lean() : null,
      doc.rackId ? Rack.findById(doc.rackId).session(session).lean() : null
    ]);
    const plan = planProblemReport({ mould: { ...doc.toObject(), machine, rack }, user: req.user, input });
    const [log] = await WorkLog.create([{ ...plan.log, photos: rendered.map(saveRendered) }], { session });
    doc.openProblem = plan.openProblem(log._id);
    doc.version += 1;
    await doc.save({ session });
    await audit(req, { action: "problem.reported", entityType: "Mould", entityId: doc._id, entityLabel: doc.toolId,
      after: { location: log.location, machine: log.machineCode, rack: log.rackLocationId, status: log.statusBefore, workLogId: log._id }, reason: log.description }, session);
    return log._id;
  });
  res.status(201).json({ success: true, workLog: workLogDTO(await WorkLog.findById(logId).lean(), false) });
}

// GET /api/worklogs - report list.
export async function listWorkLogs(req, res) {
  const q = req.validQuery;
  const filter = await reportFilter(q, req.accountPrivacy);
  const [total, logs] = await Promise.all([
    WorkLog.countDocuments(filter),
    WorkLog.find(filter).sort({ doneAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean()
  ]);
  res.json({ success: true, total, page: q.page, limit: q.limit, workLogs: await toDTOs(logs) });
}

// GET /api/worklogs/summary - per person (each named person counts once per entry) and per mould.
export async function workLogSummary(req, res) {
  // A corrected entry is replaced by its correction, so only the correction counts.
  const filter = { $and: [await reportFilter(req.validQuery, req.accountPrivacy), { _id: { $nin: await WorkLog.distinct("correctsId", { correctsId: { $ne: null } }) } }] };
  const [people, moulds] = await Promise.all([
    WorkLog.aggregate([
      { $match: filter },
      { $unwind: "$doneBy" },
      { $group: { _id: { user: "$doneBy.userId", type: "$type" }, n: { $sum: 1 }, name: { $last: "$doneBy.name" }, role: { $last: "$doneBy.role" }, minutes: { $sum: { $ifNull: ["$timeSpentMinutes", 0] } } } },
      { $group: { _id: "$_id.user", name: { $last: "$name" }, role: { $last: "$role" }, total: { $sum: "$n" }, minutes: { $sum: "$minutes" }, byType: { $push: { k: "$_id.type", v: "$n" } } } },
      { $sort: { total: -1, name: 1 } }
    ]),
    // Repeat problems: moulds with the most repair/fix entries in the range.
    WorkLog.aggregate([
      { $match: req.validQuery.type ? filter : { $and: [filter, { type: { $in: ["REPAIR", "MINOR_FIX", "SERVICE"] } }] } },
      { $group: { _id: "$mouldId", toolId: { $last: "$toolId" }, count: { $sum: 1 }, repairs: { $sum: { $cond: [{ $eq: ["$type", "REPAIR"] }, 1, 0] } }, last: { $max: "$doneAt" } } },
      { $sort: { count: -1, last: -1 } },
      { $limit: 15 }
    ])
  ]);
  res.json({
    success: true,
    people: people.filter(p => !req.accountPrivacy.isHidden({ userId: p._id, role: p.role })).map((p) => ({ userId: String(p._id), name: p.name, role: p.role, total: p.total, minutes: p.minutes, byType: Object.fromEntries(p.byType.map((x) => [x.k, x.v])) })),
    moulds: moulds.map((m) => ({ mouldId: String(m._id), toolId: m.toolId, count: m.count, repairs: m.repairs, last: m.last }))
  });
}

const EXPORT_COLUMNS = [
  ["Done at", (l) => l.doneAt.toISOString()],
  ["Tool ID", (l) => l.toolId],
  ["Type", (l) => l.type],
  ["Done by", (l) => l.doneBy.map((p) => p.role ? `${p.name} (${p.role})` : p.name).join("; ")],
  ["What was done", (l) => l.description],
  ["Parts used", (l) => l.partsUsed],
  ["Minutes", (l) => l.timeSpentMinutes ?? ""],
  ["Location", (l) => [l.location, l.machineCode, l.rackLocationId].filter(Boolean).join(" ")],
  ["Status before", (l) => l.statusBefore],
  ["Status after", (l) => l.statusAfter],
  ["Outcome", (l) => l.outcome ?? ""],
  ["Sent to Workshop", (l) => (l.sentToWorkshop ? "yes" : "")],
  ["Shots", (l) => l.shots ?? ""],
  ["Recorded by", (l) => l.recordedBy.role ? `${l.recordedBy.name} (${l.recordedBy.role})` : l.recordedBy.name],
  ["Recorded at", (l) => l.createdAt.toISOString()],
  ["Corrects entry", (l) => (l.correctsId ? String(l.correctsId) : "")],
  ["Corrected later", (l) => (l.corrected ? "yes" : "")],
  ["Problem report", (l) => (l.problemReported ? "yes" : "")],
  ["Entry id", (l) => String(l._id)]
];
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; // also blocks spreadsheet formulas
};

// GET /api/worklogs/export?format=csv|xlsx
export async function exportWorkLogs(req, res) {
  const q = req.validQuery;
  const filter = await reportFilter(q, req.accountPrivacy);
  const total = await WorkLog.countDocuments(filter);
  if (total > EXPORT_CAP) fail(400, "EXPORT_TOO_LARGE", `${total} entries match; narrow the filters to ${EXPORT_CAP} or fewer`, { total, cap: EXPORT_CAP });
  const found = await WorkLog.find(filter).sort({ doneAt: -1 }).limit(EXPORT_CAP).lean();
  const corrected = await correctedIds(found);
  const logs = found.map((l) => req.accountPrivacy.project({ ...l, corrected: corrected.has(String(l._id)) }));
  const stamp = new Date().toISOString().slice(0, 10);
  const about = describeFilters(q, logs.length);
  await audit(req, { action: "worklog.exported", entityType: "WorkLog", after: { format: q.format, rows: logs.length, filter: Object.fromEntries(about) } });

  if (q.format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Work log");
    const info = wb.addWorksheet("About this export");
    info.columns = [{ header: "Filter", width: 24 }, { header: "Value", width: 60 }];
    info.getRow(1).font = { bold: true };
    for (const row of about) info.addRow(row);
    ws.columns = EXPORT_COLUMNS.map(([header]) => ({ header, width: header === "What was done" ? 60 : 18 }));
    ws.getRow(1).font = { bold: true };
    for (const l of logs) ws.addRow(EXPORT_COLUMNS.map(([, get]) => get(l)));
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", `attachment; filename="work-log-${stamp}.xlsx"`);
    return res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }
  const lines = [
    ...about.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`), "", // what the file was made from
    EXPORT_COLUMNS.map(([h]) => h).join(","), ...logs.map((l) => EXPORT_COLUMNS.map(([, get]) => csvCell(get(l))).join(","))
  ];
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="work-log-${stamp}.csv"`);
  res.send("﻿" + lines.join("\r\n")); // BOM so Excel reads Sinhala names correctly
}
