import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { updateProfile } from '../controllers/authController.js';
import { updateProfileSchema } from '../validators/schemas.js';
afterEach(() => mock.restoreAll());
for (const role of ['admin', 'operator', 'viewer']) {
  test(`${role} can update only their own profile and hash a new password`, async () => {
    const user = { _id: 'own-id', role, name: 'Old', email: 'old@example.com', passwordHash: await bcrypt.hash('old-password', 4), async save() {} };
    mock.method(User, 'findById', async (id) => { assert.equal(id, 'own-id'); return user; });
    const body = updateProfileSchema.parse({ name: ' New ', email: ' NEW@example.com ', currentPassword: 'old-password', newPassword: 'new-password', role: 'admin', id: 'other-id' });
    let result;
    await updateProfile({ user, body }, { json(value) { result = value; } });
    assert.equal(user.name, 'New'); assert.equal(user.email, 'new@example.com'); assert.equal(user.role, role);
    assert.ok(await bcrypt.compare('new-password', user.passwordHash));
    assert.equal(result.user.passwordHash, undefined);
  });
}
test('incorrect current password prevents all profile changes', async () => {
  let saved = false;
  const user = { _id: 'own-id', name: 'Old', passwordHash: await bcrypt.hash('old-password', 4), async save() { saved = true; } };
  mock.method(User, 'findById', async () => user);
  await assert.rejects(updateProfile({ user, body: { name: 'New', currentPassword: 'wrong' } }, {}), (e) => e.status === 400);
  assert.equal(saved, false); assert.equal(user.name, 'Old');
});
test('profile validation rejects invalid email and short new password', () => {
  const body = { name: 'Test', email: 'test@example.com', currentPassword: 'old-password' };
  assert.equal(updateProfileSchema.safeParse({ ...body, email: 'invalid' }).success, false);
  assert.equal(updateProfileSchema.safeParse({ ...body, newPassword: 'short' }).success, false);
  assert.equal(updateProfileSchema.safeParse(body).success, true);
});
