import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import toolRoutes from "./routes/toolRoutes.js";
import machineRoutes from "./routes/machineRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

const app = express();
// The deployment exposes only Nginx; trust its forwarded client address.
app.set("trust proxy", 1);

const origins = (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim());

app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "tool-tracker-api",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/tools", toolRoutes);
app.use("/api/machines", machineRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set in .env (at least 32 characters)");
  }
  await connectDB();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`Tool Tracker API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
