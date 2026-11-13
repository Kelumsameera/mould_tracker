import { test } from "node:test";
import assert from "node:assert/strict";
import { addImage, removeImage, reorderImages, replaceImage, keysOf } from "../lib/itemImages.js";
import { MAX_ITEM_IMAGES } from "../lib/images.js";
import { planImagesOnly } from "../scripts/import-moulds.mjs";
import { imageDTO } from "../utils/serializers.js";

const img = (h, source) => ({ path: `items/${h}.webp`, thumbPath: `items/${h}_thumb.webp`, ...(source ? { source } : {}) });
const code = (fn) => { try { fn(); } catch (e) { return e.details?.code ?? e.code; } return "OK"; };

test("add appends and stops at the maximum", () => {
  let list = [];
  for (let i = 0; i < MAX_ITEM_IMAGES; i++) list = addImage(list, img(`h${i}`));
  assert.equal(list.length, MAX_ITEM_IMAGES);
  assert.equal(code(() => addImage(list, img("extra"))), "TOO_MANY_IMAGES");
});

test("the same picture cannot be added twice", () => {
  assert.equal(code(() => addImage([img("a")], img("a"))), "DUPLICATE_IMAGE");
});

test("replace swaps in place and drops the sheet source", () => {
  const out = replaceImage([img("a", "xlsx:S:1"), img("b")], "a", img("c"));
  assert.deepEqual(keysOf(out), ["c", "b"]);
  assert.equal(out[0].source, undefined);
  assert.equal(code(() => replaceImage([img("a")], "zz", img("c"))), "NOT_FOUND");
});

test("remove takes out only that picture", () => {
  assert.deepEqual(keysOf(removeImage([img("a"), img("b"), img("c")], "b")), ["a", "c"]);
  assert.equal(code(() => removeImage([img("a")], "b")), "NOT_FOUND");
});

test("reorder needs every picture once and a real change", () => {
  const list = [img("a"), img("b"), img("c")];
  assert.deepEqual(keysOf(reorderImages(list, ["c", "a", "b"])), ["c", "a", "b"]);
  assert.equal(code(() => reorderImages(list, ["a", "b"])), "INVALID_ORDER");
  assert.equal(code(() => reorderImages(list, ["a", "a", "b"])), "INVALID_ORDER");
  assert.equal(code(() => reorderImages(list, ["a", "b", "c"])), "NO_CHANGE");
});

test("rules never mutate the input list", () => {
  const list = [img("a"), img("b")];
  addImage(list, img("c")); removeImage(list, "a"); reorderImages(list, ["b", "a"]);
  assert.deepEqual(keysOf(list), ["a", "b"]);
});

test("picture DTO exposes a stable key and whether it was uploaded by hand", () => {
  assert.deepEqual([imageDTO(img("abc")).key, imageDTO(img("abc")).manual], ["abc", true]);
  assert.equal(imageDTO(img("abc-nobg", "xlsx:S:1")).manual, false);
});

test("images-only: attaches, keeps manual pictures, is idempotent", () => {
  const mouldA = { _id: "m1", toolId: "A05 083" }, mouldB = { _id: "m2", toolId: "B1" };
  const docs = { 1: img("s1", "xlsx:S:image1.png"), 2: img("s2", "xlsx:S:image2.png") };
  const sheet = [
    { key: "A05083", toolId: "A05-083".replace("-", ""), items: [{ itemId: "I1", imageIds: [1] }, { itemId: "I2", imageIds: [2] }, { itemId: "I3", imageIds: [] }] },
    { key: "B1", toolId: "B1", items: [{ itemId: "J1", imageIds: [1] }] },
    { key: "ZZ", toolId: "ZZ", items: [{ itemId: "K", imageIds: [1] }] }
  ];
  const items = [
    { _id: "i1", mouldId: "m1", itemId: "I1", images: [] },               // gets the sheet picture
    { _id: "i2", mouldId: "m1", itemId: "I2", images: [img("hand")] },    // manual: never touched
    { _id: "i3", mouldId: "m1", itemId: "I3", images: [] },               // sheet has no picture
    { _id: "j1", mouldId: "m2", itemId: "J1", images: [{ ...img("s1-nobg"), source: "xlsx:S:image1.png" }] } // cleaned, same source
  ];
  const plan = planImagesOnly(sheet, [mouldA, mouldB], items, (id) => docs[id] ?? null);
  assert.deepEqual(plan.attach.map((u) => u.label), ["A05083 / I1"]);
  assert.deepEqual(plan.skippedManual, ["A05083 / I2"]);
  assert.equal(plan.noSheetPicture, 1);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.mouldNotFound, ["ZZ"]);
  assert.equal(plan.replace.length, 0);

  // Second run after applying: nothing left to do.
  items[0].images = plan.attach[0].images;
  const again = planImagesOnly(sheet, [mouldA, mouldB], items, (id) => docs[id] ?? null);
  assert.equal(again.attach.length + again.replace.length, 0);
});

test("images-only: a changed sheet picture keeps a cleaned version of the same source", () => {
  const docs = { 1: img("s1", "xlsx:S:1"), 2: img("s2", "xlsx:S:2") };
  const cleaned = { ...img("s1-nobg"), source: "xlsx:S:1" };
  const plan = planImagesOnly([{ key: "M", toolId: "M", items: [{ itemId: "I", imageIds: [1, 2] }] }], [{ _id: "m", toolId: "M" }],
    [{ _id: "i", mouldId: "m", itemId: "I", images: [cleaned] }], (id) => docs[id]);
  assert.deepEqual(keysOf(plan.replace[0].images), ["s1-nobg", "s2"]);
});
