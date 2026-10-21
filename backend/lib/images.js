import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { UPLOAD_DIR } from "./uploads.js";

const IMAGE_MAX = 800;
const THUMB_MAX = 200;

// Resized WebP (max 800px) + 200px thumbnail, named by content hash so the same picture is stored once.
export async function renderImage(buffer, folder = "items") {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 20);
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const main = await base.clone().resize(IMAGE_MAX, IMAGE_MAX, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  return { path: `${folder}/${hash}.webp`, thumbPath: `${folder}/${hash}_thumb.webp`, width: main.info.width, height: main.info.height, main: main.data, thumb };
}

export function saveRendered(r) {
  for (const [rel, data] of [[r.path, r.main], [r.thumbPath, r.thumb]]) {
    const target = path.join(UPLOAD_DIR, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, data);
  }
  return { path: r.path, thumbPath: r.thumbPath, width: r.width, height: r.height };
}

// Photos arrive as data URLs from the phone (already shrunk in the browser); only real images are accepted.
export async function photosFromDataUrls(list = []) {
  const out = [];
  for (const url of list) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (!m) throw Object.assign(new Error("Photos must be JPEG, PNG or WebP"), { code: "INVALID_PHOTO" });
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length > 6 * 1024 * 1024) throw Object.assign(new Error("Photo is too large"), { code: "INVALID_PHOTO" });
    const meta = await sharp(buffer, { failOn: "none" }).metadata().catch(() => null);
    if (!meta?.format) throw Object.assign(new Error("Photo could not be read"), { code: "INVALID_PHOTO" });
    out.push(await renderImage(buffer, "worklogs"));
  }
  return out;
}
