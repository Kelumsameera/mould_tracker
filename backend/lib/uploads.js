import path from "node:path";
import { fileURLToPath } from "node:url";

// Where item pictures live (UPLOAD_DIR, default backend/uploads). Paths in MongoDB are relative to it.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
