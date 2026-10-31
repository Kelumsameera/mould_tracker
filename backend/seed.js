import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Machine from "./models/Machine.js";
import Tool from "./models/Tool.js";
import Mould from "./models/Mould.js";
import Item from "./models/Item.js";
import Movement from "./models/Movement.js";
import Zone from "./models/Zone.js";
import Rack from "./models/Rack.js";
import AuditLog from "./models/AuditLog.js";
import { ensureDefaultRacks } from "./lib/racks.js";

const source = JSON.parse(fs.readFileSync(new URL("./data/seed-tools.json", import.meta.url), "utf8"));
const adminEmail = (process.env.SEED_SUPERADMIN_EMAIL || "admin@example.com").toLowerCase();
const adminPassword = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMe123!";

async function run() {
  await connectDB();
  await Promise.all([User, Machine, Mould, Item, Movement, Zone, Rack, AuditLog].map((m) => m.init())); // make sure indexes exist

  let admin = await User.findOne({ role: "super_admin" });
  if (!admin) {
    // An existing account with this email (e.g. a legacy admin awaiting migration) is left as it is.
    admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        name: "Super Administrator",
        email: adminEmail,
        role: "super_admin",
        passwordHash: await bcrypt.hash(adminPassword, 12)
      });
      await AuditLog.create({ action: "user.seeded", entityType: "User", entityId: admin._id, entityLabel: admin.email, after: { role: "super_admin" } });
      console.log(`Super Admin login: ${adminEmail} / ${process.env.SEED_SUPERADMIN_PASSWORD ? "(from SEED_SUPERADMIN_PASSWORD)" : adminPassword}  (change it after first login)`);
    }
  }

  const racks = await ensureDefaultRacks();
  console.log(racks.created ? `Default zones FLK and CCI created with ${racks.racks} racks.` : "Zones already exist; racks left unchanged.");

  for (let i = 1; i <= 3; i++) {
    const code = `MACHINE-0${i}`;
    await Machine.updateOne({ code }, { $setOnInsert: { code, name: `Machine 0${i}` } }, { upsert: true });
  }

  // Sample moulds only for an empty database. Existing data is upgraded by migrations/upgradeMouldModel.mjs,
  // and the real tools list comes from the xlsx importer.
  if ((await Mould.exists({})) || (await Tool.exists({}))) {
    console.log("Moulds already present; sample moulds skipped.");
  } else {
    for (const entry of source) {
      const mould = await Mould.create({
        toolId: String(entry.id).trim().toUpperCase(),
        size: String(entry.size || ""),
        location: "MOULD_ROOM",
        awaitingRack: true
      });
      const products = entry.products || [];
      if (products.length) {
        await Item.insertMany(products.map((p, i) => ({ mouldId: mould._id, itemId: p.pid, description: p.desc || "", cavities: Number(p.cav) || null, sortOrder: i })));
      }
      await Movement.create({ mouldId: mould._id, toolId: mould.toolId, type: "CREATED", toLocation: "MOULD_ROOM", toStatus: "GOOD", performedBy: admin._id });
    }
    console.log(`Seed completed: ${source.length} sample moulds.`);
  }

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
