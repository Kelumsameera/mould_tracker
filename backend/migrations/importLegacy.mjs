import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import Tool from '../models/Tool.js';
import Machine from '../models/Machine.js';
import ToolMovement from '../models/ToolMovement.js';
import User from '../models/User.js';

const json = (v) => JSON.parse(JSON.stringify(v));
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
export const digest = (v) => createHash('sha256').update(JSON.stringify(stable(json(v)))).digest('hex');
const text = (v) => String(v ?? '').trim();
const date = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : v);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid legacy timestamp');
  return d.toISOString();
};
const machineCode = (name) => text(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);

export function normalizeRows(rows) {
  const seen = new Set();
  return rows.map((row) => {
    const p = row.payload;
    if (!p || text(row.id).toUpperCase() !== text(p.id).toUpperCase()) throw new Error('Legacy ID mismatch');
    const toolCode = text(p.id).toUpperCase();
    if (!toolCode || seen.has(toolCode)) throw new Error('Missing or duplicate tool ID');
    seen.add(toolCode);
    const notes = [];
    const products = (p.products ?? []).map((product) => {
      const raw = product.cav;
      let cav = 0;
      if (raw !== null && raw !== undefined && raw !== '') {
        if (typeof raw === 'number' || /^\d+$/.test(text(raw))) cav = Number(raw);
        else {
          const match = text(raw).match(/^\d+/);
          if (!match) throw new Error(`Unrecognized cavity value on ${toolCode}`);
          cav = Number(match[0]);
          notes.push(`Legacy cavity detail (${text(product.pid)}): ${text(raw)}`);
        }
      }
      if (!Number.isSafeInteger(cav) || cav < 0) throw new Error(`Invalid cavity count on ${toolCode}`);
      return { pid: text(product.pid).toUpperCase(), desc: text(product.desc), cav };
    });
    if (products.some((p) => !p.pid) || new Set(products.map((p) => p.pid)).size !== products.length) throw new Error(`Invalid products on ${toolCode}`);
    const status = p.locationType === 'taken' ? 'taken' : p.status === 'store' || p.locationType === 'store' ? 'store' : 'machine';
    const machine = status === 'machine' ? text(p.status) : null;
    if (status === 'machine' && (!machine || !machineCode(machine))) throw new Error(`Missing machine for ${toolCode}`);
    const history = (p.history ?? []).map((h) => {
      if (!['store', 'machine', 'taken'].includes(h.toType) || !date(h.at)) throw new Error(`Invalid history on ${toolCode}`);
      if (h.toType === 'machine' && !text(h.toLabel)) throw new Error(`Missing history machine on ${toolCode}`);
      return { status: h.toType, machine: h.toType === 'machine' ? text(h.toLabel) : null, note: text(h.note), at: date(h.at) };
    }).sort((a, b) => a.at.localeCompare(b.at));
    const modelError = new Tool({ toolCode, size: text(p.size), products, status, notes: notes.join('\n'), takenNote: status === 'taken' ? text(p.status) : '' }).validateSync();
    if (modelError) throw new Error(`Invalid legacy tool ${toolCode}: ${modelError.message}`);
    return { toolCode, size: text(p.size), products, status, machine, takenAt: status === 'taken' ? date(p.takenAt) : null,
      takenNote: status === 'taken' ? text(p.status) : '', notes: notes.join('\n'), history, sourceUpdatedAt: date(row.updated_at) };
  });
}

export function makePlan(rows, baseline) {
  const normalized = normalizeRows(rows);
  const existing = new Map(baseline.tools.map((t) => [t.toolCode, t]));
  const protectedCodes = normalized.filter((t) => {
    const live = existing.get(t.toolCode);
    return live && (live.version > 1 || baseline.movements.some((m) => m.toolCode === t.toolCode && m.action !== 'created' && m.createdAt > t.sourceUpdatedAt));
  }).map((t) => t.toolCode);
  const summary = { sourceTools: normalized.length, newTools: normalized.filter((t) => !existing.has(t.toolCode)).length,
    updatedTools: normalized.filter((t) => existing.has(t.toolCode) && !protectedCodes.includes(t.toolCode)).length,
    preservedLiveTools: protectedCodes, legacyHistory: normalized.reduce((n, t) => n + t.history.length, 0),
    missingTakenDates: normalized.filter((t) => t.status === 'taken' && !t.takenAt).length,
    expectedTotalTools: new Set([...existing.keys(), ...normalized.map((t) => t.toolCode)]).size };
  return { normalized, protectedCodes, summary, sourceHash: digest(rows), baselineHash: digest(baseline), planHash: digest({ rows, baseline, protectedCodes }) };
}

async function snapshot(session) {
  const db = mongoose.connection.db;
  return json({ tools: await db.collection('tools').find({}, { session }).toArray(), machines: await db.collection('machines').find({}, { session }).toArray(),
    movements: await db.collection('toolmovements').find({}, { session }).toArray(), userCount: await db.collection('users').countDocuments({}, { session }) });
}
function dataHash(s) {
  return digest(Object.fromEntries(['tools', 'machines', 'movements'].map((k) => [k, [...s[k]].sort((a, b) => String(a._id).localeCompare(String(b._id)))])));
}

export async function applyPlan(plan, baseline) {
  await mongoose.connection.db.createCollection('legacy_migration_runs').catch((e) => { if (e.codeName !== 'NamespaceExists') throw e; });
  const runs = mongoose.connection.db.collection('legacy_migration_runs');
  if (await runs.findOne({ _id: plan.sourceHash })) return { alreadyApplied: true };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (dataHash(await snapshot(session)) !== dataHash(baseline)) throw new Error('Live tools, machines or history changed since preview; take a new snapshot and preview again.');
      const admin = await User.findOne({ role: 'admin', active: true }).session(session);
      if (!admin) throw new Error('No active admin for migration audit');
      const machines = new Map();
      for (const m of await Machine.find().session(session)) machines.set(machineCode(m.name), m);
      async function getMachine(name) {
        if (!name) return null;
        const code = machineCode(name);
        let m = machines.get(code);
        if (!m) {
          if (await Machine.exists({ code }).session(session)) throw new Error(`Machine code collision: ${code}`);
          [m] = await Machine.create([{ code, name, active: true }], { session }); machines.set(code, m);
        }
        return m._id;
      }
      const assignments = new Map();
      for (const t of await Tool.find({ status: 'machine' }).session(session)) {
        if (plan.protectedCodes.includes(t.toolCode) || !plan.normalized.some((n) => n.toolCode === t.toolCode)) assignments.set(String(t.machineId), t.toolCode);
      }
      for (const row of plan.normalized) {
        let tool = await Tool.findOne({ toolCode: row.toolCode }).session(session);
        if (!plan.protectedCodes.includes(row.toolCode)) {
          const before = tool?.status ?? null;
          const machineId = await getMachine(row.machine);
          if (machineId && assignments.has(String(machineId))) throw new Error(`Two tools assigned to machine ${row.machine}`);
          if (machineId) assignments.set(String(machineId), row.toolCode);
          const existingNotes = tool?.notes ?? '';
          const fields = { toolCode: row.toolCode, size: row.size, products: row.products, status: row.status, machineId,
            takenAt: row.takenAt, takenNote: row.takenNote, notes: [existingNotes, row.notes].filter(Boolean).join('\n'), version: (tool?.version ?? 0) + 1 };
          if (tool) { Object.assign(tool, fields); await tool.save({ session }); }
          else [tool] = await Tool.create([fields], { session });
          await ToolMovement.create([{ toolId: tool._id, toolCode: tool.toolCode, action: before ? 'edited' : 'created', fromStatus: before,
            toStatus: tool.status, toMachineId: machineId, performedBy: admin._id, note: '[LEGACY_IMPORT] Imported Supabase record; backup retained.' }], { session });
        }
        let fromStatus = null, fromMachineId = null;
        for (const h of row.history) {
          const toMachineId = await getMachine(h.machine);
          await ToolMovement.create([{ toolId: tool._id, toolCode: tool.toolCode, action: h.status === 'machine' ? 'assigned' : h.status === 'taken' ? 'taken_out' : 'returned',
            fromStatus, toStatus: h.status, fromMachineId, toMachineId, performedBy: admin._id,
            note: `[LEGACY_HISTORY] Original actor not recorded.${h.note ? ' ' + h.note : ''}`, createdAt: new Date(h.at), updatedAt: new Date(h.at) }], { session });
          fromStatus = h.status; fromMachineId = toMachineId;
        }
      }
      await runs.insertOne({ _id: plan.sourceHash, appliedAt: new Date(), planHash: plan.planHash, summary: plan.summary, performedBy: admin._id }, { session });
    });
    return { applied: true, ...plan.summary };
  } finally { await session.endSession(); }
}

async function main() {
  const args = process.argv.slice(2);
  const option = (key) => args[args.indexOf(key) + 1];
  if (!args.includes('--source') || !args.includes('--baseline')) throw new Error('--source and --baseline are required');
  const rows = JSON.parse(fs.readFileSync(option('--source'), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(option('--baseline'), 'utf8'));
  const plan = makePlan(rows, baseline);
  if (!args.includes('--apply')) { console.log(JSON.stringify({ ...plan.summary, planHash: plan.planHash }, null, 2)); return; }
  if (!args.includes('--expected-plan') || option('--expected-plan') !== plan.planHash) throw new Error('Preview plan hash does not match');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try { console.log(JSON.stringify(await applyPlan(plan, baseline), null, 2)); }
  finally { await mongoose.disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
