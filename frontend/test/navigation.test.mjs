import { setRuntime } from '../src/utils/runtimeConfig.ts';
setRuntime({ config: null, settings: { 'moves.unrestricted': false }, permissions: [], assignableRoles: [], texts: { en: {}, si: {} }, lists: {} }, 'en');
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_PATHS, getPageName, getLegacyDestination } from '../src/utils/helpers.ts';
import { assignableRoles, canVisitPage, canMoveTo, routeAllowed } from '../src/utils/permissions.ts';

test('machine permission allows mounting from storage without other storage moves', () => {
  const user = { permissions: ['move.machine', 'move.floor'] };
  for (const storage of ['MOULD_ROOM', 'TOOL_ROOM']) {
    assert.equal(canMoveTo(user, storage, 'MACHINE'), true);
    assert.equal(canMoveTo(user, storage, 'PRODUCTION_FLOOR'), false);
    assert.equal(canMoveTo(user, 'MACHINE', storage), false);
    assert.equal(canMoveTo({ permissions: ['move.mouldroom'] }, storage, 'MACHINE'), false);
    assert.equal(canMoveTo({ permissions: [] }, storage, 'MACHINE'), false);
  }
});

test('non-machine moves go through the Isolation Area (mirrors the server)', () => {
  const all = { permissions: ['move.machine', 'move.floor', 'move.mouldroom', 'move.workshop', 'move.isolation'] };
  assert.equal(canMoveTo(all, 'MACHINE', 'MOULD_ROOM'), false);
  assert.equal(canMoveTo(all, 'MACHINE', 'ISOLATION'), true);
  assert.equal(canMoveTo(all, 'ISOLATION', 'MOULD_ROOM'), true);
  assert.equal(canMoveTo(all, 'WORKSHOP', 'MACHINE'), false);
  assert.equal(canMoveTo(all, 'ISOLATION', 'MACHINE'), true);
  assert.equal(canMoveTo({ permissions: ['move.floor'] }, 'MACHINE', 'ISOLATION'), false, 'needs move.isolation');
  assert.equal(routeAllowed('MOULD_ROOM', 'MOULD_ROOM'), true, 'another rack');
  assert.equal(routeAllowed('ISOLATION', 'ISOLATION'), false);
});

test('every sidebar page has a distinct URL that maps back to its name', () => {
  assert.equal(new Set(Object.values(PAGE_PATHS)).size, Object.keys(PAGE_PATHS).length);
  for (const [name, path] of Object.entries(PAGE_PATHS)) {
    assert.equal(getPageName(path), name);
  }
});

test('old hash bookmarks and mould QR links point to the corresponding page', () => {
  assert.equal(getLegacyDestination(''), '/find');
  assert.equal(getLegacyDestination('#/racks'), '/racks');
  assert.equal(getLegacyDestination('#/workReport'), '/work-report');
  assert.equal(getLegacyDestination('#/rackAdmin'), '/rack-admin');
  assert.equal(getLegacyDestination('#/extrusion/m/tool-123'), '/extrusion?mould=tool-123');
  assert.equal(getLegacyDestination('#/unknown/m/tool-123'), '/find?mould=tool-123');
  assert.equal(getLegacyDestination('#/find/m/a&x=y'), '/find?mould=a%26x%3Dy');
});

test('admin page access follows the user permissions rather than the URL', () => {
  const user = { permissions: [] };
  for (const page of ['audit', 'workReport', 'users', 'rackAdmin', 'machines', 'find', 'extrusion', 'racks', 'workshop', 'isolation', 'dashboard']) {
    assert.equal(canVisitPage(user, page), false, page);
  }
  assert.equal(canVisitPage({ permissions: ['mould.edit'] }, 'machines'), true);
  assert.equal(canVisitPage({ permissions: ['rack.manage'] }, 'machines'), false);
  assert.equal(canVisitPage({ permissions: ['audit.view'] }, 'audit'), true);
  assert.equal(canVisitPage({ permissions: ['worklog.report'] }, 'workReport'), true);
  assert.equal(canVisitPage({ permissions: ['users.manage'] }, 'users'), true);
  assert.equal(canVisitPage({ permissions: ['rack.manage'] }, 'rackAdmin'), true);
  assert.equal(canVisitPage({ permissions: ['mould.edit'] }, 'rackAdmin'), true);
  for (const page of ['account', 'passkeys', 'access']) {
    assert.equal(canVisitPage(user, page), true, page); // access shows a read-only "My access" without access.manage
  }
});

test('role assignment follows the table: System Administrator assigns any role, Super Admin no longer appoints Super Admins', () => {
  assert.ok(assignableRoles({ role: 'system_admin' }).includes('system_admin'));
  assert.ok(assignableRoles({ role: 'system_admin' }).includes('super_admin'));
  assert.ok(!assignableRoles({ role: 'super_admin' }).includes('system_admin'));
  assert.ok(!assignableRoles({ role: 'super_admin' }).includes('super_admin'));
  assert.ok(assignableRoles({ role: 'super_admin' }).includes('executive'));
  assert.ok(!assignableRoles({ role: 'admin' }).includes('super_admin'));
  assert.ok(!assignableRoles({ role: 'admin' }).includes('admin'));
  assert.deepEqual(assignableRoles({ role: 'mould_maker' }), []);
});

test('page access honors custom viewing permissions', () => {
  const viewer = { permissions: ['mould.view', 'rack.view'] };
  for (const page of ['find', 'extrusion', 'workshop', 'racks', 'isolation', 'dashboard']) assert.equal(canVisitPage(viewer, page), true, page);
});

test('Out of Service UI offers privileged moves between every location', () => {
  const privileged = { permissions: ['move.outOfService'] };
  assert.equal(canMoveTo(privileged, 'WORKSHOP', 'OUT_OF_SERVICE'), true);
  assert.equal(canMoveTo(privileged, 'OUT_OF_SERVICE', 'WORKSHOP'), true);
  assert.equal(canMoveTo({ permissions: ['move.workshop'] }, 'WORKSHOP', 'OUT_OF_SERVICE'), false);
  assert.equal(canMoveTo(privileged, 'OUT_OF_SERVICE', 'MACHINE'), true);
  assert.equal(canMoveTo(privileged, 'PRODUCTION_FLOOR', 'OUT_OF_SERVICE'), true);
  assert.equal(canMoveTo(privileged, 'OUT_OF_SERVICE', 'OUT_OF_SERVICE'), false);
});
