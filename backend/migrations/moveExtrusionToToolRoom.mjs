// Run from backend: node migrations/moveExtrusionToToolRoom.mjs [--apply]
// Only the 20 extrusion dies imported from the supplied workbook are eligible.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { withTransaction } from '../config/db.js';
import Mould from '../models/Mould.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Movement from '../models/Movement.js';
import AuditLog from '../models/AuditLog.js';

const apply = process.argv.includes('--apply');
const ids = Array.from({ length: 20 }, (_, i) => `LEX${String(i + 1).padStart(2, '0')}D`);
mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
try {
  const [before, itemsBefore] = await Promise.all([Mould.find().lean(), Item.find().lean()]);
  const selected = before.filter(m => ids.includes(m.toolId) && !m.deletedAt);
  if (selected.length !== 20 || selected.some(m => !m.notes?.includes('Source: EXTRUSION 01'))) throw new Error('Expected all 20 imported extrusion dies');
  const pending = selected.filter(m => m.toolType !== 'EXTRUSION_DIE' || m.location !== 'TOOL_ROOM');
  for (const m of pending) if (m.location !== 'MOULD_ROOM' || m.rackId || m.machineId || m.status !== 'GOOD') throw new Error(`Review current location/status of ${m.toolId} before migration`);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', count: pending.length, toolIds: pending.map(m => m.toolId), category: 'EXTRUSION_DIE', location: 'TOOL_ROOM' }, null, 2));
  if (apply && pending.length) {
    const actor = await User.findOne({ role: 'super_admin', active: true, deletedAt: null }).lean();
    if (!actor) throw new Error('No active Super Admin for audit trail');
    const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../outputs/migration');
    fs.mkdirSync(out, { recursive: true });
    const backup = path.join(out, `extrusion-tool-room-before-${Date.now()}.ejson`);
    fs.writeFileSync(backup, mongoose.mongo.BSON.EJSON.stringify({ moulds: before, items: itemsBefore }, { relaxed: false }));
    await withTransaction(async session => {
      for (const original of pending) {
        const mould = await Mould.findById(original._id).session(session);
        if (mould.version !== original.version || mould.location !== original.location) throw new Error(`${original.toolId} changed; run again`);
        Object.assign(mould, { toolType: 'EXTRUSION_DIE', location: 'TOOL_ROOM', awaitingRack: false, rackId: null, machineId: null, lastMovedAt: new Date(), lastMovedBy: actor._id, version: mould.version + 1 });
        await mould.save({ session });
        await Movement.create([{ mouldId: mould._id, toolId: mould.toolId, type: 'MOVED', fromLocation: original.location, toLocation: 'TOOL_ROOM', fromStatus: original.status, toStatus: mould.status, performedBy: actor._id, remarks: 'Extrusion die tools stored separately in Tool Room' }], { session });
        await AuditLog.create([{ actorId: actor._id, actorName: actor.name, action: 'mould.updated', entityType: 'Mould', entityId: mould._id, entityLabel: mould.toolId, before: { toolType: original.toolType || 'INJECTION_MOULD', location: original.location, awaitingRack: original.awaitingRack }, after: { toolType: mould.toolType, location: mould.location, awaitingRack: false }, reason: 'Separate Extrusion Die Tools and Tool Room' }], { session });
      }
    });
    const [after, itemsAfter] = await Promise.all([Mould.find().lean(), Item.find().lean()]);
    const changed = new Set(pending.map(m => String(m._id)));
    for (const original of before) if (!changed.has(String(original._id))) {
      if (JSON.stringify(original) !== JSON.stringify(after.find(m => String(m._id) === String(original._id)))) throw new Error('Unrelated mould changed');
    }
    if (JSON.stringify(itemsBefore) !== JSON.stringify(itemsAfter)) throw new Error('Items changed');
    const verified = after.filter(m => ids.includes(m.toolId) && m.toolType === 'EXTRUSION_DIE' && m.location === 'TOOL_ROOM' && !m.awaitingRack && !m.rackId && !m.machineId);
    if (verified.length !== 20) throw new Error('Migration verification failed');
    fs.writeFileSync(path.join(out, 'extrusion-tool-room-result.json'), JSON.stringify({ migrated: pending.length, verified: verified.length, unrelatedMouldsUnchanged: true, itemsUnchanged: true, backup }, null, 2));
    console.log('Migrated and verified all 20 dies; other moulds and all items unchanged.');
  }
} finally { await mongoose.disconnect(); }
