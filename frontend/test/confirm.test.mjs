import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmStore } from '../src/lib/confirmStore.ts';

const opts = (patch = {}) => ({ title: 'Move mould', message: 'Move FLK19013 from Machine INJ-03 to Mould Room · FLK · A3?', confirmText: 'Move', ...patch });

test('confirm resolves true when accepted', async () => {
  const store = createConfirmStore();
  const pending = store.confirm(opts());
  assert.equal(store.getSnapshot().options.message, 'Move FLK19013 from Machine INJ-03 to Mould Room · FLK · A3?');
  assert.equal(store.accept(), true);
  assert.equal(await pending, true);
  assert.equal(store.getSnapshot(), null);
});

test('confirm resolves false when cancelled', async () => {
  const store = createConfirmStore();
  const pending = store.confirm(opts());
  store.cancel();
  assert.equal(await pending, false);
});

test('Escape cancels; other keys do nothing', async () => {
  const store = createConfirmStore();
  const pending = store.confirm(opts());
  assert.equal(store.handleKey('Enter'), false);
  assert.ok(store.getSnapshot());
  assert.equal(store.handleKey('Escape'), true);
  assert.equal(await pending, false);
  assert.equal(store.handleKey('Escape'), false); // nothing open any more
});

test('typed confirmation: Confirm only works once the code is typed', async () => {
  const store = createConfirmStore();
  const pending = store.confirm(opts({ tone: 'danger', typeToConfirm: 'FLK-A3' }));
  assert.equal(store.canAccept('FLK'), false);
  assert.equal(store.accept('FLK'), false);
  assert.ok(store.getSnapshot(), 'still open');
  assert.equal(store.accept(' flk-a3 '), true); // case and spaces forgiven
  assert.equal(await pending, true);
});

test('ask returns the text, or null when cancelled; required text is enforced', async () => {
  const store = createConfirmStore();
  const a = store.ask(opts({ inputLabel: 'Reason', required: true }));
  assert.equal(store.accept('   '), false);
  store.accept('  worn out ');
  assert.equal(await a, 'worn out');
  const b = store.ask(opts({ inputLabel: 'Reason' }));
  store.handleKey('Escape');
  assert.equal(await b, null);
});

test('a second request waits until the first is answered (one dialog at a time)', async () => {
  const store = createConfirmStore();
  const first = store.confirm(opts({ title: 'one' }));
  const second = store.confirm(opts({ title: 'two' }));
  assert.equal(store.getSnapshot().options.title, 'one');
  store.accept();
  assert.equal(await first, true);
  assert.equal(store.getSnapshot().options.title, 'two');
  store.cancel();
  assert.equal(await second, false);
});

test('subscribers hear every open and close', () => {
  const store = createConfirmStore();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.confirm(opts());
  store.cancel();
  off();
  store.confirm(opts());
  assert.equal(calls, 2);
});
