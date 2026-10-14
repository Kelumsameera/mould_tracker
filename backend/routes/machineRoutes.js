import { Router } from "express";
import { listMachines } from "../controllers/machineController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler as h } from "../middleware/errorMiddleware.js";

const router = Router();

// Machines are created automatically when a tool is sent to a new machine name.
router.get("/", requireAuth, h(listMachines));

export default router;
