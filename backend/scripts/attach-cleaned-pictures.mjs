// Points items at background-removed versions of their pictures.
//   node scripts/attach-cleaned-pictures.mjs --dir <folder> [--apply]
// The folder holds <hash>.webp + <hash>_thumb.webp, named after the original item picture they replace.
// Cleaned files are stored under new names (<hash>-nobg...), so the originals stay for rollback and phones
// do not keep showing a cached old picture. Without --apply nothing is written.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import mongoose from "mongoose";
import Item from "../models/Item.js";
import Mould from "../models/Mould.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { UPLOAD_DIR } from "../lib/uploads.js";

const HASH_FILE = /^([0-9a-f]{20})\.webp$/;
export const cleanedNames = (hash) => ({ path: `items/${hash}-nobg.webp`, thumbPath: `items/${hash}-nobg_thumb.webp` });

// Decides, from file checks and the items in the database, which pictures to attach where. Pure.
//   files: [{ hash, ok, reason }]  items: [{ _id, mouldId, itemId, images: [{ path, thumbPath }] }]
export function planCleaned(files, items) {
  const usable = new Map(files.filter((f) => f.ok).map((f) => [`items/${f.hash}.webp`, f.hash]));
  const updates = [];
  for (const item of items) {
    const swaps = (item.images || []).filter((img) => usable.has(img.path)).map((img) => ({ from: img.path, ...cleanedNames(usable.get(img.path)) }));
    if (swaps.length) updates.push({ itemId: item._id, mouldId: item.mouldId, label: item.itemId, swaps });
  }
  const usedHashes = new Set(updates.flatMap((u) => u.swaps.map((s) => s.from)));
  return {
    updates,
    unused: [...usable.entries()].filter(([p]) => !usedHashes.has(p)).map(([, h]) => h), // cleaned, but no item uses it
    rejected: files.filter((f) => !f.ok).map(({ hash, reason }) => ({ hash, reason })),
    alreadyCleaned: items.filter((i) => (i.images || []).some((img) => /-nobg\.webp$/.test(img.path))).length
  };
}

// A cleaned picture must be a WebP with transparency, the same size as the original it replaces.
async function checkFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).filter((n) => HASH_FILE.test(n)).sort()) {
    const hash = HASH_FILE.exec(name)[1];
    const main = path.join(dir, name), thumb = path.join(dir, `${hash}_thumb.webp`), original = path.join(UPLOAD_DIR, "items", name);
    let reason = "";
    if (!fs.existsSync(thumb)) reason = "thumbnail missing";
    else if (!fs.existsSync(original)) reason = "original picture not on this server";
    else {
      const [a, b] = await Promise.all([sharp(main).metadata(), sharp(original).metadata()]);
      if (a.format !== "webp" || !a.hasAlpha) reason = "not a transparent WebP";
      else if (a.width !== b.width || a.height !== b.height) reason = `size ${a.width}x${a.height} differs from original ${b.width}x${b.height}`;
    }
    out.push({ hash, ok: !reason, reason, main, thumb });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.includes("--dir") ? path.resolve(args[args.indexOf("--dir") + 1]) : null;
  const apply = args.includes("--apply");
  if (!dir || !fs.existsSync(dir)) throw new Error("--dir <folder with cleaned pictures> is required");

  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const files = await checkFiles(dir);
    const items = await Item.find({ deletedAt: null, "images.0": { $exists: true } }, { mouldId: 1, itemId: 1, images: 1 }).lean();
    const plan = planCleaned(files, items);
    const moulds = new Map((await Mould.find({ _id: { $in: plan.updates.map((u) => u.mouldId) } }, { toolId: 1 }).lean()).map((m) => [String(m._id), m.toolId]));
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run", database: mongoose.connection.db.databaseName,
      pictures: files.length, usable: files.filter((f) => f.ok).length, rejected: plan.rejected,
      itemsToUpdate: plan.updates.length, moulds: new Set(plan.updates.map((u) => String(u.mouldId))).size,
      unusedPictures: plan.unused.length, itemsAlreadyCleaned: plan.alreadyCleaned
    }, null, 2));
    if (!apply) return;

    const actor = await User.findOne({ role: "super_admin", active: true, deletedAt: null }).lean();
    if (!actor) throw new Error("No active Super Admin to record the change under");
    fs.mkdirSync(path.join(UPLOAD_DIR, "items"), { recursive: true });
    for (const f of files.filter((x) => x.ok)) {
      const names = cleanedNames(f.hash);
      fs.copyFileSync(f.main, path.join(UPLOAD_DIR, names.path));
      fs.copyFileSync(f.thumb, path.join(UPLOAD_DIR, names.thumbPath));
    }
    for (const u of plan.updates) {
      for (const s of u.swaps) {
        await Item.updateOne({ _id: u.itemId }, { $set: { "images.$[img].path": s.path, "images.$[img].thumbPath": s.thumbPath } }, { arrayFilters: [{ "img.path": s.from }] });
      }
      await AuditLog.create({
        actorId: actor._id, actorName: actor.name, action: "item.picture_cleaned", entityType: "Item", entityId: u.itemId,
        entityLabel: `${moulds.get(String(u.mouldId)) ?? ""} / ${u.label}`, before: { pictures: u.swaps.map((s) => s.from) }, after: { pictures: u.swaps.map((s) => s.path) },
        reason: "Background removed"
      });
    }
    console.log(`Applied: ${plan.updates.length} items now use background-removed pictures.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
