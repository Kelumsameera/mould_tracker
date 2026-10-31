import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme } from '../src/utils/helpers.ts';

test('saved light and dark themes override the device preference', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});
test('without a valid saved theme the device preference is used', () => {
  for (const saved of [null, '', 'unknown']) {
    assert.equal(resolveTheme(saved, true), 'dark');
    assert.equal(resolveTheme(saved, false), 'light');
  }
});
