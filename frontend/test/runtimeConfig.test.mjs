import { test } from 'node:test';
import assert from 'node:assert/strict';
import { I18N, applyTextOverrides, locationName, statusName, textEntries } from '../src/utils/i18n.ts';
import { setRuntime } from '../src/utils/runtimeConfig.ts';
import { canMoveTo, moveTargets } from '../src/utils/permissions.ts';

const config = {
  version: 3, intendedDestinations: [], limitedRunAlertDays: 7, roles: [],
  locations: [
    { key: 'MACHINE', labels: { en: 'Machine', si: 'මැෂිම' }, kind: 'machine', sortOrder: 1, permission: 'move.machine' },
    { key: 'WORKSHOP', labels: { en: 'Workshop', si: 'Workshop' }, kind: 'simple', sortOrder: 2, permission: 'move.workshop', statusChange: true },
    { key: 'CALIBRATION_ROOM', labels: { en: 'Calibration Room', si: 'Calibration කාමරය' }, kind: 'simple', sortOrder: 3, permission: 'move.calibration_room' }
  ],
  statuses: [{ key: 'GOOD', labels: { en: 'Ready', si: 'සූදානම්' }, allowedLocations: 'any', moveTo: 'any', isGood: true }],
  transitions: [
    { from: 'WORKSHOP', to: 'CALIBRATION_ROOM', allowed: true, via: null, permissions: [['move.calibration_room']] },
    { from: 'WORKSHOP', to: 'MACHINE', allowed: true, via: 'CALIBRATION_ROOM', permissions: [['move.machine']] }
  ]
};

test('labels come from the published config, in the current language', () => {
  setRuntime({ config, permissions: [], assignableRoles: [], settings: { "moves.unrestricted": false }, texts: { en: {}, si: {} }, lists: {} }, 'si');
  assert.equal(locationName('CALIBRATION_ROOM', I18N.si), 'Calibration කාමරය');
  assert.equal(statusName('GOOD', I18N.si), 'සූදානම්');
  setRuntime(null, 'en');
  assert.equal(locationName('CALIBRATION_ROOM', I18N.en), 'Calibration Room');
});

test('move buttons follow the config transitions and the user permissions', () => {
  setRuntime({ config, permissions: [], assignableRoles: [], settings: { "moves.unrestricted": false }, texts: { en: {}, si: {} }, lists: {} }, 'en');
  const user = { permissions: ['move.calibration_room', 'move.machine'] };
  assert.equal(canMoveTo(user, 'WORKSHOP', 'CALIBRATION_ROOM'), true);
  assert.equal(canMoveTo({ permissions: [] }, 'WORKSHOP', 'CALIBRATION_ROOM'), false);
  assert.equal(canMoveTo(user, 'WORKSHOP', 'MACHINE'), false, 'must go via the Calibration Room');
  assert.deepEqual(moveTargets({ location: 'WORKSHOP', status: 'GOOD', toolType: 'INJECTION_MOULD' }).map((l) => l.key), ['MACHINE', 'CALIBRATION_ROOM']);
});

test('text overrides replace plain strings only and keep functions', () => {
  const d = applyTextOverrides(I18N.en, { 'nav.find': 'Find a tool', 'search.results': 'x' });
  assert.equal(d.nav.find, 'Find a tool');
  assert.equal(typeof d.search.results, 'function', 'texts with numbers keep their code version');
  assert.equal(I18N.en.nav.find !== 'Find a tool', true, 'code defaults untouched');
  assert.ok(textEntries(I18N.en).some(([k]) => k === 'nav.find'));
});

 test('unrestricted moves ignore permissions, routing and status filters for active custom destinations', () => {
  const c = structuredClone(config);
  c.statuses[0].moveTo = ['WORKSHOP'];
  c.locations.push({ key: 'CLOSED', kind: 'simple', active: false });
  setRuntime({ config: c, permissions: [], assignableRoles: [], settings: {}, texts: { en: {}, si: {} }, lists: {} }, 'en');
  assert.equal(canMoveTo({ permissions: [] }, 'WORKSHOP', 'MACHINE'), true);
  assert.equal(canMoveTo({ permissions: [] }, 'WORKSHOP', 'CALIBRATION_ROOM'), true);
  assert.equal(canMoveTo(null, 'WORKSHOP', 'MACHINE'), false);
  assert.equal(canMoveTo({ permissions: [] }, 'WORKSHOP', 'CLOSED'), false);
  assert.deepEqual(moveTargets({ location: 'WORKSHOP', status: 'GOOD' }).map(l => l.key), ['MACHINE', 'CALIBRATION_ROOM']);
 });
