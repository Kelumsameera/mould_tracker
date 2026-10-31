import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { updateItemSchema } from "../validators/schemas.js";
import { photosFromDataUrls } from "../lib/images.js";
import { changes } from "../lib/audit.js";

test("item updates accept an optional replacement photo without clearing omitted images", () => {
  assert.deepEqual(updateItemSchema.parse({ description: "Updated" }), { description: "Updated" });
  assert.equal(updateItemSchema.parse({ photo: "data:image/png;base64,AAAA" }).photo, "data:image/png;base64,AAAA");
  assert.equal(updateItemSchema.safeParse({ photo: null }).success, false);
  assert.equal(updateItemSchema.safeParse({ photo: "a".repeat(9_000_001) }).success, false);
});

test("replacement item photo produces item images and thumbnails and records image-only changes", async () => {
  const buffer = await sharp({ create: { width: 30, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  const [image] = await photosFromDataUrls([`data:image/png;base64,${buffer.toString("base64")}`], "items");
  assert.match(image.path, /^items\/[a-f0-9]+\.webp$/);
  assert.match(image.thumbPath, /^items\/[a-f0-9]+_thumb\.webp$/);
  assert.equal((await sharp(image.main).metadata()).format, "webp");
  assert.equal((await sharp(image.thumb).metadata()).format, "webp");
  assert.deepEqual(changes({ images: [] }, { images: [{ path: image.path }] }, ["description", "images"]).fields, ["images"]);
});

test("item replacement rejects URLs and corrupt image data", async () => {
  for (const photo of ["https://example.com/photo.png", "data:image/png;base64,AAAA"]) {
    await assert.rejects(photosFromDataUrls([photo], "items"), { code: "INVALID_PHOTO" });
  }
});
