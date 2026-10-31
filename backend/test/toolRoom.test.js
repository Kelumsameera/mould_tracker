import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Mould from '../models/Mould.js';
import Movement from '../models/Movement.js';
import WorkLog from '../models/WorkLog.js';
import { planMove, planInitialLocation, canMove, serviceDueChange } from '../lib/workflow.js';
import { mouldStateError, toolTypeFilter } from '../lib/mouldState.js';
import { mouldDTO } from '../utils/serializers.js';
import { createMouldSchema, listMouldsQuery, moveMouldSchema } from '../validators/schemas.js';
import { planWorkLog } from '../lib/workLog.js';

const oid = () => new mongoose.Types.ObjectId();
const admin = { _id: oid(), role: 'super_admin' };
const die = { _id: oid(), toolId: 'LEX01D', toolType: 'EXTRUSION_DIE', status: 'GOOD', location: 'PRODUCTION_FLOOR', capableMachines: ['EX02'] };
const code = expected => error => error.details?.code === expected;

test('extrusion dies store in Tool Room without a mould rack or waiting flag', () => {
  const { set, movement } = planMove({ mould: die, user: admin, to: 'TOOL_ROOM' });
  assert.equal(set.location, 'TOOL_ROOM');
  assert.equal(set.rackId, null);
  assert.equal(set.awaitingRack, false);
  assert.equal(mouldStateError({ ...die, ...set }), null);
  assert.equal(new Mould({ ...die, ...set }).validateSync(), undefined);
  assert.equal(new Movement(movement).validateSync(), undefined);
  assert.ok(WorkLog.schema.path('location').enumValues.includes('TOOL_ROOM'));
});

test('storage rooms enforce tool category and good condition', () => {
  assert.throws(() => planMove({ mould: die, user: admin, to: 'MOULD_ROOM' }), code('INVALID_LOCATION'));
  assert.throws(() => planMove({ mould: { ...die, toolType: 'INJECTION_MOULD' }, user: admin, to: 'TOOL_ROOM' }), code('INVALID_LOCATION'));
  assert.throws(() => planMove({ mould: { ...die, status: 'NEEDS_REPAIR' }, user: admin, to: 'TOOL_ROOM' }), code('NOT_GOOD'));
  assert.throws(() => planMove({ mould: { ...die, location: 'TOOL_ROOM' }, user: admin, to: 'TOOL_ROOM' }), code('NO_CHANGE'));
  assert.ok(new Mould({ ...die, location: 'MOULD_ROOM', awaitingRack: true }).validateSync());
  assert.ok(new Mould({ ...die, location: 'TOOL_ROOM', awaitingRack: true }).validateSync());
});

test('repair work logged in Tool Room keeps storage valid and requests a Workshop move', () => {
  const result = planWorkLog({ mould: { ...die, location: 'TOOL_ROOM' }, user: { ...admin, name: 'Admin', active: true }, input: { type: 'INSPECTION', description: 'Die needs repair', outcome: 'NEEDS_REPAIR' } });
  assert.ok(result.warnings.includes('WORKSHOP_MOVE_REQUIRED'));
  assert.equal(result.statusSet, null);
  assert.equal(result.log.location, 'TOOL_ROOM');
});

test('Tool Room moves require storage permissions in both directions', () => {
  const supervisor = { role: 'production_supervisor' };
  assert.equal(canMove(supervisor, 'PRODUCTION_FLOOR', 'TOOL_ROOM'), false);
  assert.equal(canMove(supervisor, 'TOOL_ROOM', 'PRODUCTION_FLOOR'), false);
  assert.equal(canMove(admin, 'TOOL_ROOM', 'MACHINE'), true);
  const mounted = planMove({ mould: { ...die, location: 'TOOL_ROOM' }, user: admin, to: 'MACHINE', machine: { _id: oid(), code: 'EX02', active: true } });
  assert.equal(mounted.set.location, 'MACHINE');
});

test('new extrusion dies can start in Tool Room and category filters include legacy injection moulds', () => {
  assert.equal(planInitialLocation({ user: admin, location: 'TOOL_ROOM', toolType: 'EXTRUSION_DIE' }).set.awaitingRack, false);
  assert.deepEqual(toolTypeFilter('INJECTION_MOULD'), { toolType: { $ne: 'EXTRUSION_DIE' } });
  assert.deepEqual(toolTypeFilter('EXTRUSION_DIE'), { toolType: 'EXTRUSION_DIE' });
  assert.equal(mouldDTO({ ...die, toolType: undefined }).toolType, 'INJECTION_MOULD');
  assert.equal(createMouldSchema.parse({ toolId: 'LEX01D', toolType: 'EXTRUSION_DIE', location: 'TOOL_ROOM' }).location, 'TOOL_ROOM');
  assert.equal(moveMouldSchema.parse({ to: 'TOOL_ROOM' }).to, 'TOOL_ROOM');
  assert.equal(listMouldsQuery.safeParse({ toolType: 'unknown' }).success, false);
  assert.equal(serviceDueChange({ ...die, location: 'TOOL_ROOM', shotsToService: 10, totalShots: 10 }, admin, 'limit').statusSet, null);
});
