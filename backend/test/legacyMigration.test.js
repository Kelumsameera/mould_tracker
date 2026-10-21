import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, normalizeRows, digest } from '../migrations/importLegacy.mjs';
const row = (patch = {}) => ({ id: 'T1', updated_at: '2026-09-01T00:00:00Z', payload: { id: 'T1', status: 'store', products: [{ pid: 'p1', cav: null }], ...patch } });
test('legacy normalization preserves cavity annotations and unknown taken dates', () => {
  const [tool] = normalizeRows([row({ locationType: 'taken', status: '', products: [{ pid: 'p1', cav: '6 but 4 validated' }] })]);
  assert.equal(tool.products[0].cav, 6);
  assert.match(tool.notes, /6 but 4 validated/);
  assert.equal(tool.status, 'taken'); assert.equal(tool.takenAt, null);
});
test('legacy history retains timestamps and destinations', () => {
  const [tool] = normalizeRows([row({ status: 'INJ 14', locationType: 'machine', history: [{ at: 1000, toType: 'machine', toLabel: 'INJ 14' }] })]);
  assert.equal(tool.status, 'machine'); assert.equal(tool.machine, 'INJ 14');
  assert.equal(tool.history[0].at, '1970-01-01T00:00:01.000Z');
});
test('migration preview protects recent live edits and counts only new tools', () => {
  const plan = makePlan([row()], { tools: [{ toolCode: 'T1', version: 2, status: 'machine' }], machines: [], movements: [] });
  assert.deepEqual(plan.protectedCodes, ['T1']); assert.equal(plan.summary.newTools, 0);
  assert.equal(plan.summary.updatedTools, 0); assert.equal(plan.summary.expectedTotalTools, 1);
});
test('invalid IDs, duplicate products and overlong descriptions abort before writes', () => {
  assert.throws(() => normalizeRows([row(), row()]), /duplicate tool/);
  assert.throws(() => normalizeRows([row({ products: [{ pid: 'p1' }, { pid: 'P1' }] })]), /Invalid products/);
  assert.throws(() => normalizeRows([row({ products: [{ pid: 'P1', desc: 'x'.repeat(501) }] })]), /Invalid legacy tool/);
});
test('plan hash detects source changes and is stable across object key ordering', () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  assert.notEqual(digest([row()]), digest([row({ status: 'INJ 14' })]));
});
