import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanedNames, planCleaned } from "../scripts/attach-cleaned-pictures.mjs";

const A = "0b1c2d417af257ca7b71", B = "0b5d371f29d81fd3d8a9", C = "0dda94f0f31a7bdda5b1";
const img = (h) => ({ path: `items/${h}.webp`, thumbPath: `items/${h}_thumb.webp` });

test("cleaned pictures get new names so originals stay and caches do not hold the old picture", () => {
  assert.deepEqual(cleanedNames(A), { path: `items/${A}-nobg.webp`, thumbPath: `items/${A}-nobg_thumb.webp` });
});

test("every item using a cleaned picture is updated; a picture shared by two items updates both", () => {
  const files = [{ hash: A, ok: true }, { hash: B, ok: true }, { hash: C, ok: false, reason: "not a transparent WebP" }];
  const items = [
    { _id: 1, mouldId: "m1", itemId: "P1", images: [img(A)] },
    { _id: 2, mouldId: "m2", itemId: "P2", images: [img(A)] },
    { _id: 3, mouldId: "m3", itemId: "P3", images: [img(C)] },
    { _id: 4, mouldId: "m4", itemId: "P4", images: [{ path: `items/${A}-nobg.webp`, thumbPath: "x" }] }
  ];
  const plan = planCleaned(files, items);
  assert.deepEqual(plan.updates.map((u) => u.label), ["P1", "P2"]);
  assert.deepEqual(plan.updates[0].swaps, [{ from: `items/${A}.webp`, path: `items/${A}-nobg.webp`, thumbPath: `items/${A}-nobg_thumb.webp` }]);
  assert.deepEqual(plan.unused, [B]); // cleaned, but no item uses it
  assert.deepEqual(plan.rejected, [{ hash: C, reason: "not a transparent WebP" }]);
  assert.equal(plan.alreadyCleaned, 1);
});

test("running it again changes nothing", () => {
  const items = [{ _id: 1, mouldId: "m1", itemId: "P1", images: [{ path: `items/${A}-nobg.webp`, thumbPath: `items/${A}-nobg_thumb.webp` }] }];
  assert.equal(planCleaned([{ hash: A, ok: true }], items).updates.length, 0);
});
