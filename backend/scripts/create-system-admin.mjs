import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { connectDB } from "../config/db.js";
import { createUserSchema } from "../validators/schemas.js";

// Deliberately create-only: never promote or overwrite an existing account.
export async function createSystemAdministrator(input) {
  const parsed = createUserSchema.safeParse({ ...input, role: "system_admin" });
  if (!parsed.success) throw new Error("Set valid SYSTEM_ADMIN_NAME, SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD (at least 8 characters).");
  const { name, email, password } = parsed.data;
  if (await User.exists({ email })) throw new Error("An account already uses that email; no account was changed.");
  return User.create({ name, email, role: "system_admin", passwordHash: await bcrypt.hash(password, 12) });
}

try {
  // Validate before connecting; never print credentials or pass them as CLI arguments.
  const input = { name: process.env.SYSTEM_ADMIN_NAME, email: process.env.SYSTEM_ADMIN_EMAIL, password: process.env.SYSTEM_ADMIN_PASSWORD };
  if (!createUserSchema.safeParse({ ...input, role: "system_admin" }).success) throw new Error("Set SYSTEM_ADMIN_NAME, SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD before running this command.");
  await connectDB();
  await User.init();
  await createSystemAdministrator(input);
  console.log("System Administrator account created. Sign in with the configured credentials.");
} catch {
  console.error("System Administrator setup failed. Check the required environment variables, database connection and whether the email is already registered. No existing account was modified.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
