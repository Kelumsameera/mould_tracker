import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shrink } from '../src/utils/imageUpload.ts';

function mockCanvas(alpha, fail = false) {
  let closed = false;
  const bitmap = { width: 2400, height: 1200, close() { closed = true; } };
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData() { if (fail) throw new Error('bad image'); return { data: new Uint8ClampedArray([255, 0, 0, alpha]) }; } }), toDataURL: mime => `data:${mime};base64,test` };
  return { bitmap, canvas, closed: () => closed };
}

for (const [alpha, format] of [[0, 'png'], [128, 'png'], [255, 'jpeg']]) {
  test(`upload alpha ${alpha} uses ${format} and keeps image proportions`, async t => {
    const mock = mockCanvas(alpha);
    const bitmapBefore = globalThis.createImageBitmap, documentBefore = globalThis.document;
    t.after(() => { globalThis.createImageBitmap = bitmapBefore; globalThis.document = documentBefore; });
    globalThis.createImageBitmap = async () => mock.bitmap;
    globalThis.document = { createElement: () => mock.canvas };
    assert.equal(await shrink({}), `data:image/${format};base64,test`);
    assert.equal(mock.canvas.width, 1600); assert.equal(mock.canvas.height, 800);
    assert.equal(mock.closed(), true);
  });
}

test('image bitmap is released after a processing failure', async t => {
  const mock = mockCanvas(255, true);
  const bitmapBefore = globalThis.createImageBitmap, documentBefore = globalThis.document;
  t.after(() => { globalThis.createImageBitmap = bitmapBefore; globalThis.document = documentBefore; });
  globalThis.createImageBitmap = async () => mock.bitmap;
  globalThis.document = { createElement: () => mock.canvas };
  await assert.rejects(shrink({}), /bad image/);
  assert.equal(mock.closed(), true);
});
