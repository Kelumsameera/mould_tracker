import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://tools.example.com';
function worker(fetch) {
  const handlers = {};
  const cached = new Map([['/offline.html', new Response('offline fallback')]]);
  const writes = [];
  const cache = {
    match: async (request) => cached.get(request.url || request),
    put: async (request, response) => { writes.push(request.url); cached.set(request.url, response); },
    addAll: async (urls) => { writes.push(...urls); },
  };
  vm.runInNewContext(code, {
    URL, Response, fetch, caches: { open: async () => cache, match: cache.match },
    self: { location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {} },
  });
  function request(path, method = 'GET', mode = 'cors') {
    let response;
    handlers.fetch({ request: { url: path.startsWith('http') ? path : origin + path, method, mode }, respondWith: (value) => { response = value; } });
    return response;
  }
  return { request, writes, handlers };
}

test('API requests, writes, and external origins are never intercepted or cached', () => {
  const w = worker(() => assert.fail('unexpected fetch'));
  for (const path of ['/api/tools', '/api/auth/me', '/api/auth/passkeys']) assert.equal(w.request(path), undefined);
  assert.equal(w.request('/api/tools', 'POST'), undefined);
  assert.equal(w.request('/icons/icon-192.png', 'POST'), undefined);
  assert.equal(w.request('https://external.example/icons/icon-192.png'), undefined);
  assert.equal(w.writes.length, 0);
});

test('offline navigation uses the public fallback instead of cached account pages', async () => {
  const w = worker(async () => { throw new Error('offline'); });
  const response = await w.request('/', 'GET', 'navigate');
  assert.equal(await response.text(), 'offline fallback');
  assert.equal(w.writes.length, 0);
});

test('successful authenticated navigations are not cached', async () => {
  const w = worker(async () => new Response('account page'));
  const response = await w.request('/', 'GET', 'navigate');
  assert.equal(await response.text(), 'account page');
  assert.equal(w.writes.length, 0);
});

test('only successful same-origin static responses enter the cache', async () => {
  const w = worker(async () => ({ ok: true, type: 'basic', clone: () => new Response('static') }));
  await w.request('/_next/static/chunk.js');
  assert.deepEqual(w.writes, [origin + '/_next/static/chunk.js']);
});
