import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Machine from "./models/Machine.js";
import Tool from "./models/Tool.js";
import ToolMovement from "./models/ToolMovement.js";

const source = JSON.parse(fs.readFileSync(new URL("./data/seed-tools.json", import.meta.url), "utf8"));

async function run() {
  await connectDB();
  await Promise.all([User.init(), Machine.init(), Tool.init(), ToolMovement.init()]); // make sure indexes exist

  let admin = await User.findOne({ email: "admin@example.com" });
  if (!admin) {
    admin = await User.create({
      name: "System Administrator",
      email: "admin@example.com",
      role: "admin",
      passwordHash: await bcrypt.hash("ChangeMe123!", 12)
    });
  }

  for (let i = 1; i <= 3; i++) {
    const code = `MACHINE-0${i}`;
    await Machine.updateOne({ code }, { $setOnInsert: { code, name: `Machine 0${i}` } }, { upsert: true });
  }

  let created = 0;
  for (const item of source) {
    const toolCode = String(item.id).trim().toUpperCase();
    if (await Tool.exists({ toolCode })) continue;

    const tool = await Tool.create({
      toolCode,
      size: String(item.size || ""),
      status: "store",
      products: (item.products || []).map((p) => ({ pid: p.pid, desc: p.desc || "", cav: Number(p.cav) || 0 }))
    });
    await ToolMovement.create({
      toolId: tool._id,
      toolCode: tool.toolCode,
      action: "created",
      toStatus: "store",
      performedBy: admin._id
    });
    created++;
  }

  console.log(`Seed completed: ${created} new tools (${source.length - created} already existed).`);
  console.log("Admin login: admin@example.com / ChangeMe123!  (change it after first login)");
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
