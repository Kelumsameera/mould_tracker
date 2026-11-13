import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canVisitPage } from '../src/utils/permissions.ts';

test('settings navigation rejects stale grants and permits System Administrator', () => {
  for (const role of ['super_admin', 'admin', 'custom_manager']) {
    const user = { role, permissions: ['settings.manage', 'config.manage'] };
    assert.equal(can(user, 'settings.manage'), false);
    assert.equal(canVisitPage(user, 'settings'), false);
  }
  const systemAdmin = { role: 'system_admin', permissions: ['settings.manage', 'config.manage'] };
  assert.equal(can(systemAdmin, 'settings.manage'), true);
  assert.equal(canVisitPage(systemAdmin, 'settings'), true);
});
